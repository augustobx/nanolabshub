"use strict";
// Synthetic DB -> native dump -> isolated restore. Never targets a production container.
// Images must already exist locally with official RepoDigests; no implicit pulls.
const fs=require("node:fs/promises"),os=require("node:os"),path=require("node:path"),crypto=require("node:crypto");
const {Readable}=require("node:stream"),{gzipSync}=require("node:zlib");
const {docker,createSandboxRunner,sandboxSpec}=require("./restore-sandbox.cjs");
async function cleanup(id,spec){
 const state=JSON.parse(await docker(["inspect",id]));
 if(state[0]?.Id!==id||state[0]?.Name!=="/"+spec.name||state[0]?.Config?.Labels?.["ar.nanoapps.hub.restore"]!==spec.nonce)throw Error("Propiedad del fixture no confirmada");
 await docker(["rm","--force","--volumes",id]);
}
async function main(){
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),"hub-restore-smoke-")),results=[];
 try{
  for(const [slug,dbType,image] of [["onlyfood","mariadb",process.env.HUB_RESTORE_TEST_MARIADB_IMAGE||"mariadb:11.8.9"],["onlygym","postgres","postgres:16-alpine"],["onlyturn","postgres","postgres:17-alpine"]]){
   const imageInfo=JSON.parse(await docker(["image","inspect",image]));
   const app={slug,dbType},spec=sandboxSpec(app,imageInfo[0].Id,crypto.randomBytes(16).toString("hex"));
   const source=await docker(spec.args);
   if(!/^[a-f0-9]{64}$/.test(source))throw Error("Fixture ID inválido");
   try{
    await docker(["start",source]);
    const pg=dbType==="postgres";
    let ready=false;
    for(let i=0;i<60;i++){
     try{await docker(["exec",source,...(pg?["sh","-ec",'test "$(cat /proc/1/comm)" = postgres; exec pg_isready -U "$1"',"sh",spec.role]:["mariadb-admin","-uroot","ping"])],{timeout:3000});ready=true;break;}
     catch{await new Promise(r=>setTimeout(r,1000));}
    }
    if(!ready)throw Error("El fixture de origen no inició");
    const sql=(pg?"CREATE DATABASE hub_restore_fixture;\n\\connect hub_restore_fixture\n":"CREATE DATABASE hub_restore_fixture;\nUSE hub_restore_fixture;\n")+
     "CREATE TABLE parent(id INTEGER PRIMARY KEY);\nCREATE TABLE child(id INTEGER PRIMARY KEY,parent_id INTEGER REFERENCES parent(id));\nINSERT INTO parent VALUES(1),(2);\nINSERT INTO child VALUES(11,1),(12,2),(13,1);\n";
    await docker(["exec","-i",source,...(pg?["psql","-X","-v","ON_ERROR_STOP=1","-U",spec.role,"-d","postgres"]:["mariadb","-uroot"])],{input:Readable.from([sql])});
    const dump=await docker(["exec",source,...(pg?["pg_dumpall","-U",spec.role,"--no-role-passwords"]:["mariadb-dump","-uroot","--single-transaction","--quick","--routines","--events","--triggers","--all-databases"])],{maxOutput:64*1024**2});
    const file=path.join(folder,slug+".sql.gz");await fs.writeFile(file,gzipSync(dump),{mode:0o600});
    const start=Date.now(),target={...app,dbContainer:source,containerNames:[source]};
    const manifest=await createSandboxRunner().restore(target,file);
    if(manifest.tables!==2||manifest.rows!==5)throw Error("Conteos restaurados no coinciden con el fixture conocido");
    if(pg?manifest.constraintsValidated!==3:manifest.foreignKeysChecked!==1)throw Error("Las relaciones del fixture no se validaron");
    results.push({slug,fixtureOnly:true,nativeDump:true,elapsedMs:Date.now()-start,manifest});
    await fs.writeFile(file,gzipSync("THIS IS NOT VALID SQL;\n"));
    let rejected=false;try{await createSandboxRunner().restore(target,file);}catch{rejected=true;}
    if(!rejected)throw Error("SQL inválido fue aceptado");
    results.at(-1).invalidSQLRejected=true;
    const brokenFK=(pg?"CREATE TABLE parent(id INTEGER PRIMARY KEY); CREATE TABLE child(parent_id INTEGER REFERENCES parent(id));":"CREATE DATABASE broken_fk; USE broken_fk; CREATE TABLE parent(id INTEGER PRIMARY KEY); CREATE TABLE child(parent_id INTEGER REFERENCES parent(id)); SET FOREIGN_KEY_CHECKS=0;")+" INSERT INTO child VALUES(999);";
    await fs.writeFile(file,gzipSync(brokenFK));
    let fkRejected=false;try{await createSandboxRunner().restore(target,file);}catch{fkRejected=true;}
    if(!fkRejected)throw Error("Relaciones sin correspondencia fueron aceptadas");
    results.at(-1).brokenForeignKeyRejected=true;
   }finally{await cleanup(source,spec);}
  }
  console.log(JSON.stringify({success:true,results},null,2));
 }finally{await fs.rm(folder,{recursive:true,force:true});}
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={main};
