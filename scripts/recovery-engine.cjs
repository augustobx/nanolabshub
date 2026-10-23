"use strict";
// Copies are opened in a temporary directory; production DB files are never replaced.
const fs=require("node:fs"),fsp=require("node:fs/promises"),path=require("node:path"),crypto=require("node:crypto");
const {pipeline}=require("node:stream/promises"),{Transform}=require("node:stream"),{createGunzip}=require("node:zlib");
const {DatabaseSync}=require("node:sqlite"),backup=require("./backup-engine.cjs");
const LIMIT=512*1024*1024,busy=new Set();
const SCHEMA="CREATE TABLE IF NOT EXISTS backup_restore_checks (id TEXT PRIMARY KEY,backup_id TEXT NOT NULL,slug TEXT NOT NULL,checked_at TEXT NOT NULL,actor TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('passed','failed')),details TEXT NOT NULL)";
function listChecks(slug){
  const db=backup.db();try{
    db.exec(SCHEMA);
    return slug?db.prepare("SELECT id,backup_id AS backupId,slug,checked_at AS checkedAt,status,details FROM backup_restore_checks WHERE slug=? ORDER BY checked_at DESC LIMIT 150").all(slug):
      db.prepare("SELECT id,backup_id AS backupId,slug,checked_at AS checkedAt,status,details FROM backup_restore_checks ORDER BY checked_at DESC LIMIT 250").all();
  }finally{db.close();}
}
function record(id,slug,actor,status,details){
  const db=backup.db(),checkedAt=new Date().toISOString(),uid=crypto.randomUUID();
  try{
    db.exec(SCHEMA);
    db.prepare("INSERT INTO backup_restore_checks(id,backup_id,slug,checked_at,actor,status,details) VALUES(?,?,?,?,?,?,?)")
      .run(uid,id,slug,checkedAt,actor,status,details);
    db.prepare("INSERT INTO audit_log(timestamp,user,action,target,details) VALUES(?,?,?,?,?)")
      .run(checkedAt,actor,status==="passed"?"BACKUP_SQLITE_CHECK_PASSED":"BACKUP_SQLITE_CHECK_FAILED",slug,id);
    return {id:uid,backupId:id,slug,checkedAt,status,details};
  }finally{db.close();}
}
async function checkIsolated(apps,id,actor){
  if(process.env.HUB_BACKUPS_ENABLED!=="true")throw Error("Backups deshabilitados");
  if(typeof id!=="string"||!/^[a-f0-9-]{36}$/.test(id))throw Error("Identificador inválido");
  if(busy.has(id))throw Error("Ya hay una validación en curso");
  busy.add(id);
  let folder="",slug="";
  try{
    const b=await backup.download(apps,id); // Rechecks checksum and gzip integrity.
    if(!b.name.endsWith(".sqlite.gz"))throw Error("La comprobación aislada solo está habilitada para SQLite");
    slug=b.name.split("_")[0];
    if(!apps.some(a=>a.slug===slug&&a.dbType==="sqlite"))throw Error("La aplicación no está registrada como SQLite");
    if(b.size>LIMIT)throw Error("El archivo supera el límite de 512 MB");
    const root=process.env.DATA_DIR||"/app/data";
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
      const tables=db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table'").get().n;
      return record(id,slug,actor,"passed","Copia SQLite aislada: "+bytes+" bytes, "+tables+" tablas; integrity_check=ok; foreign_key_check=0. No se inició la app.");
    }finally{db?.close();}
  }catch(err){
    if(slug)record(id,slug,actor,"failed",(err instanceof Error?err.message:"Error de prueba").slice(0,220));
    throw err;
  }finally{
    if(folder)await fsp.rm(folder,{recursive:true,force:true}).catch(()=>{});
    busy.delete(id);
  }
}
module.exports={listChecks,checkIsolated};
