"use strict";
const fs=require("node:fs"),path=require("node:path");
const ALLOWED=["nanolabshub","onlyfood","onlygym","onlyturn"];
function createRecoveryRunner({engine,backup,store,validateActor,enabled=()=>process.env.HUB_BACKUPS_ENABLED==="true",dataDir=process.env.DATA_DIR||"/app/data"}){
 function archive(apps,id){
  if(typeof id!=="string"||!/^[a-f0-9-]{36}$/.test(id))throw Error("ID de respaldo inválido");
  const db=backup.db();let row;try{row=db.prepare("SELECT slug,checksum FROM backup_jobs WHERE id=? AND status='integrity_ok'").get(id);}finally{db.close();}
  if(!row||!ALLOWED.includes(row.slug)||!apps.some(a=>a.slug===row.slug&&a.dbType!=="none"))throw Error("Respaldo fuera del alcance autorizado");
  return row;
 }
 function enqueue(apps,id,requestId,actor){
  if(!enabled())throw Error("Backups deshabilitados");
  if(typeof requestId!=="string"||!/^[a-f0-9-]{36}$/.test(requestId))throw Error("ID de solicitud inválido");
  const row=archive(apps,id);
  return store.enqueue({kind:"restore",resource:row.slug,key:requestId,payload:{backupId:id,checksum:row.checksum},actor,maxAttempts:1});
 }
 async function reconcile(apps,id){
  const job=store.get(id);if(!job||job.kind!=="restore"||job.state!=="uncertain")throw Error("El trabajo no requiere reconciliación");
  archive(apps,job.payload.backupId);
  if(fs.existsSync(path.join(dataDir,"isolated-restore.lock")))throw Error("La limpieza requiere revisión; se conserva el bloqueo");
  const db=backup.db();let check;
  try{require("./restore-evidence.cjs").ensureRestoreSchema(db);check=db.prepare("SELECT id,status,checksum FROM backup_restore_checks WHERE job_id=? AND backup_id=? ORDER BY rowid DESC LIMIT 1").get(id,job.payload.backupId);}finally{db.close();}
  if(check?.status!=="passed"||check.checksum!==job.payload.checksum)throw Error("No hay evidencia aprobada de este trabajo");
  const file=await backup.download(apps,job.payload.backupId);
  if((await backup.verify(file.file)).sha!==check.checksum)throw Error("El archivo cambió después de la prueba");
  return store.reconcile(id,{result:{checkId:check.id,backupId:job.payload.backupId},evidence:"Restauración aprobada por este trabajo, limpieza confirmada y SHA-256 verificado otra vez"});
 }
 async function tick(apps){
  if(!enabled())return [];
  store.expire();
  const job=store.claim("restore",ALLOWED);if(!job)return [];
  let heartbeatLost=false;
  const timer=setInterval(()=>{try{if(!store.heartbeat(job.id,job.lease_owner))heartbeatLost=true;}catch{heartbeatLost=true;}},20000);timer.unref();
  try{
   const row=archive(apps,job.payload.backupId);
   if(row.slug!==job.resource||row.checksum!==job.payload.checksum)throw Error("El archivo registrado cambió desde la solicitud");
   if(!validateActor(job.actor,job.resource))throw Error("El actor ya no tiene permiso para esta restauración aislada");
   const result=await engine.checkIsolated(apps,job.payload.backupId,job.actor,{jobId:job.id});
   store.finish(job.id,job.lease_owner,{checkId:result.id,backupId:job.payload.backupId,status:result.status});
   return [{slug:job.resource,status:"restore-passed",id:job.id}];
  }catch(error){
   const uncertain=heartbeatLost||!!error.uncertain;
   try{store.fail(job.id,job.lease_owner,uncertain?"Restauración interrumpida; revisar sandbox y evidencia antes de repetir":"La restauración aislada no fue aprobada; consultar el historial",{uncertain,retryable:false});}catch{/* Lease lost: preserve uncertain state. */}
   return [{slug:job.resource,status:uncertain?"uncertain":"restore-failed",id:job.id}];
  }finally{clearInterval(timer);}
 }
 return {enqueue,tick,reconcile,store};
}
let instance;
function getRunner(){
 if(instance)return instance;
 const backup=require("./backup-engine.cjs"),engine=require("./recovery-engine.cjs");
 const store=require("./job-store.cjs").createJobStore({dataDir:process.env.DATA_DIR||"/app/data"});
 const validateActor=(actor,slug)=>{const db=backup.db();try{const user=db.prepare("SELECT role,scopes FROM auth_users WHERE username=? AND active=1 AND mfa_secret IS NOT NULL").get(actor);return !!user&&(user.role==="owner"||user.role==="operator"&&JSON.parse(user.scopes).includes(slug));}finally{db.close();}};
 instance=createRecoveryRunner({engine,backup,store,validateActor});return instance;
}
module.exports={createRecoveryRunner,getRunner};
