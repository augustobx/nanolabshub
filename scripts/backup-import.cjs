"use strict";
const fs=require("node:fs"),fsp=require("node:fs/promises"),path=require("node:path"),crypto=require("node:crypto");
const {pipeline}=require("node:stream/promises"),{Transform}=require("node:stream"),{createGzip,createGunzip}=require("node:zlib");
const ALLOWED=["nanolabshub","onlyfood","onlygym","onlyturn","onlycars"],LIMIT=512*1024**2;
function createBackupImporter({root="/opt/backups",backup=require("./backup-engine.cjs"),recovery=require("./recovery-engine.cjs")}={}){
 function db(){const d=backup.db();d.exec("CREATE TABLE IF NOT EXISTS backup_imports(id TEXT PRIMARY KEY,job_id TEXT NOT NULL,slug TEXT NOT NULL,source_filename TEXT NOT NULL,source_checksum TEXT NOT NULL,archive_checksum TEXT NOT NULL,backup_id TEXT NOT NULL,created_at TEXT NOT NULL,actor TEXT NOT NULL,deduplicated INTEGER NOT NULL)");return d;}
 function appOf(apps,slug){const app=apps.find(a=>a.slug===slug&&["sqlite","mariadb","postgres"].includes(a.dbType));if(!ALLOWED.includes(slug)||!app)throw Error("Aplicación fuera del alcance autorizado de importación");return app;}
 function source(apps,slug,filename){
  const app=appOf(apps,slug);
  if(typeof filename!=="string"||filename.length>180||!/^[_a-zA-Z0-9.-]+$/.test(filename)||filename.startsWith(".")||!/[.](sql[.]gz|dump([.]gz)?|sqlite([.]gz)?)$/.test(filename))throw Error("Formato no admitido: SQLite, SQL gzip o dump PostgreSQL; sin rutas arbitrarias");
  for(const folder of [root,path.join(root,slug)]){const stat=fs.lstatSync(folder);if(!stat.isDirectory()||stat.isSymbolicLink())throw Error("Directorio de importación inseguro");}
  if(app.dbType==="mariadb"&&!filename.endsWith(".sql.gz")||app.dbType==="postgres"&&!/[.](sql[.]gz|dump([.]gz)?)$/.test(filename))throw Error("El formato no corresponde al motor registrado");
  if(app.dbType==="sqlite"&&!/[.]sqlite([.]gz)?$/.test(filename))throw Error("Se requiere una copia SQLite");
  const file=path.join(root,slug,filename),entry=fs.lstatSync(file);
  if(!entry.isFile()||entry.isSymbolicLink()||entry.size<32||entry.size>LIMIT)throw Error("Archivo inseguro, vacío o mayor a 512 MiB");
  const fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
  try{
   // fstat supplies the actual device ID (Node on Windows reports zero for pathname stat).
   const stat=fs.fstatSync(fd);
   if(!stat.isFile()||stat.ino!==entry.ino||stat.size!==entry.size||stat.mtimeMs!==entry.mtimeMs)throw Error("Archivo reemplazado durante la inspección");
   return {app,file,snapshot:{filename,size:stat.size,mtimeMs:stat.mtimeMs,ino:stat.ino,dev:stat.dev}};
  }finally{fs.closeSync(fd);}
 }
 function candidates(apps,slugs=ALLOWED){
  const d=db();let registered;try{registered=new Set(d.prepare("SELECT slug,filename FROM backup_jobs WHERE filename IS NOT NULL").all().map(x=>x.slug+"/"+x.filename));}finally{d.close();}
  return apps.filter(a=>ALLOWED.includes(a.slug)&&slugs.includes(a.slug)).map(app=>{
   try{
    const directory=path.join(root,app.slug),st=fs.lstatSync(directory);if(!st.isDirectory()||st.isSymbolicLink())throw Error("Directorio inseguro");
    const files=fs.readdirSync(directory,{withFileTypes:true}).filter(e=>e.isFile()&&!e.name.startsWith(".")&&/[.](sql[.]gz|sqlite([.]gz)?|dump([.]gz)?|backup)$/.test(e.name)&&!registered.has(app.slug+"/"+e.name)).slice(0,500);
    return {slug:app.slug,status:"available",files:files.map(e=>{try{const s=source(apps,app.slug,e.name);return {...s.snapshot,supported:true,reason:null};}catch{return {filename:e.name,supported:false,reason:"Formato, tamaño o ruta no compatible con este motor"};}})};
   }catch{return {slug:app.slug,status:"unavailable",files:[]};}
  });
 }
 async function importFile(apps,slug,snapshot,actor,{jobId}){
  if(process.env.HUB_BACKUPS_ENABLED!=="true")throw Error("Backups deshabilitados");
  if(!/^[a-f0-9-]{36}$/.test(jobId||""))throw Error("ID de trabajo inválido");
  const s=source(apps,slug,snapshot?.filename);
  if(JSON.stringify(s.snapshot)!==JSON.stringify(snapshot))throw Error("El archivo cambió desde la solicitud; elegí una nueva solicitud");
  const dir=path.join(root,slug),nonce=crypto.randomUUID();
  let filename=slug+"_import_"+jobId+"_"+nonce.slice(0,8)+(s.app.dbType==="sqlite"?".sqlite.gz":".sql.gz");
  const temporary=path.join(dir,"."+filename+".part");let destination=path.join(dir,filename);
  let handle,staged=false;
  const stamp=()=>new Date().toISOString();
  try{
   const disk=await fsp.statfs(dir);if(disk.bavail*disk.bsize<1024**3)throw Error("Se necesita 1 GiB libre para importar");
   handle=await fsp.open(s.file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
   const stat=await handle.stat();if(!stat.isFile()||stat.ino!==snapshot.ino||stat.dev!==snapshot.dev||stat.size!==snapshot.size||stat.mtimeMs!==snapshot.mtimeMs)throw Error("El archivo de origen fue reemplazado");
   const hash=crypto.createHash("sha256");let bytes=0;
   const bounded=new Transform({transform(b,e,cb){bytes+=b.length;hash.update(b);cb(bytes>LIMIT?Error("Archivo mayor a 512 MiB"):null,b);}});
   await pipeline(handle.createReadStream({autoClose:false}),bounded,...(snapshot.filename.endsWith(".gz")?[]:[createGzip()]),fs.createWriteStream(temporary,{flags:"wx",mode:0o600}));
   const after=await handle.stat();if(after.size!==stat.size||after.mtimeMs!==stat.mtimeMs)throw Error("El archivo cambió durante la copia");
   const sourceChecksum=hash.digest("hex"),valid=await backup.verify(temporary,{maxExpandedBytes:LIMIT});
   let header=Buffer.alloc(0),expanded=0;
   await pipeline(fs.createReadStream(temporary),createGunzip(),new Transform({transform(b,e,cb){expanded+=b.length;if(header.length<4096)header=Buffer.concat([header,b.subarray(0,4096-header.length)]);cb(expanded>LIMIT?Error("Copia descomprimida mayor a 512 MiB"):null);}}));
   const customPostgres=s.app.dbType==="postgres"&&header.subarray(0,5).equals(Buffer.from("PGDMP"));
   if(s.app.dbType==="sqlite"?!header.subarray(0,16).equals(Buffer.from("SQLite format 3\0")):s.app.dbType==="postgres"?!customPostgres&&!/PostgreSQL database (?:cluster )?dump/.test(header.toString()):!/(?:MariaDB|MySQL) dump/.test(header.toString()))throw Error("La cabecera no corresponde al motor y formato declarados");
   if(customPostgres){filename=filename.replace(/\.sql\.gz$/,".dump.gz");destination=path.join(dir,filename);}
   const registry=db();let existing;try{existing=registry.prepare("SELECT id FROM backup_jobs WHERE slug=? AND checksum=? AND status='integrity_ok' ORDER BY created_at LIMIT 1").get(slug,valid.sha);}finally{registry.close();}
   let backupId;
   if(existing){
    // A duplicate is accepted only after rechecking the registered physical archive and restoring it.
    await recovery.checkIsolated(apps,existing.id,actor,{jobId});backupId=existing.id;
   }else{
    await fsp.link(temporary,destination); // Fails rather than replacing any existing archive.
    const d=db();try{d.prepare("INSERT INTO backup_jobs(id,slug,db_type,filename,status,created_at,finished_at,size_bytes,checksum,trigger) VALUES(?,?,?,?,'import_testing',?,?,?,?, 'imported') ON CONFLICT(id) DO UPDATE SET filename=excluded.filename,status='import_testing',size_bytes=excluded.size_bytes,checksum=excluded.checksum,error=NULL,finished_at=excluded.finished_at").run(jobId,slug,s.app.dbType,filename,stamp(),stamp(),valid.size,valid.sha);}finally{d.close();}
    staged=true;
    await recovery.checkIsolated(apps,jobId,actor,{jobId,importValidation:true});backupId=jobId;
   }
   const d=db();try{
    d.exec("BEGIN IMMEDIATE");
    try{
     const id=crypto.randomUUID(),at=stamp();
     d.prepare("INSERT INTO backup_imports(id,job_id,slug,source_filename,source_checksum,archive_checksum,backup_id,created_at,actor,deduplicated) VALUES(?,?,?,?,?,?,?,?,?,?)").run(id,jobId,slug,snapshot.filename,sourceChecksum,valid.sha,backupId,at,actor,existing?1:0);
     if(!existing)d.prepare("UPDATE backup_jobs SET status='integrity_ok',finished_at=? WHERE id=? AND status='import_testing'").run(at,jobId);
     d.prepare("INSERT INTO audit_log(timestamp,user,action,target,details) VALUES(?,?,?,?,?)").run(at,actor,"BACKUP_IMPORTED",slug,JSON.stringify({jobId,backupId,checksum:valid.sha,deduplicated:!!existing,originalPreserved:true}));
     d.exec("COMMIT");
     return {backupId,checksum:valid.sha,deduplicated:!!existing,originalPreserved:true};
    }catch(error){d.exec("ROLLBACK");throw error;}
   }finally{d.close();}
  }catch(error){
   if(staged&&!error.uncertain){const d=db();try{d.prepare("UPDATE backup_jobs SET status='failed',error=?,finished_at=? WHERE id=? AND status='import_testing'").run("La importación no aprobó la restauración aislada",stamp(),jobId);}finally{d.close();}}
   throw error;
  }finally{
   await handle?.close();
   // Only a newly created staging link is removed. The original and published copies are preserved.
   await fsp.rm(temporary,{force:true});
  }
 }
 return {db,source,candidates,importFile};
}
let instance;function getImporter(){return instance||(instance=createBackupImporter());}
module.exports={createBackupImporter,getImporter};
