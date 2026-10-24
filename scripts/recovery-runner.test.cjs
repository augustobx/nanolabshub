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
