"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),crypto=require("node:crypto"),{DatabaseSync}=require("node:sqlite");
const {createImageMaintenance}=require("./image-maintenance.cjs"),{createJobStore}=require("./job-store.cjs");
const id=n=>"sha256:"+n.toString(16).padStart(64,"0");
async function fixture(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),"hub-maintenance-")),now=1800000000000,store=createJobStore({dataDir:dir,clock:()=>now});
 fs.writeFileSync(path.join(dir,"release-worker-heartbeat"),String(now));fs.writeFileSync(path.join(dir,"release-worker-instance"),"fixture");fs.writeFileSync(path.join(dir,"release-worker-capabilities.json"),JSON.stringify({instance:"fixture",kinds:["maintenance"]}));
 const images=new Map(),references=new Set(),pins=new Set(),calls=[];let allowed=true,failDelete=false;
 const add=(n,extra={})=>{const image={imageId:id(n),tags:["nanolabshub:old-"+n],digests:[],createdAt:new Date(now-8*86400000).toISOString(),sizeBytes:1000000,...extra};images.set(image.imageId,image);return image;};
 const run=async args=>{calls.push(args);if(args[0]==="ps")return "fixture-container";if(args[0]==="inspect")return [...references].join("\n");if(args[0]==="image"&&args[1]==="inspect")return args.slice(4).map(key=>{const i=images.get(key);return [i.imageId,i.tags,i.digests,i.createdAt,i.sizeBytes].map(JSON.stringify).join("|");}).join("\n");if(args[0]==="image"&&args[1]==="ls")return args.includes("--format")?[...images.values()].flatMap(i=>i.tags).join("\n"):[...images.keys()].join("\n");if(args[0]==="image"&&args[1]==="rm"){if(failDelete)throw Error("transport lost");for(const [key,i] of images)if(i.tags.includes(args[2])){images.delete(key);return "deleted";}throw Error("missing");}throw Error("Unexpected command");};
 const db=()=>{const d=new DatabaseSync(path.join(dir,"hub.sqlite"));d.exec("CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY,timestamp TEXT,user TEXT,action TEXT,target TEXT,details TEXT)");return d;};
 const engine=createImageMaintenance({run,dataDir:dir,clock:()=>now,load:()=>({releases:[...pins].map(imageId=>({imageId}))}),store,validateActor:()=>allowed,db});
 try{await fn({dir,engine,store,images,references,pins,calls,add,setAllowed:v=>allowed=v,setDeleteFailure:v=>failDelete=v,claim:()=>store.claim("maintenance",["nanolabshub"]),enqueue:async ids=>engine.enqueue(ids,crypto.randomUUID(),"ELIMINAR "+ids.length+" IMAGENES DEL HUB","owner")});}finally{fs.rmSync(dir,{recursive:true,force:true});}}
