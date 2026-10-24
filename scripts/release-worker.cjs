"use strict";
const fs=require("node:fs"),path=require("node:path");
const {verifyEnvelope,readFile,POLICY}=require("./release-catalog.cjs");
function actorValidator({db,clock=Date.now,publicKeyPath=process.env.HUB_RELEASE_PUBLIC_KEY_PATH}){
 return job=>{
  if(job.created_at+30*60000<=clock()||job.created_at>clock()+5000)return false;
  if(job.actor.startsWith("local-operator:")){
   try{const p=verifyEnvelope(job.payload.operatorApproval,readFile(publicKeyPath,8192));return p.kind==="release"&&p.slug===POLICY.slug&&p.releaseId===job.payload.releaseId&&job.idempotency_key==="release:"+POLICY.slug+":"+p.requestId&&p.actor===job.actor&&Number.isFinite(p.issuedAt)&&Number.isFinite(p.expiresAt)&&p.issuedAt<=clock()+5000&&p.issuedAt>=job.created_at-60000&&p.expiresAt>clock()&&p.expiresAt-p.issuedAt<=30*60000;}catch{return false;}
  }
  const d=db();try{return !!d.prepare("SELECT 1 FROM auth_users WHERE username=? AND active=1 AND role='owner' AND mfa_secret IS NOT NULL").get(job.actor);}finally{d.close();}
 };
}
function createReleaseWorker({store,engine,dataDir=process.env.DATA_DIR||"/app/data"}){
 let working=false;
 function heartbeat(){fs.mkdirSync(dataDir,{recursive:true,mode:0o700});const target=path.join(dataDir,"release-worker-heartbeat");fs.writeFileSync(target+".part",String(Date.now()),{mode:0o600});fs.renameSync(target+".part",target);}
 async function tick(){
  if(working)return;working=true;
  let timer;
  try{
   heartbeat();store.expire();const job=store.claim("release",[POLICY.slug]);if(!job)return;
   let lost=false;
   timer=setInterval(()=>{try{if(!store.heartbeat(job.id,job.lease_owner))lost=true;}catch{lost=true;}},20000);timer.unref();
   try{const result=await engine.execute(job,{leaseValid:()=>!lost});store.finish(job.id,job.lease_owner,result);}
   catch(error){try{store.fail(job.id,job.lease_owner,error.message,{uncertain:lost||!!error.uncertain,retryable:false});}catch{/* Lost leases stay uncertain, never replayed. */}}
  }finally{clearInterval(timer);working=false;}
 }
 return {tick,heartbeat};
}
function production(){
 const dataDir=process.env.DATA_DIR||"/app/data",backup=require("./backup-engine.cjs"),restore=require("./recovery-engine.cjs");
 process.env.HUB_RELEASE_WORKER_INSTANCE=require("node:crypto").randomUUID();fs.mkdirSync(dataDir,{recursive:true,mode:0o700});fs.writeFileSync(path.join(dataDir,"release-worker-instance"),process.env.HUB_RELEASE_WORKER_INSTANCE,{mode:0o600});
 const store=require("./job-store.cjs").createJobStore({dataDir});
 const engine=require("./release-engine.cjs").createReleaseEngine({dataDir,backup,restore,validateActor:actorValidator({db:backup.db})});
 return {worker:createReleaseWorker({store,engine,dataDir}),engine,store};
}
if(require.main===module){const {worker}=production();const pulse=setInterval(()=>{try{worker.heartbeat();}catch{process.exitCode=1;}},5000);pulse.unref();const poll=setInterval(()=>void worker.tick().catch(()=>{process.exitCode=1;}),5000);void worker.tick();process.on("SIGTERM",()=>{clearInterval(poll);clearInterval(pulse);process.exitCode=0;});}
module.exports={actorValidator,createReleaseWorker,production};
