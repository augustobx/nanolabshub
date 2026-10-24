"use strict";
const fs=require("node:fs"),path=require("node:path");
const {POLICY,IMAGE,UUID,docker,readFile,hash,runtimeFingerprint,loadCatalog}=require("./release-catalog.cjs");
// Compose interpolates dollars even in JSON. Preserve literal credentials and paths.
function escapeCompose(value){if(typeof value==="string")return value.replace(/\$/g,()=>"$$");if(Array.isArray(value))return value.map(escapeCompose);if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,escapeCompose(v)]));return value;}
function createReleaseEngine({run=docker,policy=POLICY,dataDir=process.env.DATA_DIR||"/app/data",configurationPath=process.env.HUB_RELEASE_CONFIGURATION_PATH,runtimeDir=process.env.HUB_RELEASE_RUNTIME_DIR,load=()=>loadCatalog(),backup,restore,validateActor,clock=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms)),healthAttempts=30}={}){
 const lockPath=path.join(dataDir,"release.lock");
 function evidencePath(id){if(!UUID.test(id))throw Error("Trabajo inválido");return path.join(dataDir,"release-"+id+".json");}
 function writeEvidence(id,value){const target=evidencePath(id),tmp=target+".part";fs.writeFileSync(tmp,JSON.stringify(value),{mode:0o600});fs.renameSync(tmp,target);}
 async function inspect(){const item=JSON.parse(await run(["inspect",policy.container]))[0];if(item?.Name!=="/"+policy.container||item.Config?.Labels?.["com.docker.compose.project"]!==policy.project||item.Config?.Labels?.["com.docker.compose.service"]!==policy.service)throw Error("El contenedor no pertenece al servicio Hub aprobado");return item;}
 async function neighbors(){const ids=(await run(["ps","-aq","--no-trunc"])).split(/\s+/).filter(Boolean);if(!ids.length)throw Error("Inventario Docker vacío");const rows=(await run(["inspect","--format","{{json .Id}} {{json .Name}} {{json .Image}} {{json .State.StartedAt}} {{json .State.Running}}",...ids])).split("\n").filter(Boolean);return rows.filter(x=>!x.includes(JSON.stringify("/"+policy.container))).sort();}
 async function approvedImage(release){const image=JSON.parse(await run(["image","inspect",release.imageId]))[0];if(image?.Id!==release.imageId||image.Config?.Labels?.["org.opencontainers.image.revision"]!==release.revision||!(image.RepoTags||[]).some(t=>t.startsWith(policy.imageRepository+":")))throw Error("La imagen aprobada no está disponible o su revisión cambió");}
 function configuration(catalog){const raw=readFile(configurationPath,1024*1024);if(hash(raw)!==catalog.configurationSha256)throw Error("El manifiesto efectivo cambió después de la aprobación");let config;try{config=JSON.parse(raw);}catch{throw Error("Manifiesto privado inválido");}const names=Object.keys(config.services||{}),service=config.services?.[policy.service];if(names.length!==1||names[0]!==policy.service||config.name&&config.name!==policy.project||service?.container_name!==policy.container||service.build||service.depends_on||service.extends||service.env_file||config.include||config.volumes||config.secrets||config.configs)throw Error("El manifiesto contiene recursos fuera del servicio Hub");if(!service.environment||Array.isArray(service.environment)||hash(Object.keys(service.environment).sort())!==hash(catalog.environmentKeys.slice().sort()))throw Error("El inventario de entorno no coincide con el manifiesto");return config;}
 function writeManifest(jobId,config,image){if(!IMAGE.test(image)||!runtimeDir||!path.isAbsolute(runtimeDir))throw Error("Ruta de manifiestos o imagen inválida");const st=fs.lstatSync(runtimeDir);if(!st.isDirectory()||st.isSymbolicLink())throw Error("Directorio de manifiestos inseguro");const output=path.join(runtimeDir,jobId+"-"+image.slice(7,19)+".json"),value=escapeCompose({...config,services:{[policy.service]:{...config.services[policy.service],image,pull_policy:"never"}}});fs.writeFileSync(output,JSON.stringify(value),{flag:"wx",mode:0o600});const owner=fs.statSync(configurationPath);if(process.platform!=="win32")fs.chownSync(output,owner.uid,owner.gid);return output;}
 async function apply(file){return run(["compose","--project-name",policy.project,"--project-directory",path.dirname(configurationPath),"--env-file","/dev/null","-f",file,"up","-d","--no-deps","--no-build","--pull","never",policy.service],{timeout:180000});}
 async function healthy(image,catalog,expectedNeighbors){
  for(let n=0;n<healthAttempts;n++){const item=await inspect();if(item.Image===image&&item.State?.Running&&item.State?.Health?.Status==="healthy"){
    if(runtimeFingerprint(item,catalog.environmentKeys)!==catalog.runtimeFingerprint)throw Error("La configuración ejecutada difiere de la aprobada");
    const result=await run(["exec",policy.container,"node","-e","Promise.all(['/api/health','/api/jobs'].map(async p=>{const r=await fetch('http://127.0.0.1:3000'+p);if(r.status!==(p==='/api/health'?200:401))throw Error('HTTP');})).catch(()=>process.exit(1))"]);
    void result;
    if(hash(await neighbors())!==hash(expectedNeighbors))throw Error("El inventario vecino cambió; requiere revisión");return item;
   }await sleep(2000);
  }throw Error("El Hub no alcanzó la salud requerida");
 }
 async function execute(job,{leaseValid=()=>true}={}){
  if(job.kind!=="release"||job.resource!==policy.slug||!UUID.test(job.id))throw Error("Despliegue fuera del Hub");
  fs.mkdirSync(dataDir,{recursive:true,mode:0o700});let lock;
  try{lock=fs.openSync(lockPath,"wx",0o600);}catch{throw Error("Hay un despliegue activo o un bloqueo pendiente de revisión");}
  let retain=false,evidence,mutating=false;
  try{
   fs.writeFileSync(lock,JSON.stringify({jobId:job.id,at:clock(),instance:process.env.HUB_RELEASE_WORKER_INSTANCE||null,finished:false}));
   const catalog=load(),release=catalog.releases.find(r=>r.id===job.payload.releaseId);if(!release)throw Error("Versión no aprobada");
   if(!validateActor(job,catalog))throw Error("La autorización del despliegue venció o fue revocada");
   const config=configuration(catalog),current=await inspect();
   if(!current.State?.Running||current.State?.Health?.Status!=="healthy"||runtimeFingerprint(current,catalog.environmentKeys)!==catalog.runtimeFingerprint)throw Error("El estado inicial no coincide con el Hub saludable aprobado");
   await approvedImage(release);
   if(!IMAGE.test(current.Image))throw Error("Imagen anterior no identificada");
   await run(["image","inspect",current.Image]); // rollback image must remain local
   const before=await neighbors(),apps=[{slug:policy.slug,name:"NanoHub",dbType:"sqlite",sqlitePath:path.join(dataDir,"hub.sqlite"),containerNames:[policy.container]}];
   const archive=await backup.createBackup(apps,policy.slug,"release",job.actor,{jobId:job.id});
   const check=await restore.checkIsolated(apps,archive.id,job.actor,{jobId:job.id});
   if(check.status!=="passed"||check.checksum!==archive.checksum)throw Error("No se aprobó la restauración del backup previo");
   // Revalidate after the expensive backup. No expired approval or drift at mutation time.
   if(hash(load())!==hash(catalog)||!validateActor(job,catalog)||!leaseValid())throw Error("La aprobación o el lease cambió durante la preparación");
   const still=await inspect();if(still.Id!==current.Id||runtimeFingerprint(still,catalog.environmentKeys)!==catalog.runtimeFingerprint||hash(await neighbors())!==hash(before))throw Error("El entorno cambió durante la preparación");
   await approvedImage(release);
   const forward=writeManifest(job.id,config,release.imageId);
   // Write rollback manifest before any mutation, including when target equals prior image.
   const rollback=release.imageId===current.Image?forward:writeManifest(job.id,config,current.Image);
   evidence={version:1,jobId:job.id,releaseId:release.id,revision:release.revision,configurationSha256:catalog.configurationSha256,runtimeFingerprint:catalog.runtimeFingerprint,environmentKeys:catalog.environmentKeys,priorImage:current.Image,targetImage:release.imageId,backupId:archive.id,checksum:archive.checksum,neighbors:before,phase:"prepared",at:clock()};
   writeEvidence(job.id,evidence);evidence.phase="applying";writeEvidence(job.id,evidence);mutating=true;
   try{
    await apply(forward);await healthy(release.imageId,catalog,before);
    if(!leaseValid())throw Error("Lease perdido; se requiere reconciliar");
    evidence.phase="healthy";evidence.at=clock();writeEvidence(job.id,evidence);
    return {releaseId:release.id,revision:release.revision,imageId:release.imageId,backupId:archive.id,checksum:archive.checksum,neighborsUnchanged:true,rolledBack:false};
   }catch{
    evidence.phase="rolling-back";writeEvidence(job.id,evidence);
    try{await apply(rollback);await healthy(current.Image,catalog,before);if(!leaseValid())throw Error("Lease perdido");evidence.phase="rolled-back";evidence.at=clock();writeEvidence(job.id,evidence);}catch{const error=Error("No se confirmó el estado final; revisar despliegue y bloqueo antes de repetir");error.uncertain=true;throw error;}
    const error=Error("La versión no aprobó la verificación; Hub volvió a la imagen anterior sin restaurar la base");error.rolledBack=true;throw error;
   }
  }catch(error){retain=!!error.uncertain||(mutating&&!['healthy','rolled-back'].includes(evidence?.phase));if(retain)error.uncertain=true;throw error;}
  finally{if(retain){fs.ftruncateSync(lock,0);fs.writeSync(lock,JSON.stringify({jobId:job.id,at:clock(),instance:process.env.HUB_RELEASE_WORKER_INSTANCE||null,finished:true}),0,"utf8");}fs.closeSync(lock);if(!retain)fs.unlinkSync(lockPath);}
 }
 async function reconcile(job){
  if(job.kind!=="release"||job.resource!==policy.slug||job.state!=="uncertain")throw Error("El trabajo no requiere reconciliación");
  if(fs.existsSync(lockPath)){
   const lock=JSON.parse(readFile(lockPath,1024));if(lock.jobId!==job.id)throw Error("El bloqueo pertenece a otra ejecución");
   if(lock.finished!==true){
    let active;try{active=readFile(path.join(dataDir,"release-worker-instance"),128).toString();}catch{throw Error("No se puede descartar una ejecución aún activa");}
    if(!lock.instance||lock.instance===active)throw Error("La ejecución puede seguir activa; el worker debe terminar o reiniciarse antes de reconciliar");
   }
  }
  const evidence=JSON.parse(readFile(evidencePath(job.id),1024*1024));
  if(evidence.jobId!==job.id||evidence.releaseId!==job.payload.releaseId||!['healthy','rolled-back','applying','rolling-back'].includes(evidence.phase)||!IMAGE.test(evidence.targetImage)||!IMAGE.test(evidence.priorImage)||!Array.isArray(evidence.neighbors))throw Error("Evidencia de despliegue incompleta");
  const current=await inspect(),rolledBack=current.Image===evidence.priorImage&&evidence.phase!=="healthy";
  if(!rolledBack&&current.Image!==evidence.targetImage)throw Error("No coincide ninguna imagen comprobable");
  const apps=[{slug:policy.slug,dbType:"sqlite",sqlitePath:path.join(dataDir,"hub.sqlite"),containerNames:[policy.container]}];
  const file=await backup.download(apps,evidence.backupId);if((await backup.verify(file.file)).sha!==evidence.checksum)throw Error("El backup previo cambió");
  await healthy(current.Image,evidence,evidence.neighbors);
  if(fs.existsSync(lockPath)){const lock=JSON.parse(readFile(lockPath,1024));if(lock.jobId!==job.id)throw Error("El bloqueo pertenece a otra ejecución");fs.unlinkSync(lockPath);}
  return {state:rolledBack?"failed":"succeeded",result:{releaseId:evidence.releaseId,revision:rolledBack?null:evidence.revision,imageId:current.Image,backupId:evidence.backupId,rolledBack,neighborsUnchanged:true},evidence:"Imagen, salud, backup SHA-256, configuración y todos los contenedores vecinos comprobados"};
 }
 return {execute,reconcile};
}
module.exports={escapeCompose,createReleaseEngine};