test("preview excludes foreign/shared/dangling/recent/pinned/rollback and all container references",()=>fixture(async f=>{
 f.add(1);f.add(2,{tags:["onlyfood:old"]});f.add(3,{tags:["nanolabshub:shared","onlycars:shared"]});f.add(4,{tags:[]});f.add(5,{createdAt:new Date(1800000000000-86400000).toISOString()});f.add(6);f.pins.add(id(6));f.add(7);f.references.add(id(7));f.add(8,{tags:["nanolabshub:rollback-old"]});f.add(9,{digests:["another/repository@sha256:abc"]});
 const p=await f.engine.preview();assert.deepEqual(p.candidates.map(c=>c.imageId),[id(1)]);assert.equal(p.automaticDeletion,false);assert.equal(p.volumesIncluded,false);assert.equal(p.workerHealthy,true);assert(f.calls.every(c=>!c.includes("rm")));
}));
test("selection requires exact confirmation, identity, supported worker and remains idempotent",()=>fixture(async f=>{
 f.add(1);const key=crypto.randomUUID();await assert.rejects(f.engine.enqueue([id(1)],key,"yes","owner"));const a=await f.engine.enqueue([id(1)],key,"ELIMINAR 1 IMAGENES DEL HUB","owner");assert.equal((await f.engine.enqueue([id(1)],key,"ELIMINAR 1 IMAGENES DEL HUB","owner")).id,a.id);await assert.rejects(f.enqueue([id(99)]));fs.writeFileSync(path.join(f.dir,"release-worker-instance"),"different");await assert.rejects(f.enqueue([id(1)]),/Worker/);
}));
test("execution removes only the selected owned tag, audits and never forces or prunes",()=>fixture(async f=>{
 f.add(1);f.add(2);await f.enqueue([id(1)]);const job=f.claim(),result=await f.engine.execute(job);assert.equal(result.removed.length,1);assert.equal(result.volumesDeleted,0);assert(f.images.has(id(2)));assert.deepEqual(f.calls.filter(c=>c[1]==="rm"),[["image","rm","nanolabshub:old-1"]]);const d=new DatabaseSync(path.join(f.dir,"hub.sqlite"));try{assert.equal(d.prepare("SELECT COUNT(*) AS n FROM audit_log").get().n,2);}finally{d.close();}
}));
test("new references/pins or revoked permissions stop before removal",()=>fixture(async f=>{
 f.add(1);await f.enqueue([id(1)]);const job=f.claim();f.references.add(id(1));await assert.rejects(f.engine.execute(job),/protegida/);assert(f.images.has(id(1)));f.references.clear();f.setAllowed(false);await assert.rejects(f.engine.execute(job),/autorización/);assert(f.calls.every(c=>c[1]!=="rm"));
}));
test("ambiguous deletion persists evidence and reconciles partial failure without replay",()=>fixture(async f=>{
 f.add(1);await f.enqueue([id(1)]);const job=f.claim();f.setDeleteFailure(true);await assert.rejects(f.engine.execute(job),e=>e.uncertain===true);f.store.fail(job.id,job.lease_owner,"unknown",{uncertain:true});const result=await f.engine.reconcile(f.store.get(job.id));assert.equal(result.state,"failed");assert.equal(result.result.remaining.length,1);assert.equal(f.calls.filter(c=>c[1]==="rm").length,1);
}));
test("reconciliation detects observed completion and refuses a possibly active worker",()=>fixture(async f=>{
 f.add(1);await f.enqueue([id(1)]);const job=f.claim();await f.engine.execute(job);f.store.fail(job.id,job.lease_owner,"lost response",{uncertain:true});const file=path.join(f.dir,"maintenance-"+job.id+".json"),e=JSON.parse(fs.readFileSync(file));e.finished=false;e.instance="fixture";fs.writeFileSync(file,JSON.stringify(e));await assert.rejects(f.engine.reconcile(f.store.get(job.id)),/seguir ejecutando/);fs.writeFileSync(path.join(f.dir,"release-worker-instance"),"restarted");assert.equal((await f.engine.reconcile(f.store.get(job.id))).state,"succeeded");
}));
test("maintenance and releases exclude each other and backups atomically",()=>fixture(async f=>{
 f.add(1);await f.enqueue([id(1)]);const m=f.claim();f.store.enqueue({kind:"release",resource:"nanolabshub",key:"release",actor:"owner"});f.store.enqueue({kind:"backup",resource:"onlyfood",key:"backup",actor:"owner"});assert.equal(f.store.claim("release",["nanolabshub"]),null);assert.equal(f.store.claim("backup",["onlyfood"]),null);f.store.finish(m.id,m.lease_owner,{});const r=f.store.claim("release",["nanolabshub"]);assert(r);await f.enqueue([id(1)]);assert.equal(f.claim(),null);
}));
test("independent worker dispatches a selected maintenance job once",()=>fixture(async f=>{
 f.add(1);const queued=await f.enqueue([id(1)]),worker=require("./release-worker.cjs").createReleaseWorker({store:f.store,dataDir:f.dir,engine:{execute:()=>{throw Error("Unexpected release");}},maintenance:f.engine});await worker.tick();await worker.tick();assert.equal(f.store.get(queued.id).state,"succeeded");assert.equal(f.calls.filter(c=>c[1]==="rm").length,1);
}));
test("a retried receipt after completed cleanup returns the same job, without another deletion",()=>fixture(async f=>{
 f.add(1);const key=crypto.randomUUID(),queued=await f.engine.enqueue([id(1)],key,"ELIMINAR 1 IMAGENES DEL HUB","owner"),job=f.claim(),result=await f.engine.execute(job);f.store.finish(job.id,job.lease_owner,result);assert.equal((await f.engine.enqueue([id(1)],key,"ELIMINAR 1 IMAGENES DEL HUB","owner")).id,queued.id);await assert.rejects(f.engine.enqueue([id(1)],key,"ELIMINAR 1 IMAGENES DEL HUB","another-owner"),/idempotencia/);assert.equal(f.calls.filter(c=>c[1]==="rm").length,1);
}));
