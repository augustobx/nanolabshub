"use strict";
const fs=require("node:fs"),fsp=require("node:fs/promises"),path=require("node:path"),crypto=require("node:crypto");
const {spawn}=require("node:child_process"),{pipeline}=require("node:stream/promises"),{Transform}=require("node:stream");
const {createGzip,createGunzip}=require("node:zlib"),{DatabaseSync,backup:sqliteBackup}=require("node:sqlite");
const ROOT="/opt/backups",DATA=process.env.DATA_DIR||"/app/data";
const protectedProducts=new Set(["onlypadel","onlycars","onlyerp"]);
function assertMutable(slug){if(protectedProducts.has(slug))throw Error("Producto protegido: operación de backup bloqueada");}
function db(){const d=new DatabaseSync(path.join(DATA,"hub.sqlite"));d.exec("PRAGMA busy_timeout=5000;"+
"CREATE TABLE IF NOT EXISTS backup_jobs(id TEXT PRIMARY KEY,slug TEXT NOT NULL,db_type TEXT NOT NULL,filename TEXT,status TEXT NOT NULL,created_at TEXT NOT NULL,finished_at TEXT,size_bytes INTEGER DEFAULT 0,checksum TEXT,error TEXT,trigger TEXT NOT NULL);"+
"CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY AUTOINCREMENT,timestamp TEXT NOT NULL,user TEXT NOT NULL,action TEXT NOT NULL,target TEXT NOT NULL,details TEXT NOT NULL);"+
"CREATE TABLE IF NOT EXISTS backup_schedules(slug TEXT PRIMARY KEY,enabled INTEGER DEFAULT 0,hour_local INTEGER DEFAULT 3,weekdays TEXT DEFAULT '0,1,2,3,4,5,6',last_run_day TEXT,updated_at TEXT NOT NULL);");return d;}
function appOf(apps,slug){const a=apps.find(x=>x.slug===slug);if(!/^[a-z0-9-]+$/.test(slug)||!a||a.dbType==="none")throw Error("App no registrada");if(a.dbType!=="sqlite"&&(!a.dbContainer||!a.containerNames.includes(a.dbContainer)||!/^[\w.-]+$/.test(a.dbContainer)))throw Error("DB no autorizada");if(a.dbType==="sqlite"&&!a.sqlitePath?.startsWith("/opt/apps/"))throw Error("Ruta SQLite inválida");return a;}
async function verify(file){const st=await fsp.lstat(file);if(!st.isFile()||st.isSymbolicLink()||st.size<80)throw Error("Archivo de backup inválido");const h=crypto.createHash("sha256");let bytes=0;await pipeline(fs.createReadStream(file),new Transform({transform(b,e,cb){h.update(b);cb(null,b);}}),createGunzip(),new Transform({transform(b,e,cb){bytes+=b.length;cb(bytes>8*1024**3?Error("Backup descomprimido supera 8 GB"):null);}}));if(bytes<32)throw Error("Backup descomprimido vacío");return {size:st.size,sha:h.digest("hex")};}
async function sqliteDump(app,out){const st=await fsp.lstat(app.sqlitePath);if(!st.isFile()||st.isSymbolicLink())throw Error("Origen SQLite inseguro");const tmp=out+".db";let src;try{src=new DatabaseSync(app.sqlitePath,{readOnly:true});if(typeof sqliteBackup==="function")await sqliteBackup(src,tmp);else src.prepare("VACUUM INTO ?").run(tmp);await fsp.chmod(tmp,0o600);const test=new DatabaseSync(tmp,{readOnly:true});try{if(Object.values(test.prepare("PRAGMA quick_check").get()||{})[0]!=="ok")throw Error("SQLite quick_check falló");}finally{test.close();}await pipeline(fs.createReadStream(tmp),createGzip(),fs.createWriteStream(out,{flags:"wx",mode:0o600}));}finally{src?.close();await fsp.rm(tmp,{force:true}).catch(()=>{});}}
async function dockerDump(app,out){
 const script=app.dbType==="postgres"?
 'export PGPASSWORD="$POSTGRES_PASSWORD"; if [ -z "$POSTGRES_USER" ]; then POSTGRES_USER=postgres; fi; exec pg_dumpall -U "$POSTGRES_USER" --no-role-passwords':
 'export MYSQL_PWD="$MARIADB_ROOT_PASSWORD"; if [ -z "$MYSQL_PWD" ]; then MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; fi; test -n "$MYSQL_PWD" || exit 3; if command -v mariadb-dump >/dev/null 2>&1; then t=mariadb-dump; else t=mysqldump; fi; exec "$t" -uroot --single-transaction --quick --routines --events --triggers --all-databases';
 const p=spawn("docker",["exec",app.dbContainer,"sh","-ec",script],{stdio:["ignore","pipe","pipe"]});
 const outstream=fs.createWriteStream(out,{flags:"wx",mode:0o600});
 let stderr="",length=0,code=null,exited=false,flushed=false,settled=false;
 await new Promise((resolve,reject)=>{
  const kill=setTimeout(()=>fail(Error("Timeout: dump superior a 15 minutos")),900000);
  function fail(e){if(settled)return;e.uncertain=!!p.pid&&!exited;settled=true;clearTimeout(kill);p.kill("SIGKILL");outstream.destroy();reject(e);}
  function finish(){if(settled||!exited||!flushed)return;if(code!==0)return fail(Error("Docker/DB: "+(stderr||code).toString().slice(0,300)));if(length<32)return fail(Error("Dump vacío"));settled=true;clearTimeout(kill);resolve();}
  p.on("error",fail);p.stderr.on("data",b=>stderr=(stderr+b.toString()).slice(-500));p.on("close",c=>{exited=true;code=c;finish();});
  pipeline(p.stdout,new Transform({transform(b,e,cb){length+=b.length;cb(length>8*1024**3?Error("Dump mayor a 8 GB"):null,b);}}),createGzip(),outstream).then(()=>{flushed=true;finish();}).catch(fail);
 });
}
async function createBackup(apps,slug,trigger="manual",actor="admin",metadata={}){
 assertMutable(slug);
 if(process.env.HUB_BACKUPS_ENABLED!=="true")throw Error("Falta HUB_BACKUPS_ENABLED=true");
 const app=appOf(apps,slug);
 if(metadata.jobId){if(!/^[a-f0-9-]{36}$/.test(metadata.jobId))throw Error("ID de trabajo inválido");const prior=db();let record;try{record=prior.prepare("SELECT status,slug FROM backup_jobs WHERE id=?").get(metadata.jobId);}finally{prior.close();}if(record&&record.slug!==slug)throw Error("El ID de respaldo pertenece a otra aplicación");if(record?.status==="integrity_ok"){const checked=await download(apps,metadata.jobId);return {id:metadata.jobId,filename:checked.name,sizeBytes:checked.size,checksum:(await verify(checked.file)).sha};}}
 await fsp.mkdir(DATA,{recursive:true});const lock=path.join(DATA,"backup-"+slug+".lock");
 let h;try{h=await fsp.open(lock,"wx",0o600);}catch(e){throw Error(e.code==="EEXIST"?"Backup en curso o lock pendiente de revisión":e.message,{cause:e});}
 let retainLock=false;
 try{
  await h.writeFile(JSON.stringify({pid:process.pid,host:require("node:os").hostname(),jobId:metadata.jobId||null,nonce:crypto.randomUUID(),createdAt:Date.now()}));
  await fsp.mkdir(ROOT,{recursive:true,mode:0o700});
  const rootStat=await fsp.lstat(ROOT);
  if(!rootStat.isDirectory() || rootStat.isSymbolicLink())throw Error("Directorio de backups inválido");
  const disk=await fsp.statfs(ROOT);if(disk.bavail*disk.bsize<1024**3)throw Error("Menos de 1 GB libre");
  const dir=path.join(ROOT,slug);await fsp.mkdir(dir,{recursive:true,mode:0o700});
  const directoryStat=await fsp.lstat(dir);
  if(!directoryStat.isDirectory() || directoryStat.isSymbolicLink())throw Error("Ruta de backup insegura");
  const id=metadata.jobId||crypto.randomUUID(),filename=slug+"_"+new Date().toISOString().replace(/\D/g,"").slice(0,14)+"_"+id.slice(0,8)+(app.dbType==="sqlite"?".sqlite.gz":".sql.gz");
  const tmp=path.join(dir,"."+filename+".part"),dst=path.join(dir,filename),d=db();
  try{
   d.prepare("INSERT INTO backup_jobs(id,slug,db_type,filename,status,created_at,trigger) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET filename=excluded.filename,status=excluded.status,error=NULL,finished_at=NULL").run(id,slug,app.dbType,filename,"running",new Date().toISOString(),trigger);
   d.prepare("INSERT INTO audit_log(timestamp,user,action,target,details) VALUES(?,?,?,?,?)").run(new Date().toISOString(),actor,"BACKUP_STARTED",slug,id);
   if(app.dbType==="sqlite")await sqliteDump(app,tmp);else await dockerDump(app,tmp);
   const valid=await verify(tmp);await fsp.rename(tmp,dst);
   d.prepare("UPDATE backup_jobs SET status='integrity_ok',size_bytes=?,checksum=?,finished_at=? WHERE id=?").run(valid.size,valid.sha,new Date().toISOString(),id);
   d.prepare("INSERT INTO audit_log(timestamp,user,action,target,details) VALUES(?,?,?,?,?)").run(new Date().toISOString(),actor,"BACKUP_CREATED",slug,id+" "+valid.sha);
   return {id,filename,sizeBytes:valid.size,checksum:valid.sha};
  }catch(e){retainLock=!!e.uncertain;if(!retainLock)await fsp.rm(tmp,{force:true}).catch(()=>{});d.prepare("UPDATE backup_jobs SET status=?,error=?,finished_at=? WHERE id=? AND status<>'integrity_ok'").run(retainLock?"uncertain":"failed",String(e.message).slice(0,300),new Date().toISOString(),id);throw e;}finally{d.close();}
 }finally{await h.close().catch(()=>{});if(!retainLock)await fsp.rm(lock,{force:true}).catch(()=>{});}
}
function list(apps){const d=db();try{return d.prepare("SELECT * FROM backup_jobs ORDER BY created_at DESC LIMIT 500").all().map(x=>{
 let status=x.status==="integrity_ok"?"verified":x.status==="failed"?"failed":"unverified",error=x.error;
 if(x.status==="integrity_ok")try{
  const dir=path.join(ROOT,x.slug),file=path.join(dir,x.filename);
  if(!/^[a-z0-9-]+$/.test(x.slug)||!x.filename?.startsWith(x.slug+"_")||!/^[_a-zA-Z0-9.-]+$/.test(x.filename))throw Error("Ruta de archivo inválida");
  if(fs.lstatSync(dir).isSymbolicLink())throw Error("Directorio inseguro");
  const st=fs.lstatSync(file);if(!st.isFile()||st.isSymbolicLink()||st.size!==x.size_bytes)throw Error("Archivo ausente o tamaño alterado");
  if(st.mtimeMs>Date.parse(x.finished_at)+1000){status="unverified";error="El archivo cambió después de su comprobación de integridad";}
 }catch{status="failed";error="La copia registrada no está disponible o cambió; no se contabiliza como íntegra";}
 return {id:x.id,appSlug:x.slug,appName:apps.find(a=>a.slug===x.slug)?.name||x.slug,dbType:x.db_type,filename:x.filename||"—",path:x.filename?path.join(ROOT,x.slug,x.filename):"",sizeBytes:x.size_bytes||0,sizeFormatted:Math.round(x.size_bytes/1024)+" KB",createdAt:x.created_at,status,integrityStatus:x.status,integrityCheckedAt:x.finished_at,error,checksum:x.checksum,trigger:x.trigger,storageLocation:"local",restoreTested:false};
 });}finally{d.close();}}
