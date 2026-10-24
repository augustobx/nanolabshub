"use strict";
const fs=require("node:fs"),path=require("node:path"),{ensureRestoreSchema}=require("./restore-evidence.cjs");
const ALLOWED=["nanolabshub","onlyfood","onlygym","onlyturn"];
function createImportRunner({importer,backup,store,validateActor,enabled=()=>process.env.HUB_BACKUPS_ENABLED==="true",dataDir=process.env.DATA_DIR||"/app/data"}){
 function enqueue(apps,slug,filename,requestId,actor){
  if(!enabled())throw Error("Backups deshabilitados");
  if(typeof requestId!=="string"||!/^[a-f0-9-]{36}$/.test(requestId))throw Error("ID de solicitud inválido");
  const snapshot=importer.source(apps,slug,filename).snapshot;
  return store.enqueue({kind:"backup-import",resource:slug,key:requestId,payload:{snapshot},actor,maxAttempts:1});
 }
 async function reconcile(apps,id){
  const job=store.get(id);if(!job||job.kind!=="backup-import"||job.state!=="uncertain"||!ALLOWED.includes(job.resource))throw Error("El trabajo no requiere reconciliación");
  if(fs.existsSync(path.join(dataDir,"isolated-restore.lock")))throw Error("La limpieza requiere revisión; se conserva el bloqueo");
  const d=importer.db();let imported,check;
  try{ensureRestoreSchema(d);imported=d.prepare("SELECT backup_id,archive_checksum,deduplicated FROM backup_imports WHERE job_id=? AND slug=? ORDER BY rowid DESC LIMIT 1").get(id,job.resource);if(imported)check=d.prepare("SELECT status,checksum FROM backup_restore_checks WHERE job_id=? AND backup_id=? ORDER BY rowid DESC LIMIT 1").get(id,imported.backup_id);}finally{d.close();}
  if(!imported||check?.status!=="passed"||check.checksum!==imported.archive_checksum)throw Error("No hay evidencia completa de importación y restauración de este trabajo");
  const file=await backup.download(apps,imported.backup_id);
  if((await backup.verify(file.file)).sha!==imported.archive_checksum)throw Error("La copia registrada cambió");
  return store.reconcile(id,{result:{backupId:imported.backup_id,checksum:imported.archive_checksum,deduplicated:!!imported.deduplicated,originalPreserved:true},evidence:"Importación y restauración del mismo trabajo confirmadas; limpieza sin lock y archivo SHA-256 verificado"});
 }
 async function tick(apps){
  if(!enabled())return [];
  store.expire();const job=store.claim("backup-import",ALLOWED);if(!job)return [];
  let lost=false;
  const timer=setInterval(()=>{try{if(!store.heartbeat(job.id,job.lease_owner))lost=true;}catch{lost=true;}},20000);timer.unref();
  try{
   if(!validateActor(job.actor,job.resource))throw Error("El actor ya no tiene permiso para importar esta copia");
   const result=await importer.importFile(apps,job.resource,job.payload.snapshot,job.actor,{jobId:job.id});
   store.finish(job.id,job.lease_owner,result);
   return [{slug:job.resource,status:"import-passed",id:job.id}];
  }catch(error){
   const uncertain=lost||!!error.uncertain;
   try{store.fail(job.id,job.lease_owner,uncertain?"Importación interrumpida; revisar evidencia y sandbox antes de repetir":"Importación rechazada: "+String(error.message).slice(0,210),{uncertain,retryable:false});}catch{/* Preserve a lost lease for review. */}
   return [{slug:job.resource,status:uncertain?"uncertain":"import-failed",id:job.id}];
  }finally{clearInterval(timer);}
 }
 return {enqueue,tick,reconcile};
}
let instance;
function getRunner(){
 if(instance)return instance;
 const importer=require("./backup-import.cjs").getImporter(),backup=require("./backup-engine.cjs"),store=require("./job-store.cjs").createJobStore({dataDir:process.env.DATA_DIR||"/app/data"});
 function validateActor(actor,slug){const d=backup.db();try{const user=d.prepare("SELECT role,scopes FROM auth_users WHERE username=? AND active=1 AND mfa_secret IS NOT NULL").get(actor);return !!user&&(user.role==="owner"||user.role==="operator"&&JSON.parse(user.scopes).includes(slug));}finally{d.close();}}
 instance=createImportRunner({importer,backup,store,validateActor});return instance;
}
module.exports={createImportRunner,getRunner};
