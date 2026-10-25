"use strict";
const fs=require("node:fs"),path=require("node:path"),{docker,POLICY,IMAGE,UUID,loadCatalog,heartbeatHealthy,hash}=require("./release-catalog.cjs");
const AGE=7*86400000;
function createImageMaintenance({run=docker,policy=POLICY,load=()=>loadCatalog(),dataDir=process.env.DATA_DIR||"/app/data",clock=Date.now,store,validateActor,db}={}){
 async function inventory(){
  const catalog=load(),pins=new Set(catalog.releases.map(r=>r.imageId));
  const containers=(await run(["ps","-aq","--no-trunc"])).split(/\s+/).filter(Boolean);
  const references=new Set(containers.length?(await run(["inspect","--format","{{.Image}}",...containers])).split(/\s+/).filter(Boolean):[]);
  const ids=[...new Set((await run(["image","ls","-aq","--no-trunc"])).split(/\s+/).filter(Boolean))];
  const result=[];
  if(ids.some(id=>!IMAGE.test(id)))throw Error("Inventario de imágenes inválido");
  // Inspect metadata only; image Config.Env may contain historical secrets.
  for(let n=0;n<ids.length;n+=100){
   const out=await run(["image","inspect","--format","{{json .Id}}|{{json .RepoTags}}|{{json .RepoDigests}}|{{json .Created}}|{{json .Size}}",...ids.slice(n,n+100)]);
   for(const line of out.split("\n").filter(Boolean)){
    const [id,tags,digests,createdAt,sizeBytes]=line.split("|").map(s=>JSON.parse(s)),created=Date.parse(createdAt);
    // A single owned tag avoids ambiguous shared/dangling/rollback images.
    if(!IMAGE.test(id)||!Array.isArray(tags)||tags.length!==1||!tags[0].startsWith(policy.imageRepository+":")||/rollback/i.test(tags[0])||(digests||[]).some(d=>!d.startsWith(policy.imageRepository+"@"))||references.has(id)||pins.has(id)||!Number.isFinite(created)||clock()-created<AGE||!Number.isSafeInteger(sizeBytes)||sizeBytes<0)continue;
    result.push({imageId:id,tag:tags[0],createdAt,sizeBytes,ageDays:Math.floor((clock()-created)/86400000)});
   }
  }
  return result.sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
 }
 function workerReady(){try{const caps=JSON.parse(fs.readFileSync(path.join(dataDir,"release-worker-capabilities.json"))),instance=fs.readFileSync(path.join(dataDir,"release-worker-instance"),"utf8");return heartbeatHealthy(dataDir,clock())&&caps.instance===instance&&caps.kinds?.includes("maintenance");}catch{return false;}}
 async function preview(){const candidates=await inventory();return {slug:policy.slug,minimumAgeDays:7,candidates,workerHealthy:workerReady(),automaticDeletion:false,volumesIncluded:false,selectionLimit:20};}
 async function enqueue(imageIds,requestId,confirmation,actor){
  if(!store||!Array.isArray(imageIds)||!imageIds.length||imageIds.length>20||new Set(imageIds).size!==imageIds.length||imageIds.some(i=>typeof i!=="string"||!IMAGE.test(i))||!UUID.test(requestId||"")||confirmation!=="ELIMINAR "+imageIds.length+" IMAGENES DEL HUB")throw Error("Selección o confirmación de limpieza inválida");
  const existing=store.byKey("maintenance",policy.slug,requestId);if(existing){if(existing.actor!==actor||hash(existing.payload.images.map(i=>i.imageId))!==hash(imageIds))throw Error("Conflicto de idempotencia");return existing;}
  if(!workerReady())throw Error("Worker de mantenimiento no disponible");
  const candidates=await inventory(),selected=imageIds.map(id=>candidates.find(c=>c.imageId===id));if(selected.some(x=>!x))throw Error("La selección cambió o contiene imágenes protegidas");
  return store.enqueue({kind:"maintenance",resource:policy.slug,key:requestId,actor,payload:{images:selected.map(({imageId,tag})=>({imageId,tag}))},maxAttempts:1});
 }
 function outputPath(id){if(!UUID.test(id))throw Error("Trabajo inválido");return path.join(dataDir,"maintenance-"+id+".json");}
 function save(job,evidence){const file=outputPath(job.id);fs.writeFileSync(file+".part",JSON.stringify(evidence),{mode:0o600});fs.renameSync(file+".part",file);}
 function audit(job,action,details){const d=db();try{d.prepare("INSERT INTO audit_log(timestamp,user,action,target,details) VALUES(?,?,?,?,?)").run(new Date(clock()).toISOString(),job.actor,action,policy.slug,job.id+" "+details);}finally{d.close();}}
 async function execute(job,{leaseValid=()=>true}={}){
  if(job.kind!=="maintenance"||job.resource!==policy.slug||!UUID.test(job.id)||!Array.isArray(job.payload.images)||!job.payload.images.length||job.payload.images.length>20||job.payload.images.some(x=>!IMAGE.test(x.imageId||"")||typeof x.tag!=="string"||!x.tag.startsWith(policy.imageRepository+":")))throw Error("Trabajo de mantenimiento inválido");
  if(!validateActor(job)||!leaseValid())throw Error("La autorización de mantenimiento venció o fue revocada");
  const selected=job.payload.images,evidence={jobId:job.id,selectionHash:hash(selected),images:selected,removed:[],complete:false,finished:false,instance:process.env.HUB_RELEASE_WORKER_INSTANCE||null};
  try{
  save(job,evidence);audit(job,"HUB_IMAGE_CLEANUP_STARTED",selected.length+" imágenes propias seleccionadas");
  for(const image of selected){
   if(!validateActor(job)||!leaseValid())throw Error("La autorización cambió; el trabajo no se repite automáticamente");
   const current=(await inventory()).find(x=>x.imageId===image.imageId&&x.tag===image.tag);if(!current)throw Error("Una imagen cambió, está en uso o quedó protegida; se conserva el resto");
   // Delete only the exact owned tag. Never force deletion by ID: a concurrent
   // foreign tag must remain intact even if metadata changes after preflight.
   try{
    await run(["image","rm",image.tag]);
    const still=(await run(["image","ls","--no-trunc","--format","{{.Repository}}:{{.Tag}}",policy.imageRepository])).split("\n").includes(image.tag);
    if(still)throw Error("Tag still present");
   }catch{const e=Error("No se confirmó la retirada de la imagen; requiere reconciliación");e.uncertain=true;throw e;}
   evidence.removed.push(image);save(job,evidence);audit(job,"HUB_IMAGE_REMOVED",image.imageId+" "+image.tag);
  }
  evidence.complete=true;save(job,evidence);return {removed:evidence.removed,volumesDeleted:0,globalPrune:false};
  }finally{evidence.finished=true;save(job,evidence);}
 }
 async function reconcile(job){
  if(job.kind!=="maintenance"||job.resource!==policy.slug||job.state!=="uncertain")throw Error("El trabajo no requiere reconciliación");
  const file=outputPath(job.id),st=fs.lstatSync(file);if(!st.isFile()||st.isSymbolicLink()||st.size>65536)throw Error("Evidencia inválida");
  const evidence=JSON.parse(fs.readFileSync(file));if(evidence.jobId!==job.id||evidence.selectionHash!==hash(job.payload.images)||hash(evidence.images)!==hash(job.payload.images))throw Error("Evidencia no vinculada a la selección");
  if(!evidence.finished){let instance;try{instance=fs.readFileSync(path.join(dataDir,"release-worker-instance"),"utf8");}catch{throw Error("No se puede descartar una ejecución activa");}if(!evidence.instance||evidence.instance===instance)throw Error("El worker puede seguir ejecutando; no se desbloquea");}
  const tags=new Set((await run(["image","ls","--no-trunc","--format","{{.Repository}}:{{.Tag}}",policy.imageRepository])).split("\n")),removed=evidence.images.filter(i=>!tags.has(i.tag)),complete=removed.length===evidence.images.length;
  return store.reconcile(job.id,{state:complete?"succeeded":"failed",result:{removed,remaining:evidence.images.filter(i=>tags.has(i.tag)),volumesDeleted:0,globalPrune:false},evidence:"Worker finalizado o reemplazado; selección del mismo trabajo contrastada con etiquetas reales. Limpieza "+(complete?"completa":"parcial: conservadas las restantes")+"; sin replay, volúmenes ni prune global"});
 }
 return {inventory,preview,enqueue,execute,reconcile};
}
module.exports={createImageMaintenance};
