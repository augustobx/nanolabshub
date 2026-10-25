"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs/promises"),os=require("node:os"),path=require("node:path"),crypto=require("node:crypto"),{DatabaseSync}=require("node:sqlite");
const {createBackupImporter}=require("./backup-import.cjs"),{createImportRunner}=require("./import-runner.cjs"),{createJobStore}=require("./job-store.cjs");
test("external SQLite import preserves the original, validates before publication, deduplicates and records provenance",async()=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),"hub-import-test-")),root=path.join(temp,"backups"),directory=path.join(root,"nanolabshub");
 const previous={dir:process.env.DATA_DIR,enabled:process.env.HUB_BACKUPS_ENABLED};process.env.DATA_DIR=temp;process.env.HUB_BACKUPS_ENABLED="true";
 const backup=require("./backup-engine.cjs"),originalDownload=backup.download,recovery=require("./recovery-engine.cjs");
 const apps=[{slug:"nanolabshub",name:"Hub fixture",dbType:"sqlite",sqlitePath:"/opt/apps/fixture.sqlite"}],store=createJobStore({dataDir:temp});
 await fs.mkdir(directory,{recursive:true});
 backup.download=async(a,id,options={})=>{
  const d=backup.db();let row;try{row=d.prepare("SELECT * FROM backup_jobs WHERE id=?").get(id);}finally{d.close();}
  if(!row||!(row.status==="integrity_ok"||options.importValidation&&row.status==="import_testing"))throw Error("not published");
  const file=path.join(root,row.slug,row.filename),v=await backup.verify(file);assert.equal(v.sha,row.checksum);return {file,name:row.filename,size:v.size};
 };
 let stagedChecks=0,permitted=true;
 const importer=createBackupImporter({root,backup,recovery:{checkIsolated:async(...args)=>{
  if(args[3]?.importValidation){stagedChecks++;assert.ok(!backup.list(apps).some(b=>b.id===args[1]));await assert.rejects(originalDownload(apps,args[1]),/no registrado/);}
  return recovery.checkIsolated(...args);
 }}});
 const runner=createImportRunner({importer,backup,store,validateActor:()=>permitted,enabled:()=>true,dataDir:temp});
 try{
  const source=path.join(directory,"hub-existing.sqlite"),d=new DatabaseSync(source);
  try{d.exec("CREATE TABLE parent(id INTEGER PRIMARY KEY); CREATE TABLE child(id INTEGER PRIMARY KEY,parent_id INTEGER REFERENCES parent(id)); INSERT INTO parent VALUES(1),(2); INSERT INTO child VALUES(11,1),(12,2),(13,1)");}finally{d.close();}
  const original=await fs.readFile(source),sourceHash=crypto.createHash("sha256").update(original).digest("hex");
  const candidates=importer.candidates(apps);assert.equal(candidates[0].files[0].supported,true);
  const key=crypto.randomUUID(),queued=runner.enqueue(apps,"nanolabshub","hub-existing.sqlite",key,"fixture-owner");
  assert.equal(runner.enqueue(apps,"nanolabshub","hub-existing.sqlite",key,"fixture-owner").id,queued.id);
  assert.equal((await runner.tick(apps))[0].status,"import-passed",store.get(queued.id).error);
  assert.equal(store.get(queued.id).state,"succeeded");assert.equal(stagedChecks,1);
  assert.equal(backup.list(apps).find(b=>b.id===queued.id).capturedAt,null,"Import time must not become a false snapshot/RPO timestamp");
  assert.deepEqual(await fs.readFile(source),original);
  const db=importer.db();try{
   const record=db.prepare("SELECT * FROM backup_jobs WHERE id=?").get(queued.id),proof=db.prepare("SELECT * FROM backup_imports WHERE job_id=?").get(queued.id);
   assert.equal(record.status,"integrity_ok");assert.equal(record.trigger,"imported");assert.equal(proof.source_checksum,sourceHash);assert.equal(proof.deduplicated,0);
   assert.equal(require("./restore-evidence.cjs").latestEvidence(db,record).restoreTested,true);
  }finally{db.close();}
  const repeat=runner.enqueue(apps,"nanolabshub","hub-existing.sqlite",crypto.randomUUID(),"fixture-owner");await runner.tick(apps);
  assert.equal(store.get(repeat.id).result.backupId,queued.id);assert.equal(store.get(repeat.id).result.deduplicated,true);
  const check=importer.db();try{assert.equal(check.prepare("SELECT count(*) AS n FROM backup_jobs WHERE status='integrity_ok'").get().n,1);assert.equal(check.prepare("SELECT count(*) AS n FROM backup_imports").get().n,2);}finally{check.close();}
  assert.deepEqual(await fs.readFile(source),original);
  const denied=runner.enqueue(apps,"nanolabshub","hub-existing.sqlite",crypto.randomUUID(),"fixture-owner");permitted=false;await runner.tick(apps);assert.equal(store.get(denied.id).state,"failed");permitted=true;
  assert.throws(()=>importer.source(apps,"nanolabshub","../hub.sqlite"),/Formato no admitido/);
  assert.throws(()=>importer.source([{slug:"onlypadel",dbType:"postgres"}],"onlypadel","fixture.sql.gz"),/fuera del alcance/);
  const stale=importer.source(apps,"nanolabshub","hub-existing.sqlite").snapshot;await fs.appendFile(source,"changed");
  await assert.rejects(importer.importFile(apps,"nanolabshub",stale,"fixture-owner",{jobId:crypto.randomUUID()}),/cambió desde la solicitud/);
  const invalid=path.join(directory,"invalid.sqlite"),bad=new DatabaseSync(invalid);
  try{bad.exec("PRAGMA foreign_keys=OFF; CREATE TABLE parent(id INTEGER PRIMARY KEY); CREATE TABLE child(parent_id INTEGER REFERENCES parent(id)); INSERT INTO child VALUES(999)");}finally{bad.close();}
  const rejected=runner.enqueue(apps,"nanolabshub","invalid.sqlite",crypto.randomUUID(),"fixture-owner");await runner.tick(apps);assert.equal(store.get(rejected.id).state,"failed");
  const failed=importer.db();try{assert.equal(failed.prepare("SELECT status FROM backup_jobs WHERE id=?").get(rejected.id).status,"failed");assert.equal(failed.prepare("SELECT count(*) AS n FROM backup_imports WHERE job_id=?").get(rejected.id).n,0);}finally{failed.close();}
  assert.equal((await fs.readdir(directory)).filter(n=>n.endsWith(".part")).length,0);
 }finally{
  backup.download=originalDownload;
  if(previous.dir===undefined)delete process.env.DATA_DIR;else process.env.DATA_DIR=previous.dir;
  if(previous.enabled===undefined)delete process.env.HUB_BACKUPS_ENABLED;else process.env.HUB_BACKUPS_ENABLED=previous.enabled;
  for(const file of ["./backup-engine.cjs","./recovery-engine.cjs"])delete require.cache[require.resolve(file)];
  await fs.rm(temp,{recursive:true,force:true});
 }
});
test("import rejects symlinked roots and files before opening their contents",{skip:process.platform==="win32"},async()=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),"hub-import-symlinks-"));
 try{
  const real=path.join(temp,"real"),root=path.join(temp,"backups");await fs.mkdir(path.join(real,"nanolabshub"),{recursive:true});
  await fs.symlink(real,root);
  const apps=[{slug:"nanolabshub",dbType:"sqlite"}],importer=createBackupImporter({root,backup:{},recovery:{}});
  assert.throws(()=>importer.source(apps,"nanolabshub","fixture.sqlite"),/Directorio/);
  await fs.unlink(root);await fs.mkdir(path.join(root,"nanolabshub"),{recursive:true});await fs.writeFile(path.join(real,"secret.sqlite"),Buffer.alloc(100));
  await fs.symlink(path.join(real,"secret.sqlite"),path.join(root,"nanolabshub","fixture.sqlite"));
  assert.throws(()=>importer.source(apps,"nanolabshub","fixture.sqlite"),/Archivo inseguro/);
 }finally{await fs.rm(temp,{recursive:true,force:true});}
});
