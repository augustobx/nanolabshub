"use strict";
const {createJobStore}=require("./job-store.cjs");
const {latestSlot,configurationHash}=require("./backup-schedule.cjs");
const ALLOWED=["nanolabshub","onlyfood","onlygym","onlyturn"];
function createBackupRunner({engine,store,enabled=()=>process.env.HUB_BACKUPS_ENABLED==="true",validateActor,enqueueRestore=()=>{}}){
  function permitted(apps,slug){if(!ALLOWED.includes(slug)||!apps.some(a=>a.slug===slug&&a.dbType!=="none"))throw Error("Aplicación fuera del alcance autorizado de backups");}
  function enqueue(apps,slug,requestId,actor){permitted(apps,slug);if(!enabled())throw Error("Backups deshabilitados");if(typeof requestId!=="string"||!/^[a-f0-9-]{36}$/.test(requestId))throw Error("ID de solicitud inválido");return store.enqueue({kind:"backup",resource:slug,key:"manual:"+requestId,payload:{slug,trigger:"manual"},actor});}
  function markSchedule(job){const d=engine.db();try{d.prepare("UPDATE backup_schedules SET last_run_day=? WHERE slug=? AND (last_run_day IS NULL OR last_run_day<?)").run(job.payload.day,job.resource,job.payload.day);if(job.payload.slotKey)d.prepare("UPDATE backup_schedules SET last_run_slot=? WHERE slug=? AND (last_run_slot IS NULL OR last_run_slot<?)").run(job.payload.slotKey,job.resource,job.payload.slotKey);}finally{d.close();}}
  async function reconcile(apps,id){
    const job=store.get(id);if(!job||job.kind!=="backup"||job.state!=="uncertain")throw Error("El trabajo no requiere reconciliación");permitted(apps,job.resource);
    const d=engine.db();let record;try{record=d.prepare("SELECT * FROM backup_jobs WHERE id=? AND slug=? AND status='integrity_ok'").get(id,job.resource);}finally{d.close();}
    if(!record)throw Error("No hay un resultado confirmado; se conserva el bloqueo para no duplicar una ejecución incierta");
    const file=await engine.download(apps,id);
    return store.reconcile(id,{result:{backupId:id,filename:file.name,checksum:record.checksum},evidence:"Archivo registrado por este trabajo; gzip, tamaño y SHA-256 comprobados de nuevo"});
  }
  async function tick(apps,now=new Date()){
    if(!enabled())return [];
    const result=[];
    const schedules=engine.schedules(apps).filter(s=>ALLOWED.includes(s.slug));
    for(const s of schedules.filter(s=>s.enabled)){
      const slot=latestSlot(s,now);if(!slot)continue;
      if(slot.legacy&&s.lastRunDay===slot.day){const d=engine.db();let succeeded;try{const start=slot.day+"T03:00:00.000Z",end=new Date(Date.parse(start)+86400000).toISOString();succeeded=d.prepare("SELECT 1 FROM backup_jobs WHERE slug=? AND trigger='scheduled' AND status='integrity_ok' AND created_at>=? AND created_at<? LIMIT 1").get(s.slug,start,end);}finally{d.close();}if(succeeded)continue;}
      const payload=slot.legacy?{slug:s.slug,trigger:"scheduled",day:slot.day}:{slug:s.slug,trigger:"scheduled",day:slot.day,slotKey:slot.slotKey,intervalHours:slot.intervalHours,configurationHash:slot.configurationHash,restoreAfterBackup:slot.restoreAfterBackup};
      const existing=store.byKey("backup",s.slug,slot.key);if(existing&&JSON.stringify(existing.payload)!==JSON.stringify(payload))throw Error("Conflicto de idempotencia de agenda");
      const j=existing||store.enqueue({kind:"backup",resource:s.slug,key:slot.key,payload,actor:slot.legacy?"scheduler":"service:backup-scheduler"});
      if(j.state==="succeeded"){markSchedule(j);if(j.payload.restoreAfterBackup)enqueueRestore(apps,j.id);}
    }
    store.expire();
    for(const j of store.list().filter(j=>j.kind==="backup"&&j.state==="uncertain")){try{await reconcile(apps,j.id);result.push({slug:j.resource,status:"reconciled",id:j.id});}catch{/* No proof means the uncertain job remains blocked. */}}
    const job=store.claim("backup",apps.filter(a=>ALLOWED.includes(a.slug)&&a.dbType!=="none").map(a=>a.slug));
    if(!job)return result;
    let heartbeatLost=false;
    const timer=setInterval(()=>{try{if(!store.heartbeat(job.id,job.lease_owner))heartbeatLost=true;}catch{heartbeatLost=true;}},20000);timer.unref();
    try{
      permitted(apps,job.resource);
      if(job.payload.trigger==="scheduled"){
        const active=schedules.find(s=>s.slug===job.resource&&s.enabled);
        if(!active||job.payload.configurationHash&&job.payload.configurationHash!==configurationHash(active)||!job.payload.configurationHash&&((active.intervalHours??24)!==24||active.autoRestore))throw Error("Agenda deshabilitada o modificada antes de ejecutar");
        const explicitRetry=store.events(job.id).some(e=>e.state==="pending"&&e.details.startsWith("Reintento explícito por "));
        if(explicitRetry&&!validateActor(job.actor,job.resource))throw Error("El actor ya no tiene permiso para reintentar este respaldo");
      }else if(!validateActor(job.actor,job.resource))throw Error("El actor ya no tiene permiso para este respaldo");
      const archive=await engine.createBackup(apps,job.resource,job.payload.trigger,job.actor,{jobId:job.id});
      // The engine has already persisted the archive and its integrity evidence.
      store.finish(job.id,job.lease_owner,{backupId:archive.id,filename:archive.filename,checksum:archive.checksum});
      if(job.payload.trigger==="scheduled"){
        markSchedule(job);
        if(job.payload.restoreAfterBackup)try{enqueueRestore(apps,job.id);}catch{result.push({slug:job.resource,status:"restore-enqueue-pending",id:job.id});}
      }
      result.push({slug:job.resource,status:"ok",id:job.id});
    }catch(error){
      const uncertain=heartbeatLost||!!error.uncertain;
      // Locks are never removed or inferred stale by this worker.
      const retryable=!uncertain&&!/proteg|permiso|deshabilitad|inválid|no registrada|lock pendiente/i.test(error.message);
      try{store.fail(job.id,job.lease_owner,uncertain?"Resultado incierto; se requiere reconciliación antes de repetir":"Falló el respaldo; consultar evidencia del trabajo",{uncertain,retryable});}catch{/* A lost lease remains uncertain and cannot be replayed. */}
      result.push({slug:job.resource,status:uncertain?"uncertain":"failed",id:job.id});
    }finally{clearInterval(timer);}
    return result;
  }
  return {enqueue,tick,reconcile,store};
}
let instance;
function getRunner(){
  if(instance)return instance;
  const engine=require("./backup-engine.cjs"),dataDir=process.env.DATA_DIR||"/app/data";
  const store=createJobStore({dataDir});
  function validateActor(actor,slug){const d=engine.db();try{if(!d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='auth_users'").get())return false;const u=d.prepare("SELECT role,scopes FROM auth_users WHERE username=? AND active=1 AND mfa_secret IS NOT NULL").get(actor);return !!u&&(u.role==="owner"||u.role==="operator"&&JSON.parse(u.scopes).includes(slug));}finally{d.close();}}
  instance=createBackupRunner({engine,store,validateActor,enqueueRestore:(apps,id)=>require("./recovery-runner.cjs").getRunner().enqueueScheduled(apps,id)});return instance;
}
module.exports={createBackupRunner,getRunner,tick:(...args)=>getRunner().tick(...args)};
