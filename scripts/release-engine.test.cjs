"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),crypto=require("node:crypto");
const {POLICY,hash,runtimeFingerprint,signEnvelope,loadCatalog,createReleasePublic}=require("./release-catalog.cjs"),{createReleaseEngine,escapeCompose}=require("./release-engine.cjs"),{actorValidator,createReleaseWorker}=require("./release-worker.cjs"),{createJobStore}=require("./job-store.cjs");
const prior="sha256:"+"1".repeat(64),target="sha256:"+"2".repeat(64),revision="a".repeat(40);
async function fixture(fn){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"hub-release-")),runtimeDir=path.join(dir,"runtime");fs.mkdirSync(runtimeDir);let now=1800000000000;
 const config={name:POLICY.project,services:{[POLICY.service]:{container_name:POLICY.container,image:prior,environment:{DATA_DIR:dir,HUB_SECRET:'literal $HOME $(id) `never` $$x'}}}};
 const configurationPath=path.join(dir,"compose.private.json");fs.writeFileSync(configurationPath,JSON.stringify(config));
 let current={Id:"old-container",Name:"/nanolabshub",Image:prior,Config:{Env:Object.entries(config.services.nanolabshub.environment).map(([k,v])=>k+"="+v),Labels:{"com.docker.compose.project":POLICY.project,"com.docker.compose.service":POLICY.service,"org.opencontainers.image.revision":revision}},HostConfig:{RestartPolicy:{Name:"unless-stopped"}},Mounts:[],NetworkSettings:{Networks:{}},State:{Running:true,Health:{Status:"healthy"}}};
 const catalog={version:1,...POLICY,expiresAt:now+3600000,configurationSha256:hash(fs.readFileSync(configurationPath)),runtimeFingerprint:runtimeFingerprint(current,Object.keys(config.services.nanolabshub.environment)),environmentKeys:Object.keys(config.services.nanolabshub.environment),releases:[{id:"approved",imageId:target,revision,schemaCompatibility:"additive-only",ci:{headSha:revision,conclusion:"success",runId:123}}]};
 const {privateKey,publicKey}=crypto.generateKeyPairSync("ed25519"),catalogPath=path.join(dir,"catalog.json"),publicKeyPath=path.join(dir,"public.pem");fs.writeFileSync(publicKeyPath,publicKey.export({type:"spki",format:"pem"}));
 function sign(){fs.writeFileSync(catalogPath,JSON.stringify(signEnvelope(catalog,privateKey)));}sign();
 const options={catalogPath,publicKeyPath,clock:()=>now},load=()=>loadCatalog(options),commands=[],applied=[];
 let badTarget=false,badRollback=false,drift=false,restorePassed=true,actorAllowed=true,loseNeighbors=false;
 async function run(args){commands.push(args);
  if(args[0]==="inspect"&&args[1]===POLICY.container)return JSON.stringify([current]);
  if(args[0]==="image")return JSON.stringify([{Id:args[2],Config:{Labels:{"org.opencontainers.image.revision":revision}},RepoTags:["nanolabshub:fixture"]}]);
  if(args[0]==="ps")return "web\nneighbor";
  if(args[0]==="inspect"&&args[1]==="--format")return '"web" "/nanolabshub" "image" "started" true\n"neighbor" "/onlypadel-web" "'+(loseNeighbors?"changed":"unchanged")+'" "started" true';
  if(args[0]==="compose"){
   assert.equal(args.at(-1),POLICY.service);assert(args.includes("--no-deps"));assert(args.includes("--no-build"));assert.equal(args[args.indexOf("--pull")+1],"never");
   const manifest=JSON.parse(fs.readFileSync(args[args.indexOf("-f")+1]));applied.push(manifest);const image=manifest.services.nanolabshub.image;
   current={...current,Id:"new-"+applied.length,Image:image,State:{Running:true,Health:{Status:(image===target?badTarget:badRollback)?"unhealthy":"healthy"}}};if(drift)current.Config.Env.push("HUB_SECRET=changed");return "";
  }
  if(args[0]==="exec")return "";throw Error("Unexpected Docker call: "+args[0]);
 }
 const backup={db:()=>new (require("node:sqlite").DatabaseSync)(path.join(dir,"hub.sqlite")),createBackup:async(apps,slug,trigger,actor,meta)=>{assert.equal(apps.length,1);assert.equal(slug,POLICY.slug);assert.equal(meta.jobId,job.id);return {id:job.id,checksum:"f".repeat(64)};},download:async()=>({file:"fixture"}),verify:async()=>({sha:"f".repeat(64)})};
 const restore={checkIsolated:async()=>({status:restorePassed?"passed":"failed",checksum:"f".repeat(64)})};
 const store=createJobStore({dataDir:dir,clock:()=>now,leaseMs:10000});const pending=store.enqueue({kind:"release",resource:POLICY.slug,key:crypto.randomUUID(),actor:"owner",payload:{releaseId:"approved"},maxAttempts:1}),job=store.claim("release",[POLICY.slug]);
 const engine=createReleaseEngine({run,dataDir:dir,configurationPath,runtimeDir,load,backup,restore,validateActor:()=>actorAllowed,clock:()=>now,sleep:async()=>{},healthAttempts:2});
 try{await fn({dir,engine,job,pending,store,backup,restore,commands,applied,config,catalog,load,options,sign,privateKey,publicKeyPath,run,set:(name,value)=>{if(name==="badTarget")badTarget=value;else if(name==="badRollback")badRollback=value;else if(name==="drift")drift=value;else if(name==="restorePassed")restorePassed=value;else if(name==="actorAllowed")actorAllowed=value;else if(name==="loseNeighbors")loseNeighbors=value;},advance:n=>now+=n,current:()=>current});}finally{fs.rmSync(dir,{recursive:true,force:true});}
}
test("catalog requires an unexpired Ed25519 approval, exact Hub scope and successful CI",()=>fixture(async f=>{
 assert.equal(f.load().releases[0].revision,revision);
 for(const change of [c=>c.slug="onlypadel",c=>c.expiresAt=0,c=>c.releases[0].ci.conclusion="failure",c=>c.releases[0].ci.headSha="b".repeat(40)]){const original=JSON.parse(JSON.stringify(f.catalog));change(f.catalog);f.sign();assert.throws(f.load);Object.assign(f.catalog,original);}
 f.sign();const tampered=JSON.parse(fs.readFileSync(f.options.catalogPath));tampered.payload=Buffer.from('{}').toString('base64');fs.writeFileSync(f.options.catalogPath,JSON.stringify(tampered));assert.throws(f.load,/Firma/);
}));
test("successful release uses only selected service, image ID, isolated backup proof and preserves dollars",()=>fixture(async f=>{
 const result=await f.engine.execute(f.job);assert.equal(result.imageId,target);assert.equal(result.neighborsUnchanged,true);assert.equal(f.applied.length,1);assert.deepEqual(Object.keys(f.applied[0].services),[POLICY.service]);assert.equal(f.applied[0].services.nanolabshub.environment.HUB_SECRET,'literal $$HOME $$(id) `never` $$$$x');assert.equal(fs.existsSync(path.join(f.dir,"release.lock")),false);assert.equal(JSON.parse(fs.readFileSync(path.join(f.dir,"release-"+f.job.id+".json"))).phase,"healthy");
}));
test("failed target returns to exact prior image and never restores production DB",()=>fixture(async f=>{
 f.set("badTarget",true);await assert.rejects(f.engine.execute(f.job),e=>e.rolledBack===true&&!e.uncertain);assert.deepEqual(f.applied.map(x=>x.services.nanolabshub.image),[target,prior]);assert.equal(f.current().Image,prior);assert.equal(fs.existsSync(path.join(f.dir,"release.lock")),false);
}));
test("failed rollback retains lock and uncertain evidence, and cannot be replayed",()=>fixture(async f=>{
 f.set("badTarget",true);f.set("badRollback",true);await assert.rejects(f.engine.execute(f.job),e=>e.uncertain===true);assert.equal(fs.existsSync(path.join(f.dir,"release.lock")),true);await assert.rejects(f.engine.execute(f.job),/bloqueo/);await assert.rejects(f.engine.reconcile({...f.job,state:"uncertain"}),/salud/);
}));
test("restore failure, revocation and manifest drift reject before any Docker mutation",()=>fixture(async f=>{
 f.set("restorePassed",false);await assert.rejects(f.engine.execute(f.job),/restauración/);assert.equal(f.applied.length,0);
 f.set("restorePassed",true);f.set("actorAllowed",false);await assert.rejects(f.engine.execute(f.job),/autorización/);assert.equal(f.applied.length,0);
 f.set("actorAllowed",true);fs.appendFileSync(path.join(f.dir,"compose.private.json")," ");await assert.rejects(f.engine.execute(f.job),/manifiesto/);assert.equal(f.applied.length,0);
}));
test("changed neighbor or runtime configuration never produces a successful release",()=>fixture(async f=>{
 f.set("drift",true);await assert.rejects(f.engine.execute(f.job),e=>e.uncertain===true);assert.equal(fs.existsSync(path.join(f.dir,"release.lock")),true);
}));
test("reconciliation checks current image, health, backup and neighbors against job evidence",()=>fixture(async f=>{
 await f.engine.execute(f.job);const result=await f.engine.reconcile({...f.job,state:"uncertain"});assert.equal(result.state,"succeeded");
 f.set("loseNeighbors",true);await assert.rejects(f.engine.reconcile({...f.job,state:"uncertain"}),/vecino/);
}));
test("a confirmed rollback reconciles failed rather than falsely successful",()=>fixture(async f=>{
 f.set("badTarget",true);await assert.rejects(f.engine.execute(f.job));const result=await f.engine.reconcile({...f.job,state:"uncertain"});assert.equal(result.state,"failed");assert.equal(result.result.rolledBack,true);
}));
test("reconciliation cannot unlock a worker that may still be executing",()=>fixture(async f=>{
 await f.engine.execute(f.job);fs.writeFileSync(path.join(f.dir,"release-worker-instance"),"same-instance");fs.writeFileSync(path.join(f.dir,"release.lock"),JSON.stringify({jobId:f.job.id,instance:"same-instance",finished:false}));
 await assert.rejects(f.engine.reconcile({...f.job,state:"uncertain"}),/seguir activa/);assert.equal(fs.existsSync(path.join(f.dir,"release.lock")),true);
 fs.writeFileSync(path.join(f.dir,"release-worker-instance"),"restarted-instance");assert.equal((await f.engine.reconcile({...f.job,state:"uncertain"})).state,"succeeded");
}));
test("signed operator authorization binds actor, request, release and expiry without impersonating MFA",()=>fixture(async f=>{
 const check=actorValidator({db:()=>{throw Error("No user impersonation");},publicKeyPath:f.publicKeyPath,clock:f.options.clock}),requestId=crypto.randomUUID(),actor="local-operator:authorized-fixture",now=f.options.clock();
 const job={...f.job,actor,idempotency_key:"release:nanolabshub:"+requestId,payload:{releaseId:"approved",operatorApproval:signEnvelope({kind:"release",slug:POLICY.slug,releaseId:"approved",requestId,actor,issuedAt:now,expiresAt:now+60000},f.privateKey)}};
 assert.equal(check(job),true);assert.equal(check({...job,idempotency_key:"release:nanolabshub:other"}),false);assert.equal(check({...job,payload:{...job.payload,releaseId:"other"}}),false);f.advance(60001);assert.equal(check(job),false);
}));
test("public plan reports missing worker, does not pull images, and enqueue is idempotent",()=>fixture(async f=>{
 const service=createReleasePublic({...f.options,dataDir:f.dir,run:f.run});assert.equal((await service.plan()).ready,false);fs.writeFileSync(path.join(f.dir,"release-worker-heartbeat"),String(f.options.clock()));assert.equal((await service.plan()).ready,true);
 const key=crypto.randomUUID(),a=service.enqueue(f.store,"approved",key,"owner");assert.equal(service.enqueue(f.store,"approved",key,"owner").id,a.id);assert.throws(()=>service.enqueue(f.store,"unapproved",key,"owner"));assert(f.commands.every(c=>!c.includes("pull")));
}));
test("independent worker marks failure durably without replaying release jobs",()=>fixture(async f=>{
 // Finish the fixture's already-claimed job, then let the worker claim a distinct one.
 f.store.finish(f.job.id,f.job.lease_owner,{});const job=f.store.enqueue({kind:"release",resource:POLICY.slug,key:crypto.randomUUID(),actor:"owner",payload:{releaseId:"approved"},maxAttempts:1});
 let calls=0;const worker=createReleaseWorker({store:f.store,dataDir:f.dir,engine:{execute:async()=>{calls++;const e=Error("fixture interrupted");e.uncertain=true;throw e;}}});await worker.tick();await worker.tick();assert.equal(calls,1);assert.equal(f.store.get(job.id).state,"uncertain");assert.equal(fs.existsSync(path.join(f.dir,"release-worker-heartbeat")),true);
}));
test("Compose escaping is recursive and retains nonstring values",()=>{assert.deepEqual(escapeCompose({a:['$HOME',7,false,null],b:'$() $$'}),{a:['$$HOME',7,false,null],b:'$$() $$$$'});});
