"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),crypto=require("node:crypto"),{DatabaseSync}=require("node:sqlite");
const {createJobStore}=require("./job-store.cjs"),{createRecoveryRunner}=require("./recovery-runner.cjs"),{ensureRestoreSchema}=require("./restore-evidence.cjs");
function fixture(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"hub-restore-jobs-"));let now=Date.now(),allowed=true,calls=0,uncertain=false;
 const store=createJobStore({dataDir:dir,clock:()=>now}),id=crypto.randomUUID(),apps=[{slug:"onlyfood",dbType:"mariadb"}];
 const backup={db:()=>new DatabaseSync(path.join(dir,"hub.sqlite")),download:async()=>({file:"fixture"}),verify:async()=>({sha:"fixture-sha"})};
 const d=backup.db();try{d.exec("CREATE TABLE backup_jobs(id TEXT PRIMARY KEY,slug TEXT,status TEXT,checksum TEXT)");ensureRestoreSchema(d);d.prepare("INSERT INTO backup_jobs VALUES(?,'onlyfood','integrity_ok','fixture-sha')").run(id);}finally{d.close();}
 const engine={checkIsolated:async(a,backupId,actor,metadata)=>{calls++;if(uncertain){const e=Error("cleanup not confirmed");e.uncertain=true;throw e;}const d=backup.db();try{d.prepare("INSERT INTO backup_restore_checks(id,backup_id,slug,checked_at,actor,status,details,checksum,job_id) VALUES('check',?,'onlyfood',? ,?,'passed','fixture','fixture-sha',?)").run(backupId,new Date().toISOString(),actor,metadata.jobId);}finally{d.close();}return {id:"check",status:"passed"};}};
 const runner=createRecoveryRunner({engine,backup,store,validateActor:()=>allowed,enabled:()=>true,dataDir:dir});
 return {dir,id,apps,store,runner,backup,calls:()=>calls,allow:v=>allowed=v,uncertain:()=>uncertain=true,advance:()=>now+=180000,close:()=>fs.rmSync(dir,{recursive:true,force:true})};
}
test("restore queue is idempotent, persists across store instances, and rechecks permission before execution",async()=>{
 const f=fixture();try{
  const key=crypto.randomUUID(),job=f.runner.enqueue(f.apps,f.id,key,"owner");
  assert.equal(f.runner.enqueue(f.apps,f.id,key,"owner").id,job.id);
  assert.equal(createJobStore({dataDir:f.dir}).get(job.id).payload.checksum,"fixture-sha");
  f.allow(false);await f.runner.tick(f.apps);assert.equal(f.calls(),0);assert.equal(f.store.get(job.id).state,"failed");
  assert.throws(()=>f.runner.enqueue([{slug:"onlypadel",dbType:"postgres"}],f.id,crypto.randomUUID(),"owner"),/fuera del alcance/);
 }finally{f.close();}
});
test("restore results carry the durable job ID and never claim an archive was created",async()=>{
 const f=fixture();try{
  const job=f.runner.enqueue(f.apps,f.id,crypto.randomUUID(),"owner");
  const result=await f.runner.tick(f.apps);assert.equal(result[0].status,"restore-passed");assert.equal(f.calls(),1);
  assert.equal(f.store.get(job.id).state,"succeeded");assert.equal(f.store.get(job.id).result.checkId,"check");
 }finally{f.close();}
});
test("interrupted or unclean restore is uncertain and not replayed without matching evidence",async()=>{
 const f=fixture();try{
  f.uncertain();const job=f.runner.enqueue(f.apps,f.id,crypto.randomUUID(),"owner");
  await f.runner.tick(f.apps);assert.equal(f.store.get(job.id).state,"uncertain");
  await f.runner.tick(f.apps);assert.equal(f.calls(),1);
  await assert.rejects(f.runner.reconcile(f.apps,job.id),/No hay evidencia/);
  fs.writeFileSync(path.join(f.dir,"isolated-restore.lock"),"fixture");
  await assert.rejects(f.runner.reconcile(f.apps,job.id),/limpieza requiere revisión/);
  assert.equal(f.store.get(job.id).state,"uncertain");
 }finally{f.close();}
});
test("a worker dying after committed proof can reconcile only that job and the same archive checksum",async()=>{
 const f=fixture();try{
  const job=f.runner.enqueue(f.apps,f.id,crypto.randomUUID(),"owner"),claimed=f.store.claim("restore",["onlyfood"]);
  const d=f.backup.db();try{d.prepare("INSERT INTO backup_restore_checks(id,backup_id,slug,checked_at,actor,status,details,checksum,job_id) VALUES('check',?,'onlyfood',?,'owner','passed','fixture','fixture-sha',?)").run(f.id,new Date().toISOString(),claimed.id);}finally{d.close();}
  f.advance();f.store.expire();assert.equal(f.store.get(job.id).state,"uncertain");
  await f.runner.reconcile(f.apps,job.id);assert.equal(f.store.get(job.id).state,"succeeded");assert.equal(f.calls(),0);
 }finally{f.close();}
});
function scheduledSource(f){
 const schedule={slug:"onlyfood",enabled:true,autoRestore:true,intervalHours:6,hourLocal:3,weekdays:"0,1,2,3,4,5,6"};f.backup.schedules=()=>[schedule];
 const source=f.store.enqueue({kind:"backup",resource:"onlyfood",key:"fixture-scheduled-source",actor:"service:backup-scheduler",payload:{slug:"onlyfood",trigger:"scheduled",restoreAfterBackup:true,configurationHash:require("./backup-schedule.cjs").configurationHash(schedule)}}),claimed=f.store.claim("backup",["onlyfood"]);
 const d=f.backup.db();try{d.prepare("UPDATE backup_jobs SET id=? WHERE id=?").run(source.id,f.id);}finally{d.close();}
 f.store.finish(source.id,claimed.lease_owner,{backupId:source.id,checksum:"fixture-sha"});return {source,schedule};
}
test("automatic restore requires a completed scheduled source, matching bytes and current opt-in",async()=>{
 const f=fixture();try{assert.throws(()=>f.runner.enqueueScheduled(f.apps,f.id),/programado/);const {source}=scheduledSource(f),job=f.runner.enqueueScheduled(f.apps,source.id);assert.equal(f.runner.enqueueScheduled(f.apps,source.id).id,job.id);assert.equal(f.store.get(job.id).actor,"service:backup-restore");f.allow(false);await f.runner.tick(f.apps);assert.equal(f.calls(),1);assert.equal(f.store.get(job.id).state,"succeeded");}finally{f.close();}
});
test("disabling automatic checks after enqueue prevents the pending service job",async()=>{
 const f=fixture();try{const {source,schedule}=scheduledSource(f),job=f.runner.enqueueScheduled(f.apps,source.id);schedule.autoRestore=false;await f.runner.tick(f.apps);assert.equal(f.store.get(job.id).state,"failed");assert.equal(f.calls(),0);}finally{f.close();}
});
test("a service restore cannot use altered source bytes or unrelated backup evidence",async()=>{
 const f=fixture();try{const {source}=scheduledSource(f);const d=f.backup.db();try{d.prepare("UPDATE backup_jobs SET checksum='different' WHERE id=?").run(source.id);}finally{d.close();}assert.throws(()=>f.runner.enqueueScheduled(f.apps,source.id),/agenda cambió/);}finally{f.close();}
});
test("scheduled restore receipts remain idempotent after a human explicit retry",async()=>{
 const f=fixture();try{const {source}=scheduledSource(f),job=f.runner.enqueueScheduled(f.apps,source.id),claimed=f.store.claim("restore",["onlyfood"]);f.store.fail(job.id,claimed.lease_owner,"confirmed fixture failure");f.store.retry(job.id,"owner");assert.equal(f.runner.enqueueScheduled(f.apps,source.id).id,job.id);f.allow(false);await f.runner.tick(f.apps);assert.equal(f.store.get(job.id).state,"failed");assert.equal(f.calls(),0);}finally{f.close();}
});
