"use strict";
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {execFile}=require("node:child_process");
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,IMAGE=/^sha256:[a-f0-9]{64}$/,SHA=/^[a-f0-9]{40}$/;
const POLICY=Object.freeze({slug:"nanolabshub",project:"nanolabshub",service:"nanolabshub",container:"nanolabshub",repository:"augustobx/nanolabshub",imageRepository:"nanolabshub"});
function docker(args,{timeout=30000}={}){
 return new Promise((resolve,reject)=>execFile("docker",args,{timeout,maxBuffer:4*1024**2,env:{...process.env,DOCKER_CONFIG:process.env.DOCKER_CONFIG||"/tmp/nanohub-docker"}},(error,out)=>{
  // Never forward Compose config/stdout/stderr on failure: they can contain secrets.
  if(error)reject(Error("No se pudo completar la operación Docker de "+String(args[0])));else resolve(out.trim());
 }));
}
function readFile(file,max=256*1024){const st=fs.lstatSync(file);if(!st.isFile()||st.isSymbolicLink()||st.size<1||st.size>max)throw Error("Archivo de control inválido");return fs.readFileSync(file);}
function verifyEnvelope(envelope,key){
 if(!envelope||typeof envelope.payload!=="string"||envelope.payload.length>256*1024||typeof envelope.signature!=="string"||envelope.signature.length>120)throw Error("Aprobación inválida");
 const publicKey=crypto.createPublicKey(key);if(publicKey.asymmetricKeyType!=="ed25519")throw Error("La aprobación requiere una clave Ed25519");
 const payload=Buffer.from(envelope.payload,"base64"),signature=Buffer.from(envelope.signature,"base64");
 if(signature.length!==64||!crypto.verify(null,payload,publicKey,signature))throw Error("Firma de aprobación no válida");
 return JSON.parse(payload.toString("utf8"));
}
function signEnvelope(payload,privateKey){const bytes=Buffer.from(JSON.stringify(payload));return {payload:bytes.toString("base64"),signature:crypto.sign(null,bytes,privateKey).toString("base64")};}
function loadCatalog({catalogPath=process.env.HUB_RELEASE_CATALOG_PATH,publicKeyPath=process.env.HUB_RELEASE_PUBLIC_KEY_PATH,policy=POLICY,clock=Date.now}={}){
 if(!catalogPath||!publicKeyPath)throw Error("Despliegues aún no configurados");
 const catalog=verifyEnvelope(JSON.parse(readFile(catalogPath).toString()),readFile(publicKeyPath,8192));
 if(catalog.version!==1||catalog.slug!==policy.slug||catalog.project!==policy.project||catalog.service!==policy.service||catalog.container!==policy.container||catalog.repository!==policy.repository)throw Error("Catálogo fuera del alcance autorizado");
 if(!Number.isFinite(catalog.expiresAt)||catalog.expiresAt<=clock()||catalog.expiresAt>clock()+31*86400000)throw Error("La aprobación del catálogo venció o su vigencia es inválida");
 if(!/^[a-f0-9]{64}$/.test(catalog.configurationSha256||"")||!/^[a-f0-9]{64}$/.test(catalog.runtimeFingerprint||""))throw Error("Faltan huellas de configuración aprobadas");
 if(!Array.isArray(catalog.environmentKeys)||catalog.environmentKeys.length>200||catalog.environmentKeys.some(k=>typeof k!=="string"||!/^[A-Z0-9_]{1,120}$/.test(k))||new Set(catalog.environmentKeys).size!==catalog.environmentKeys.length)throw Error("Inventario de entorno inválido");
 if(!Array.isArray(catalog.releases)||!catalog.releases.length||catalog.releases.length>20||new Set(catalog.releases.map(r=>r.id)).size!==catalog.releases.length)throw Error("Catálogo de versiones inválido");
 for(const release of catalog.releases){
  if(!/^[a-zA-Z0-9-]{1,80}$/.test(release.id||"")||!IMAGE.test(release.imageId||"")||!SHA.test(release.revision||"")||release.schemaCompatibility!=="additive-only"||release.ci?.conclusion!=="success"||release.ci.headSha!==release.revision||!Number.isSafeInteger(release.ci.runId)||release.ci.runId<1)throw Error("La versión no tiene aprobación, CI o compatibilidad completos");
 }
 return catalog;
}
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==="object")return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));return value;}
function hash(value){return crypto.createHash("sha256").update(typeof value==="string"||Buffer.isBuffer(value)?value:JSON.stringify(canonical(value))).digest("hex");}
function runtimeFingerprint(container,environmentKeys){
 const environment=Object.fromEntries((container.Config?.Env||[]).map(e=>{const n=e.indexOf("=");return [e.slice(0,n),e.slice(n+1)];}));
 const host=container.HostConfig||{};
 return hash({environment:Object.fromEntries(environmentKeys.map(k=>[k,environment[k]??null])),mounts:(container.Mounts||[]).map(m=>({type:m.Type,source:m.Source,destination:m.Destination,rw:m.RW,propagation:m.Propagation})).sort((a,b)=>a.destination.localeCompare(b.destination)),networks:Object.keys(container.NetworkSettings?.Networks||{}).sort(),ports:host.PortBindings||{},restart:host.RestartPolicy,logging:host.LogConfig,readonly:!!host.ReadonlyRootfs,memory:host.Memory||0,cpus:host.NanoCpus||0,security:(host.SecurityOpt||[]).slice().sort(),capsAdd:(host.CapAdd||[]).slice().sort(),capsDrop:(host.CapDrop||[]).slice().sort()});
}
function heartbeatHealthy(dataDir,now=Date.now()){
 try{const value=Number(readFile(path.join(dataDir,"release-worker-heartbeat"),64).toString());return Number.isFinite(value)&&value>0&&value<=now+5000&&now-value<60000;}catch{return false;}
}
function createReleasePublic({run=docker,policy=POLICY,dataDir=process.env.DATA_DIR||"/app/data",catalogPath=process.env.HUB_RELEASE_CATALOG_PATH,publicKeyPath=process.env.HUB_RELEASE_PUBLIC_KEY_PATH,clock=Date.now}={}){
 const catalog=()=>loadCatalog({catalogPath,publicKeyPath,policy,clock});
 async function plan(){
  const approved=catalog(),current=JSON.parse(await run(["inspect",policy.container]))[0];
  const configured=runtimeFingerprint(current,approved.environmentKeys)===approved.runtimeFingerprint,workerHealthy=heartbeatHealthy(dataDir,clock());
  const releases=[];
  for(const r of approved.releases){let available=false;try{const image=JSON.parse(await run(["image","inspect",r.imageId]))[0];available=image.Id===r.imageId&&image.Config?.Labels?.["org.opencontainers.image.revision"]===r.revision&&(image.RepoTags||[]).some(t=>t.startsWith(policy.imageRepository+":"));}catch{/* Missing approved images are unavailable, never pulled. */}releases.push({...r,available});}
  return {slug:policy.slug,currentImageId:current.Image,currentRevision:current.Config?.Labels?.["org.opencontainers.image.revision"]||null,configurationMatches:configured,workerHealthy,ready:configured&&workerHealthy,releases,services:[policy.service],backupRequired:true,isolatedRestoreRequired:true,automaticDatabaseRestore:false};
 }
 function enqueue(store,releaseId,requestId,actor,operatorApproval){
  const approved=catalog();if(!approved.releases.some(r=>r.id===releaseId)||!UUID.test(requestId||""))throw Error("Versión o solicitud inválida");
  return store.enqueue({kind:"release",resource:policy.slug,key:requestId,actor,payload:{releaseId,...(operatorApproval?{operatorApproval}: {})},maxAttempts:1});
 }
 async function reconcile(store,id){const job=store.get(id),backup=require("./backup-engine.cjs");if(!job)throw Error("Trabajo no registrado");const engine=require("./release-engine.cjs").createReleaseEngine({run,policy,dataDir,backup});return store.reconcile(id,await engine.reconcile(job));}
 return {catalog,plan,enqueue,reconcile};
}
module.exports={POLICY,UUID,IMAGE,SHA,docker,readFile,hash,runtimeFingerprint,verifyEnvelope,signEnvelope,loadCatalog,heartbeatHealthy,createReleasePublic};
