"use strict";
const fs=require("node:fs"),fsp=require("node:fs/promises"),path=require("node:path"),crypto=require("node:crypto");
const {spawn}=require("node:child_process"),{pipeline}=require("node:stream/promises"),{Transform}=require("node:stream");
const {createGzip,createGunzip}=require("node:zlib"),{DatabaseSync,backup:sqliteBackup}=require("node:sqlite");
const ROOT="/opt/backups",DATA=process.env.DATA_DIR||"/app/data";
function db(){const d=new DatabaseSync(path.join(DATA,"hub.sqlite"));d.exec("PRAGMA busy_timeout=5000;"+
"CREATE TABLE IF NOT EXISTS backup_jobs(id TEXT PRIMARY KEY,slug TEXT NOT NULL,db_type TEXT NOT NULL,filename TEXT,status TEXT NOT NULL,created_at TEXT NOT NULL,finished_at TEXT,size_bytes INTEGER DEFAULT 0,checksum TEXT,error TEXT,trigger TEXT NOT NULL);"+
"CREATE TABLE IF NOT EXISTS backup_schedules(slug TEXT PRIMARY KEY,enabled INTEGER DEFAULT 0,hour_local INTEGER DEFAULT 3,weekdays TEXT DEFAULT '0,1,2,3,4,5,6',last_run_day TEXT,updated_at TEXT NOT NULL);");return d;}
function appOf(apps,slug){const a=apps.find(x=>x.slug===slug);if(!/^[a-z0-9-]+$/.test(slug)||!a||a.dbType==="none")throw Error("App no registrada");if(a.dbType!=="sqlite"&&(!a.dbContainer||!a.containerNames.includes(a.dbContainer)||!/^[\w.-]+$/.test(a.dbContainer)))throw Error("DB no autorizada");if(a.dbType==="sqlite"&&!a.sqlitePath?.startsWith("/opt/apps/"))throw Error("Ruta SQLite inválida");return a;}
async function verify(file){const st=await fsp.lstat(file);if(!st.isFile()||st.isSymbolicLink()||st.size<80)throw Error("Archivo de backup inválido");const h=crypto.createHash("sha256");let bytes=0;await pipeline(fs.createReadStream(file),new Transform({transform(b,e,cb){h.update(b);cb(null,b);}}),createGunzip(),new Transform({transform(b,e,cb){bytes+=b.length;cb();}}));if(bytes<32)throw Error("Backup descomprimido vacío");return {size:st.size,sha:h.digest("hex")};}
async function sqliteDump(app,out){const st=await fsp.lstat(app.sqlitePath);if(!st.isFile()||st.isSymbolicLink())throw Error("Origen SQLite inseguro");const tmp=out+".db";let src;try{src=new DatabaseSync(app.sqlitePath,{readOnly:true});await sqliteBackup(src,tmp);const test=new DatabaseSync(tmp,{readOnly:true});try{if(Object.values(test.prepare("PRAGMA quick_check").get()||{})[0]!=="ok")throw Error("SQLite quick_check falló");}finally{test.close();}await pipeline(fs.createReadStream(tmp),createGzip(),fs.createWriteStream(out,{flags:"wx",mode:0o600}));}finally{src?.close();await fsp.rm(tmp,{force:true}).catch(()=>{});}}
async function dockerDump(app,out){
 const script=app.dbType==="postgres"?
 'export PGPASSWORD="$POSTGRES_PASSWORD"; if [ -z "$POSTGRES_USER" ]; then POSTGRES_USER=postgres; fi; exec pg_dumpall -U "$POSTGRES_USER" --no-role-passwords':
 'export MYSQL_PWD="$MARIADB_ROOT_PASSWORD"; if [ -z "$MYSQL_PWD" ]; then MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; fi; test -n "$MYSQL_PWD" || exit 3; if command -v mariadb-dump >/dev/null 2>&1; then t=mariadb-dump; else t=mysqldump; fi; exec "$t" -uroot --single-transaction --quick --routines --events --triggers --all-databases';
 const p=spawn("docker",["exec",app.dbContainer,"sh","-ec",script],{stdio:["ignore","pipe","pipe"]});
 const outstream=fs.createWriteStream(out,{flags:"wx",mode:0o600});
 let stderr="",length=0,code=null,exited=false,flushed=false,settled=false;
 await new Promise((resolve,reject)=>{
  const kill=setTimeout(()=>fail(Error("Timeout: dump superior a 15 minutos")),900000);
  function fail(e){if(settled)return;settled=true;clearTimeout(kill);p.kill("SIGKILL");outstream.destroy();reject(e);}
  function finish(){if(settled||!exited||!flushed)return;if(code!==0)return fail(Error("Docker/DB: "+(stderr||code).toString().slice(0,300)));if(length<32)return fail(Error("Dump vacío"));settled=true;clearTimeout(kill);resolve();}
  p.on("error",fail);p.stderr.on("data",b=>stderr=(stderr+b.toString()).slice(-500));p.on("close",c=>{exited=true;code=c;finish();});
  pipeline(p.stdout,new Transform({transform(b,e,cb){length+=b.length;cb(length>8*1024**3?Error("Dump mayor a 8 GB"):null,b);}}),createGzip(),outstream).then(()=>{flushed=true;finish();}).catch(fail);
 });
}
async function createBackup(apps,slug,trigger="manual",actor="admin"){
 if(process.env.HUB_BACKUPS_ENABLED!=="true")throw Error("Falta HUB_BACKUPS_ENABLED=true");
 const app=appOf(apps,slug);await fsp.mkdir(DATA,{recursive:true});const lock=path.join(DATA,"backup-"+slug+".lock");
 let h;try{h=await fsp.open(lock,"wx",0o600);}catch(e){throw Error(e.code==="EEXIST"?"Backup en curso o lock pendiente de revisión":e.message);}
 try{
  await fsp.mkdir(ROOT,{recursive:true,mode:0o700});const disk=await fsp.statfs(ROOT);if(disk.bavail*disk.bsize<1024**3)throw Error("Menos de 1 GB libre");
  const dir=path.join(ROOT,slug);await fsp.mkdir(dir,{recursive:true,mode:0o700});
  const id=crypto.randomUUID(),filename=slug+"_"+new Date().toISOString().replace(/\D/g,"").slice(0,14)+"_"+id.slice(0,8)+(app.dbType==="sqlite"?".sqlite.gz":".sql.gz");
  const tmp=path.join(dir,"."+filename+".part"),dst=path.join(dir,filename),d=db();
  try{
   d.prepare("INSERT INTO backup_jobs(id,slug,db_type,filename,status,created_at,trigger) VALUES(?,?,?,?,?,?,?)").run(id,slug,app.dbType,filename,"running",new Date().toISOString(),trigger);
   if(app.dbType==="sqlite")await sqliteDump(app,tmp);else await dockerDump(app,tmp);
   const valid=await verify(tmp);await fsp.rename(tmp,dst);
   d.prepare("UPDATE backup_jobs SET status='integrity_ok',size_bytes=?,checksum=?,finished_at=? WHERE id=?").run(valid.size,valid.sha,new Date().toISOString(),id);
   d.prepare("INSERT INTO audit_log(timestamp,user,action,target,details) VALUES(?,?,?,?,?)").run(new Date().toISOString(),actor,"BACKUP_CREATED",slug,id+" "+valid.sha);
   return {id,filename,sizeBytes:valid.size,checksum:valid.sha};
  }catch(e){await fsp.rm(tmp,{force:true}).catch(()=>{});d.prepare("UPDATE backup_jobs SET status='failed',error=?,finished_at=? WHERE id=?").run(String(e.message).slice(0,300),new Date().toISOString(),id);throw e;}finally{d.close();}
 }finally{await h.close().catch(()=>{});await fsp.rm(lock,{force:true}).catch(()=>{});}
}
function list(apps){const d=db();try{return d.prepare("SELECT * FROM backup_jobs ORDER BY created_at DESC LIMIT 500").all().map(x=>({id:x.id,appSlug:x.slug,appName:apps.find(a=>a.slug===x.slug)?.name||x.slug,dbType:x.db_type,filename:x.filename||"—",path:x.filename?path.join(ROOT,x.slug,x.filename):"",sizeBytes:x.size_bytes||0,sizeFormatted:Math.round(x.size_bytes/1024)+" KB",createdAt:x.created_at,status:x.status==="integrity_ok"?"verified":x.status==="failed"?"failed":"unverified",integrityStatus:x.status,error:x.error,checksum:x.checksum,trigger:x.trigger,storageLocation:"local",restoreTested:false}));}finally{d.close();}}
async function download(apps,id){if(!/^[a-f0-9-]{36}$/.test(id))throw Error("ID inválido");const d=db();let x;try{x=d.prepare("SELECT * FROM backup_jobs WHERE id=? AND status='integrity_ok'").get(id);}finally{d.close();}if(!x)throw Error("Backup no registrado");appOf(apps,x.slug);if(!/^[\w.-]+$/.test(x.filename)||!x.filename.startsWith(x.slug+"_"))throw Error("Archivo no permitido");const file=path.join(ROOT,x.slug,x.filename),v=await verify(file);if(v.sha!==x.checksum||v.size!==x.size_bytes)throw Error("Integridad alterada");return {file,name:x.filename,size:v.size};}
function schedules(apps){const d=db();try{const rows=d.prepare("SELECT * FROM backup_schedules").all();return apps.filter(a=>a.dbType!=="none").map(a=>{const r=rows.find(x=>x.slug===a.slug);return {slug:a.slug,name:a.name,enabled:!!r?.enabled,hourLocal:r?.hour_local??3,weekdays:r?.weekdays??"0,1,2,3,4,5,6",lastRunDay:r?.last_run_day??null};});}finally{d.close();}}
function schedule(apps,slug,cfg,actor){appOf(apps,slug);if(typeof cfg.enabled!=="boolean"||!Number.isInteger(cfg.hourLocal)||cfg.hourLocal<0||cfg.hourLocal>23||typeof cfg.weekdays!=="string"||!/^[0-6](?:,[0-6]){0,6}$/.test(cfg.weekdays)||new Set(cfg.weekdays.split(",")).size!==cfg.weekdays.split(",").length)throw Error("Horario inválido");const d=db();try{d.prepare("INSERT INTO backup_schedules(slug,enabled,hour_local,weekdays,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(slug) DO UPDATE SET enabled=excluded.enabled,hour_local=excluded.hour_local,weekdays=excluded.weekdays,updated_at=excluded.updated_at").run(slug,cfg.enabled?1:0,cfg.hourLocal,cfg.weekdays,new Date().toISOString());d.prepare("INSERT INTO audit_log(timestamp,user,action,target,details) VALUES(?,?,?,?,?)").run(new Date().toISOString(),actor,"BACKUP_SCHEDULE",slug,JSON.stringify(cfg));}finally{d.close();}}
async function tick(apps,now=new Date()){if(process.env.HUB_BACKUPS_ENABLED!=="true")return [];
 const p=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:"America/Argentina/Buenos_Aires",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",hourCycle:"h23"}).formatToParts(now).map(z=>[z.type,z.value]));
 const day=p.year+"-"+p.month+"-"+p.day,w=new Date(day+"T12:00:00Z").getUTCDay(),result=[];
 for(const s of schedules(apps).filter(s=>s.enabled&&s.hourLocal===Number(p.hour)&&s.weekdays.split(",").includes(String(w))&&s.lastRunDay!==day)){
  const d=db();try{if(!d.prepare("UPDATE backup_schedules SET last_run_day=? WHERE slug=? AND (last_run_day IS NULL OR last_run_day<>?)").run(day,s.slug,day).changes)continue;}finally{d.close();}
  try{const x=await createBackup(apps,s.slug,"scheduled","scheduler");result.push({slug:s.slug,status:"ok",id:x.id});}catch(e){result.push({slug:s.slug,status:"failed",error:String(e.message).slice(0,160)});}
 }
 return result;
}
module.exports={createBackup,list,download,schedules,schedule,tick,verify,db};
