"use strict";
// The outer process mounts only this checkout and its own mkdtemp fixture.
// The inner process owns the fixture's Docker project and never selects production resources.
const fs=require("node:fs"),path=require("node:path"),os=require("node:os"),crypto=require("node:crypto"),assert=require("node:assert/strict"),{execFileSync}=require("node:child_process");
const {docker,hash,runtimeFingerprint,POLICY}=require("./release-catalog.cjs");
async function main(){
 if(process.env.HUB_RELEASE_FIXTURE_INNER!=="true"){
  if(process.platform!=="linux")throw Error("Docker sandbox smoke requires Linux");
  const image=process.env.HUB_RELEASE_FIXTURE_IMAGE;if(!/^nanolabshub:[a-z0-9-]+$/.test(image||""))throw Error("Explicit local fixture image required");
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"hub-release-qa-"));fs.writeFileSync(path.join(root,".owned-release-fixture"),"release-smoke");
  const code=path.resolve(__dirname,".."),name="hub-release-qa-runner-"+crypto.randomBytes(5).toString("hex");
  try{
   execFileSync("docker",["run","--rm","--name",name,"--label","nanohub.qa=release","--network","none","--read-only","--cap-drop","ALL","--cap-add","DAC_OVERRIDE","--cap-add","CHOWN","--security-opt","no-new-privileges","--tmpfs","/tmp:rw,nosuid,nodev,size=256m","--tmpfs","/opt/backups:rw,nosuid,nodev,size=2g","-v","/var/run/docker.sock:/var/run/docker.sock","-v",code+":/qa:ro","-v",root+":"+root,"-e","HUB_RELEASE_FIXTURE_INNER=true","-e","HUB_RELEASE_FIXTURE_ROOT="+root,"-e","HUB_RELEASE_FIXTURE_IMAGE="+image,"--entrypoint","node",image,"/qa/scripts/release-sandbox-smoke.cjs"],{stdio:"inherit",timeout:300000});
  }finally{
   const names=execFileSync("docker",["ps","-aq","--filter","name=^/"+name+"$"],{encoding:"utf8"}).trim();if(names)execFileSync("docker",["rm","-f",names],{stdio:"ignore"});
   if(root.startsWith(os.tmpdir()+path.sep)&&fs.readFileSync(path.join(root,".owned-release-fixture"),"utf8")==="release-smoke")fs.rmSync(root,{recursive:true,force:true});
  }return;
 }
 const root=process.env.HUB_RELEASE_FIXTURE_ROOT;if(!root?.startsWith("/tmp/hub-release-qa-")||fs.readFileSync(path.join(root,".owned-release-fixture"),"utf8")!=="release-smoke")throw Error("Unowned sandbox");
 process.env.DATA_DIR=path.join(root,"data");process.env.HUB_BACKUPS_ENABLED="true";fs.mkdirSync(process.env.DATA_DIR);fs.mkdirSync(path.join(root,"runtime"));
 const prefix="nanohub-qa-"+crypto.randomBytes(6).toString("hex"),policy={...POLICY,project:prefix,service:prefix,container:prefix,imageRepository:prefix},neighbor=prefix+"-neighbor",images=[];
 const {DatabaseSync}=require("node:sqlite"),db=new DatabaseSync(path.join(process.env.DATA_DIR,"hub.sqlite"));db.exec("CREATE TABLE fixture(id INTEGER PRIMARY KEY,value TEXT); INSERT INTO fixture(value) VALUES('first'),('second');");db.close();
 fs.writeFileSync(path.join(root,"server.cjs"),"require('http').createServer((q,s)=>{s.statusCode=q.url==='/api/health'?(process.env.FIXTURE_STATE==='bad'?503:200):401;s.end('fixture');}).listen(3000,'0.0.0.0');");
 const revision="a".repeat(40),base=process.env.HUB_RELEASE_FIXTURE_IMAGE;
 async function image(state){const tag=prefix+":"+state;fs.writeFileSync(path.join(root,"Dockerfile"),`FROM ${base}\nLABEL org.opencontainers.image.revision=${revision}\nENV FIXTURE_STATE=${state}\n`);await docker(["build","--network","none","-t",tag,"-f",path.join(root,"Dockerfile"),root],{timeout:90000});images.push(tag);return JSON.parse(await docker(["image","inspect",tag]))[0].Id;}
 let before;
 try{
  const prior=await image("prior"),target=await image("target"),bad=await image("bad");
  const config={name:prefix,services:{[prefix]:{container_name:prefix,image:prior,network_mode:"none",restart:"no",environment:{DATA_DIR:process.env.DATA_DIR,SECRET_LITERAL:'$HOME $(id) `literal` $$value'},volumes:[{type:"bind",source:path.join(root,"server.cjs"),target:"/fixture.cjs",read_only:true},{type:"bind",source:process.env.DATA_DIR,target:process.env.DATA_DIR}],entrypoint:["node","/fixture.cjs"],healthcheck:{test:["CMD","node","-e","fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"],interval:"1s",timeout:"2s",retries:1},logging:{driver:"json-file",options:{"max-size":"1m","max-file":"1"}}}}};
  const configurationPath=path.join(root,"compose.private.json"),initial=path.join(root,"initial.json"),{escapeCompose,createReleaseEngine}=require("./release-engine.cjs");fs.writeFileSync(configurationPath,JSON.stringify(config));fs.writeFileSync(initial,JSON.stringify(escapeCompose(config)));
  await docker(["run","-d","--name",neighbor,"--label","nanohub.qa=release","--network","none","--entrypoint","node",base,"-e","setInterval(()=>{},10000)"]);
  await docker(["compose","--project-name",prefix,"-f",initial,"up","-d","--no-build","--pull","never",prefix]);
  for(let i=0;i<30;i++){const c=JSON.parse(await docker(["inspect",prefix]))[0];if(c.State.Health.Status==="healthy")break;await new Promise(r=>setTimeout(r,1000));}
  before=JSON.parse(await docker(["inspect",prefix]))[0];assert.equal(before.State.Health.Status,"healthy");
  const catalog={configurationSha256:hash(fs.readFileSync(configurationPath)),runtimeFingerprint:runtimeFingerprint(before,Object.keys(config.services[prefix].environment)),environmentKeys:Object.keys(config.services[prefix].environment),releases:[{id:"good",imageId:target,revision},{id:"bad",imageId:bad,revision}]};
  const backup=require("./backup-engine.cjs"),restore=require("./recovery-engine.cjs"),engine=createReleaseEngine({policy,dataDir:process.env.DATA_DIR,configurationPath,runtimeDir:path.join(root,"runtime"),load:()=>catalog,backup,restore,validateActor:()=>true,healthAttempts:6});
  const good={id:crypto.randomUUID(),kind:"release",resource:policy.slug,actor:"fixture",payload:{releaseId:"good"}};
  const result=await engine.execute(good);assert.equal(result.imageId,target);assert.equal(result.neighborsUnchanged,true);
  const failure={...good,id:crypto.randomUUID(),payload:{releaseId:"bad"}};await assert.rejects(engine.execute(failure),e=>e.rolledBack===true&&!e.uncertain);
  const final=JSON.parse(await docker(["inspect",prefix]))[0];assert.equal(final.Image,target);assert.equal(final.State.Health.Status,"healthy");assert.equal(final.Config.Env.find(e=>e.startsWith("SECRET_LITERAL=")),"SECRET_LITERAL=$HOME $(id) `literal` $$value");
  // Only this fixture namespace is eligible. Simulated age exercises the
  // seven-day rule without changing the server clock or production policy.
  const unused=await image("unused");catalog.releases.push({id:"rollback-pin",imageId:prior,revision});
  const maintenance=require("./image-maintenance.cjs").createImageMaintenance({policy,dataDir:process.env.DATA_DIR,load:()=>catalog,clock:()=>Date.now()+8*86400000,validateActor:()=>true,db:backup.db});
  const candidates=await maintenance.inventory();assert.deepEqual(candidates.map(i=>i.imageId),[unused]);
  const cleanup=await maintenance.execute({id:crypto.randomUUID(),kind:"maintenance",resource:policy.slug,actor:"synthetic-qa-owner",payload:{images:[{imageId:unused,tag:prefix+":unused"}]}});
  assert.equal(cleanup.removed.length,1);assert.equal(cleanup.volumesDeleted,0);assert.equal(JSON.parse(await docker(["image","inspect",prior]))[0].Id,prior);
  const apps=[{slug:policy.slug,name:"Hub QA",dbType:"sqlite",sqlitePath:path.join(process.env.DATA_DIR,"hub.sqlite"),containerNames:[prefix]}],hour=Number(new Intl.DateTimeFormat("en-GB",{timeZone:"America/Argentina/Buenos_Aires",hour:"2-digit",hourCycle:"h23"}).format(new Date()));
  backup.schedule(apps,policy.slug,{enabled:true,hourLocal:hour%6,intervalHours:6,autoRestore:true,weekdays:"0,1,2,3,4,5,6"},"qa-synthetic-owner");
  const store=require("./job-store.cjs").createJobStore({dataDir:process.env.DATA_DIR}),recoveryRunner=require("./recovery-runner.cjs").createRecoveryRunner({engine:restore,backup,store,validateActor:()=>false,dataDir:process.env.DATA_DIR}),backupRunner=require("./backup-runner.cjs").createBackupRunner({engine:backup,store,validateActor:()=>false,enqueueRestore:(a,id)=>recoveryRunner.enqueueScheduled(a,id)});
  const historyDb=backup.db();try{historyDb.exec("CREATE TABLE metrics_history(id INTEGER); INSERT INTO metrics_history VALUES(1); CREATE TABLE app_lifecycle_events(id INTEGER); INSERT INTO app_lifecycle_events VALUES(1)");}finally{historyDb.close();}
  const cycleNow=new Date();await backupRunner.tick(apps,cycleNow);await backupRunner.tick(apps,cycleNow);await recoveryRunner.tick(apps);
  assert.equal(store.list().length,2);assert(store.list().every(j=>j.state==="succeeded"));assert.equal(store.list().filter(j=>j.kind==="backup").length,1);
  const retention=await require("/app/scripts/history-retention.cjs").createRetentionReport()(apps);assert.equal(retention.recovery.status,"passed");assert.equal(retention.policy.automaticDeletion,false);assert.equal(retention.recovery.tables.find(t=>t.table==="metrics_history").rows,1);
  const source=new DatabaseSync(path.join(process.env.DATA_DIR,"hub.sqlite"),{readOnly:true});try{assert.equal(source.prepare("SELECT COUNT(*) AS n FROM fixture").get().n,2);assert.equal(source.prepare("SELECT COUNT(*) AS n FROM backup_restore_checks WHERE status='passed'").get().n,3);assert.equal(source.prepare("SELECT COUNT(*) AS n FROM backup_restore_checks WHERE duration_ms IS NOT NULL").get().n,3);}finally{source.close();}
  console.log(JSON.stringify({sandbox:true,forwardPassed:true,rollbackPassed:true,backupsRestored:3,scheduledCyclePassed:true,literalEnvironmentPreserved:true,neighborsUnchanged:true,temporaryImagesRemoved:1,simulatedFixtureAge:true,volumesDeleted:0,productionDatabaseMutations:0}));
 }finally{
  // Remove only the two unique containers created above, and our own tagged fixture images.
  for(const name of [prefix,neighbor]){try{const c=JSON.parse(await docker(["inspect",name]))[0];if(c.Name==="/"+name&&(name===prefix?c.Config.Labels?.["com.docker.compose.project"]===prefix:c.Config.Labels?.["nanohub.qa"]==="release"))await docker(["rm","-f",c.Id]);}catch{/* Creation may have failed. */}}
  for(const tag of images)try{await docker(["image","rm",tag]);}catch{/* No force and no shared image deletion. */}
  // Files were created by container root. Return only this owned fixture tree
  // to the invoking host user so cleanup also works on an unprivileged CI runner.
  const owner=fs.statSync(root);
  function returnOwnership(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,e.name);if(e.isSymbolicLink())continue;if(e.isDirectory())returnOwnership(file);fs.chownSync(file,owner.uid,owner.gid);}fs.chownSync(dir,owner.uid,owner.gid);}
  returnOwnership(root);
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
