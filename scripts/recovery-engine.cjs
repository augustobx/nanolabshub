"use strict";
// Copies are opened in a temporary directory; production DB files are never replaced.
const fs=require("node:fs"),fsp=require("node:fs/promises"),path=require("node:path"),crypto=require("node:crypto");
const {pipeline}=require("node:stream/promises"),{Transform}=require("node:stream"),{createGunzip}=require("node:zlib");
const {DatabaseSync}=require("node:sqlite"),backup=require("./backup-engine.cjs");
const {ensureRestoreSchema}=require("./restore-evidence.cjs");
const sandbox=require("./restore-sandbox.cjs").createSandboxRunner();
const LIMIT=512*1024*1024,busy=new Set();
function listChecks(slug){
  const db=backup.db();try{
    ensureRestoreSchema(db);
    return slug?db.prepare("SELECT id,backup_id AS backupId,slug,checked_at AS checkedAt,status,details,checksum,duration_ms AS durationMs FROM backup_restore_checks WHERE slug=? ORDER BY checked_at DESC,rowid DESC LIMIT 150").all(slug):
      db.prepare("SELECT id,backup_id AS backupId,slug,checked_at AS checkedAt,status,details,checksum FROM backup_restore_checks ORDER BY checked_at DESC,rowid DESC LIMIT 250").all();
  }finally{db.close();}
}
function record(id,slug,actor,status,details,checksum,manifest=null,jobId=null,durationMs=null){
  const db=backup.db(),checkedAt=new Date().toISOString(),uid=crypto.randomUUID();
  try{
    ensureRestoreSchema(db);
    db.prepare("INSERT INTO backup_restore_checks(id,backup_id,slug,checked_at,actor,status,details,checksum,manifest,job_id,duration_ms) VALUES(?,?,?,?,?,?,?,?,?,?,?)")
      .run(uid,id,slug,checkedAt,actor,status,details,checksum,manifest?JSON.stringify(manifest):null,jobId,durationMs);
    db.prepare("INSERT INTO audit_log(timestamp,user,action,target,details) VALUES(?,?,?,?,?)")
      .run(checkedAt,actor,status==="passed"?"BACKUP_RESTORE_CHECK_PASSED":"BACKUP_RESTORE_CHECK_FAILED",slug,id);
    return {id:uid,backupId:id,slug,checkedAt,status,details,checksum,durationMs};
  }finally{db.close();}
}
async function checkIsolated(apps,id,actor,metadata={}){
  const started=performance.now(),duration=()=>Math.max(0,Math.round(performance.now()-started));
  if(process.env.HUB_BACKUPS_ENABLED!=="true")throw Error("Backups deshabilitados");
  if(typeof id!=="string"||!/^[a-f0-9-]{36}$/.test(id))throw Error("Identificador inválido");
  if(metadata.jobId&&!/^[a-f0-9-]{36}$/.test(metadata.jobId))throw Error("ID de trabajo inválido");
  if(busy.has(id))throw Error("Ya hay una validación en curso");
  busy.add(id);
  let folder="",slug="",checksum=null,lock=null,lockPath="",retainLock=false;
  try{
    const registry=backup.db();let archive;
    try{archive=registry.prepare("SELECT slug,db_type,checksum FROM backup_jobs WHERE id=? AND (status='integrity_ok' OR (?=1 AND status='import_testing'))").get(id,metadata.importValidation===true?1:0);}finally{registry.close();}
    if(!archive||!["nanolabshub","onlyfood","onlygym","onlyturn"].includes(archive.slug))throw Error("Respaldo fuera del alcance autorizado");
    slug=archive.slug;checksum=archive.checksum;
    const app=apps.find(a=>a.slug===slug&&a.dbType===archive.db_type);
    if(!app)throw Error("El motor registrado no coincide con la aplicación");
    const root=process.env.DATA_DIR||"/app/data";
    await fsp.mkdir(root,{recursive:true,mode:0o700});
    const rootStat=await fsp.lstat(root);if(!rootStat.isDirectory()||rootStat.isSymbolicLink())throw Error("Ruta temporal insegura");
    lockPath=path.join(root,"isolated-restore.lock");
    try{lock=await fsp.open(lockPath,"wx",0o600);}catch{throw Error("Restauración en curso o lock pendiente de revisión; no se inicia otro sandbox");}
    await lock.writeFile(JSON.stringify({pid:process.pid,host:require("node:os").hostname(),jobId:metadata.jobId||null,backupId:id,createdAt:new Date().toISOString()}));
    const b=await backup.download(apps,id,{importValidation:metadata.importValidation===true,maxExpandedBytes:LIMIT}); // Internal staging is never downloadable through HTTP.
    if(b.size>LIMIT)throw Error("El archivo supera el límite de 512 MB");
    if(app.dbType!=="sqlite"){
      const manifest=await sandbox.restore(app,b.file,{format:b.name.endsWith(".dump.gz")?"postgres-custom":"sql"});
      if((await backup.verify(b.file)).sha!==checksum)throw Error("El archivo cambió durante la restauración");
      return record(id,slug,actor,"passed",`${app.dbType}: restauración aislada, ${manifest.tables} tablas y ${manifest.rows} filas. Conteos de la copia restaurada; no comparados con producción. ${manifest.format==="postgres-custom"?"Dump de una base: propietarios y privilegios omitidos en el sandbox. ":""}La aplicación no se inició.`,checksum,manifest,metadata.jobId,duration());
    }
    if(!b.name.endsWith(".sqlite.gz"))throw Error("Extensión SQLite incorrecta");
    await fsp.mkdir(root,{recursive:true,mode:0o700});
    const st=await fsp.lstat(root);
    if(!st.isDirectory()||st.isSymbolicLink())throw Error("Ruta temporal insegura");
    const disk=await fsp.statfs(root);
    if(disk.bavail*disk.bsize<1024**3)throw Error("Se necesita 1 GB libre para la prueba");
    folder=await fsp.mkdtemp(path.join(root,"isolated-restore-"));
    await fsp.chmod(folder,0o700);
    const target=path.join(folder,"snapshot.sqlite");
    let bytes=0;
    const limit=new Transform({transform(buf,enc,cb){
      bytes+=buf.length;cb(bytes>LIMIT?Error("SQLite excede 512 MB descomprimido"):null,buf);
    }});
    await pipeline(fs.createReadStream(b.file),createGunzip(),limit,
      fs.createWriteStream(target,{flags:"wx",mode:0o600}));
    let db;
    try{
      db=new DatabaseSync(target,{readOnly:true});
      const quick=db.prepare("PRAGMA quick_check").get();
      if(!quick||Object.values(quick)[0]!=="ok")throw Error("quick_check falló");
      const integrity=db.prepare("PRAGMA integrity_check").all();
      if(integrity.length!==1||Object.values(integrity[0])[0]!=="ok")throw Error("integrity_check falló");
      if(db.prepare("PRAGMA foreign_key_check").all().length)throw Error("foreign_key_check detectó errores");
      const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(t=>({table:t.name,rows:db.prepare('SELECT count(*) AS n FROM "'+t.name.replaceAll('"','""')+'"').get().n}));
      if((await backup.verify(b.file)).sha!==checksum)throw Error("El archivo cambió durante la restauración");
      return record(id,slug,actor,"passed","Copia SQLite aislada: "+bytes+" bytes, "+tables.length+" tablas; integrity_check=ok; foreign_key_check=0. Conteos de la copia; sin comparación con producción. No se inició la app.",checksum,{engine:"sqlite",bytes,tables,comparison:"restored-copy-only",applicationStarted:false},metadata.jobId,duration());
    }finally{db?.close();}
  }catch(err){
    retainLock=!!err.uncertain;
    if(slug)record(id,slug,actor,"failed",(err instanceof Error?err.message:"Error de prueba").slice(0,220),checksum,null,metadata.jobId,duration());
    throw err;
  }finally{
    if(folder)await fsp.rm(folder,{recursive:true,force:true}).catch(()=>{});
    if(lock){await lock.close();if(!retainLock)await fsp.rm(lockPath,{force:true});}
    busy.delete(id);
  }
}
module.exports={listChecks,checkIsolated};