function externalInventory(apps){
 const d=db();let registered;try{registered=new Set(d.prepare("SELECT slug,filename FROM backup_jobs WHERE filename IS NOT NULL").all().map(x=>x.slug+"/"+x.filename));}finally{d.close();}
 return apps.filter(a=>a.dbType!=="none").map(a=>{let count=0,totalBytes=0,lastModified=null;
  try{const dir=path.join(ROOT,a.slug),st=fs.lstatSync(dir);if(!st.isDirectory()||st.isSymbolicLink())throw Error("unavailable");
   for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(!e.isFile()||!/[.](sql[.]gz|sqlite([.]gz)?|dump|backup)$/.test(e.name)||registered.has(a.slug+"/"+e.name))continue;const stat=fs.lstatSync(path.join(dir,e.name));count++;totalBytes+=stat.size;const modified=stat.mtime.toISOString();if(!lastModified||modified>lastModified)lastModified=modified;}
   return {slug:a.slug,count,totalBytes,lastModified,status:"metadata_only"};
  }catch{return {slug:a.slug,count:null,totalBytes:null,lastModified:null,status:"unavailable"};}
 });
}
async function download(apps,id){if(!/^[a-f0-9-]{36}$/.test(id))throw Error("ID inválido");const d=db();let x;try{x=d.prepare("SELECT * FROM backup_jobs WHERE id=? AND status='integrity_ok'").get(id);}finally{d.close();}if(!x)throw Error("Backup no registrado");appOf(apps,x.slug);if(!/^[\w.-]+$/.test(x.filename)||!x.filename.startsWith(x.slug+"_"))throw Error("Archivo no permitido");for(const dir of [ROOT,path.join(ROOT,x.slug)]){const st=await fsp.lstat(dir);if(!st.isDirectory()||st.isSymbolicLink())throw Error("Directorio de backup inseguro");}const file=path.join(ROOT,x.slug,x.filename),v=await verify(file);if(v.sha!==x.checksum||v.size!==x.size_bytes)throw Error("Integridad alterada");return {file,name:x.filename,size:v.size};}
function schedules(apps){const d=db();try{const rows=d.prepare("SELECT * FROM backup_schedules").all();return apps.filter(a=>a.dbType!=="none").map(a=>{const r=rows.find(x=>x.slug===a.slug);return {slug:a.slug,name:a.name,protected:protectedProducts.has(a.slug),enabled:!protectedProducts.has(a.slug)&&!!r?.enabled,hourLocal:r?.hour_local??3,weekdays:r?.weekdays??"0,1,2,3,4,5,6",lastRunDay:r?.last_run_day??null};});}finally{d.close();}}
function schedule(apps,slug,cfg,actor){assertMutable(slug);appOf(apps,slug);if(typeof cfg.enabled!=="boolean"||!Number.isInteger(cfg.hourLocal)||cfg.hourLocal<0||cfg.hourLocal>23||typeof cfg.weekdays!=="string"||!/^[0-6](?:,[0-6]){0,6}$/.test(cfg.weekdays)||new Set(cfg.weekdays.split(",")).size!==cfg.weekdays.split(",").length)throw Error("Horario inválido");const d=db();try{d.prepare("INSERT INTO backup_schedules(slug,enabled,hour_local,weekdays,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(slug) DO UPDATE SET enabled=excluded.enabled,hour_local=excluded.hour_local,weekdays=excluded.weekdays,updated_at=excluded.updated_at").run(slug,cfg.enabled?1:0,cfg.hourLocal,cfg.weekdays,new Date().toISOString());d.prepare("INSERT INTO audit_log(timestamp,user,action,target,details) VALUES(?,?,?,?,?)").run(new Date().toISOString(),actor,"BACKUP_SCHEDULE",slug,JSON.stringify(cfg));}finally{d.close();}}
async function tick(apps,now=new Date()){return require("./backup-runner.cjs").tick(apps,now);}

module.exports={snapshotSQLite:sqliteDump,createBackup,list,externalInventory,download,schedules,schedule,tick,verify,db};
