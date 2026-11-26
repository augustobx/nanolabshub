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
 const previousData=process.env.DATA_DIR;process.env.DATA_DIR=folder;
 try{
  for(const [slug,dbType,image] of [["onlyerp","mysql",process.env.HUB_RESTORE_TEST_MYSQL_IMAGE||"mysql:8.0.43"],["onlyfood","mariadb",process.env.HUB_RESTORE_TEST_MARIADB_IMAGE||"mariadb:11.8.9"],["onlygym","postgres","postgres:16-alpine"],["onlyturn","postgres","postgres:17-alpine"]]){
   const imageInfo=JSON.parse(await docker(["image","inspect",image]));
   const app={slug,dbType},spec=sandboxSpec(app,imageInfo[0].Id,crypto.randomBytes(16).toString("hex"));
   const source=await docker(spec.args);
   if(!/^[a-f0-9]{64}$/.test(source))throw Error("Fixture ID inválido");
   try{
    await docker(["start",source]);
    const pg=dbType==="postgres", mysql=dbType==="mysql";
    let ready=false;
    for(let i=0;i<60;i++){
     try{await docker(["exec",source,...(pg?["sh","-ec",'test "$(cat /proc/1/comm)" = postgres; exec pg_isready -U "$1"',"sh",spec.role]:[mysql?"mysqladmin":"mariadb-admin","-uroot","ping"])],{timeout:3000});ready=true;break;}
     catch{await new Promise(r=>setTimeout(r,1000));}
    }
    if(!ready)throw Error("El fixture de origen no inició");
    const sql=(pg?"CREATE DATABASE hub_restore_fixture;\n\\connect hub_restore_fixture\n":"CREATE DATABASE hub_restore_fixture;\nUSE hub_restore_fixture;\n")+
     "CREATE TABLE parent(id INTEGER PRIMARY KEY);\nCREATE TABLE child(id INTEGER PRIMARY KEY,parent_id INTEGER, FOREIGN KEY(parent_id) REFERENCES parent(id));\nINSERT INTO parent VALUES(1),(2);\nINSERT INTO child VALUES(11,1),(12,2),(13,1);\n";
    await docker(["exec","-i",source,...(pg?["psql","-X","-v","ON_ERROR_STOP=1","-U",spec.role,"-d","postgres"]:[mysql?"mysql":"mariadb","-uroot"])],{input:Readable.from([sql])});
    const dump=await docker(["exec",source,...(pg?["pg_dumpall","-U",spec.role,"--no-role-passwords"]:[mysql?"mysqldump":"mariadb-dump","-uroot","--single-transaction","--quick","--routines","--events","--triggers","--all-databases"])],{maxOutput:64*1024**2});
    const file=path.join(folder,slug+".sql.gz");await fs.writeFile(file,gzipSync(dump),{mode:0o600});
    const start=Date.now(),target={...app,dbContainer:source,containerNames:[source]};
    const manifest=await createSandboxRunner().restore(target,file);
    if(manifest.tables!==2||manifest.rows!==5)throw Error("Conteos restaurados no coinciden con el fixture conocido");
    if(pg?manifest.constraintsValidated!==3:manifest.foreignKeysChecked!==1)throw Error("Las relaciones del fixture no se validaron");
    results.push({slug,fixtureOnly:true,nativeDump:true,elapsedMs:Date.now()-start,manifest});
    // Exercise the import path with the same native dump, still entirely inside this fixture runtime.
    const backup=require("./backup-engine.cjs"),recovery=require("./recovery-engine.cjs");
    const root=path.join(folder,"backups"),directory=path.join(root,slug);await fs.mkdir(directory,{recursive:true});
    const importSource=path.join(directory,"native.sql.gz"),original=await fs.readFile(file);await fs.writeFile(importSource,original,{mode:0o600});
    const priorDownload=backup.download;
    backup.download=async(apps,id,options={})=>{
     const d=backup.db();let row;try{row=d.prepare("SELECT * FROM backup_jobs WHERE id=?").get(id);}finally{d.close();}
     if(!row||!(row.status==="integrity_ok"||options.importValidation&&row.status==="import_testing"))throw Error("Fixture archive not published");
     const file=path.join(root,row.slug,row.filename),valid=await backup.verify(file);if(valid.sha!==row.checksum)throw Error("Fixture checksum changed");return {file,name:row.filename,size:valid.size};
    };
    try{
     const importer=require("./backup-import.cjs").createBackupImporter({root,backup,recovery});
     const snapshot=importer.source([target],slug,"native.sql.gz").snapshot;
     const imported=await importer.importFile([target],slug,snapshot,"fixture-native-import",{jobId:crypto.randomUUID()});
     const duplicate=await importer.importFile([target],slug,snapshot,"fixture-native-import",{jobId:crypto.randomUUID()});
     if(duplicate.backupId!==imported.backupId||!duplicate.deduplicated||!(await fs.readFile(importSource)).equals(original))throw Error("Native import did not preserve/deduplicate its original");
     const db=importer.db();try{const row=db.prepare("SELECT * FROM backup_jobs WHERE id=?").get(imported.backupId);if(!require("./restore-evidence.cjs").latestEvidence(db,row).restoreTested)throw Error("Native import lacks restore proof");}finally{db.close();}
     results.at(-1).nativeImport={passed:true,deduplicated:true,originalPreserved:true};
     if(pg){
      const custom=await docker(["exec",source,"pg_dump","--format=custom","-U",spec.role,"-d","hub_restore_fixture"],{binary:true,maxOutput:64*1024**2});
      await fs.writeFile(path.join(directory,"native.dump"),custom,{mode:0o600});
      const customSnapshot=importer.source([target],slug,"native.dump").snapshot;
      const customImported=await importer.importFile([target],slug,customSnapshot,"fixture-native-import",{jobId:crypto.randomUUID()});
      const duplicateCustom=await importer.importFile([target],slug,customSnapshot,"fixture-native-import",{jobId:crypto.randomUUID()});
      if(!duplicateCustom.deduplicated||duplicateCustom.backupId!==customImported.backupId||!(await fs.readFile(path.join(directory,"native.dump"))).equals(custom))throw Error("Custom dump import not preserved/deduplicated");
      const db=importer.db();try{const proof=JSON.parse(db.prepare("SELECT manifest FROM backup_restore_checks WHERE backup_id=? ORDER BY rowid DESC LIMIT 1").get(customImported.backupId).manifest);if(proof.format!=="postgres-custom"||proof.tables!==2||proof.rows!==5)throw Error("Custom dump restore counts incorrect");}finally{db.close();}
      results.at(-1).customDumpImport={passed:true,deduplicated:true,originalPreserved:true};
     }
    }finally{backup.download=priorDownload;}
    await fs.writeFile(file,gzipSync("THIS IS NOT VALID SQL;\n"));
    let rejected=false;try{await createSandboxRunner().restore(target,file);}catch{rejected=true;}
    if(!rejected)throw Error("SQL inválido fue aceptado");
    results.at(-1).invalidSQLRejected=true;
    const brokenFK=(pg?"CREATE TABLE parent(id INTEGER PRIMARY KEY); CREATE TABLE child(parent_id INTEGER, FOREIGN KEY(parent_id) REFERENCES parent(id));":"CREATE DATABASE broken_fk; USE broken_fk; CREATE TABLE parent(id INTEGER PRIMARY KEY); CREATE TABLE child(parent_id INTEGER, FOREIGN KEY(parent_id) REFERENCES parent(id)); SET FOREIGN_KEY_CHECKS=0;")+" INSERT INTO child VALUES(999);";
    await fs.writeFile(file,gzipSync(brokenFK));
    let fkRejected=false;try{await createSandboxRunner().restore(target,file);}catch{fkRejected=true;}
    if(!fkRejected)throw Error("Relaciones sin correspondencia fueron aceptadas");
    results.at(-1).brokenForeignKeyRejected=true;
   }finally{await cleanup(source,spec);}
  }
  console.log(JSON.stringify({success:true,results},null,2));
 }finally{if(previousData===undefined)delete process.env.DATA_DIR;else process.env.DATA_DIR=previousData;await fs.rm(folder,{recursive:true,force:true});}
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={main};
