"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fsp=require("node:fs/promises"),os=require("node:os"),path=require("node:path"),crypto=require("node:crypto");
const {gzipSync}=require("node:zlib"),{DatabaseSync}=require("node:sqlite");
test("SQLite copy validation happens on isolated files and records an audit trail",async()=>{
 const work=await fsp.mkdtemp(path.join(os.tmpdir(),"nano-restore-"));
 const old={dir:process.env.DATA_DIR,enabled:process.env.HUB_BACKUPS_ENABLED};
 process.env.DATA_DIR=work;process.env.HUB_BACKUPS_ENABLED="true";
 const backup=require("./backup-engine.cjs"),original=backup.download;
 const file=path.join(work,"test.sqlite");
 try {
  const db=new DatabaseSync(file);
  db.exec("CREATE TABLE restored_record (id INTEGER PRIMARY KEY, value TEXT); INSERT INTO restored_record(value) VALUES ('saved');");
  db.close();
  const gz=path.join(work,"fixture_sqlite.gz");
  const originalContent=await fsp.readFile(file);
  await fsp.writeFile(gz,gzipSync(originalContent));
  const bytes=(await fsp.stat(gz)).size;
  const audit=backup.db();
  try { audit.exec("CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY,timestamp TEXT,user TEXT,action TEXT,target TEXT,details TEXT)"); }
  finally { audit.close(); }
  backup.download=async()=>({file:gz,size:bytes,name:"nanolabshub_20261022_sqlite.sqlite.gz"});
  const recovery=require("./recovery-engine.cjs");
  const id=crypto.randomUUID(), apps=[{slug:"nanolabshub",dbType:"sqlite"}];
  const checksum=(await backup.verify(gz)).sha;
  const registry=backup.db();try{registry.prepare("INSERT INTO backup_jobs(id,slug,db_type,status,created_at,trigger,checksum) VALUES(?,?,?,'integrity_ok',?,'test',?)").run(id,"nanolabshub","sqlite",new Date().toISOString(),checksum);}finally{registry.close();}
  const result=await recovery.checkIsolated(apps,id,"ci");
  assert.equal(result.status,"passed");
  assert.match(result.details,/integrity_check=ok/);
  assert.equal(recovery.listChecks("nanolabshub").length,1);
  assert.equal(recovery.listChecks()[0].durationMs,result.durationMs);
  assert.equal(recovery.listChecks("nanolabshub")[0].durationMs,result.durationMs);
  assert.equal(result.checksum,checksum);
  const rows=backup.db();try{
   assert.equal(rows.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action='BACKUP_RESTORE_CHECK_PASSED'").get().n,1);
   const manifest=JSON.parse(rows.prepare("SELECT manifest FROM backup_restore_checks WHERE backup_id=?").get(id).manifest);
   assert.deepEqual(manifest.tables,[{table:"restored_record",rows:1}]);
   assert.equal(manifest.comparison,"restored-copy-only");
   assert.equal(manifest.applicationStarted,false);
  }finally{rows.close();}
  assert.equal((await fsp.readFile(file)).compare(originalContent),0,"source SQLite must remain identical");
  assert.equal((await fsp.readdir(work)).filter(x=>x.startsWith("isolated-restore-")).length,0);
  const corrupt=path.join(work,"invalid-fk.sqlite"),bad=new DatabaseSync(corrupt);
  try{bad.exec("PRAGMA foreign_keys=OFF; CREATE TABLE parent(id INTEGER PRIMARY KEY); CREATE TABLE child(parent_id INTEGER REFERENCES parent(id)); INSERT INTO child VALUES(999)");}finally{bad.close();}
  await fsp.writeFile(gz,gzipSync(await fsp.readFile(corrupt)));
  const changed=(await backup.verify(gz)).sha,update=backup.db();
  try{update.prepare("UPDATE backup_jobs SET checksum=? WHERE id=?").run(changed,id);}finally{update.close();}
  await assert.rejects(recovery.checkIsolated(apps,id,"ci"),/foreign_key_check/);
  const evidenceDb=backup.db();try{
   assert.equal(require("./restore-evidence.cjs").latestEvidence(evidenceDb,{id,checksum:changed}).restoreStatus,"failed");
  }finally{evidenceDb.close();}
  assert.equal((await fsp.readdir(work)).includes("isolated-restore.lock"),false,"normal failed checks release only their own lock");
  await assert.rejects(recovery.checkIsolated(apps,"../file","ci"));
  // Legacy records from protected apps are never opened, even if called without HTTP guards.
  const protectedId=crypto.randomUUID(), protectedDb=backup.db();
  try{protectedDb.prepare("INSERT INTO backup_jobs(id,slug,db_type,status,created_at,trigger) VALUES(?,?,?,'integrity_ok',?,'test')").run(protectedId,"onlypadel","postgres",new Date().toISOString());}finally{protectedDb.close();}
  let opens=0;backup.download=async()=>{opens++;throw Error("must not read");};
  await assert.rejects(recovery.checkIsolated([{slug:"onlypadel",dbType:"postgres"}],protectedId,"ci"),/fuera del alcance/);
  assert.equal(opens,0);
 }finally{
  backup.download=original;
  if(old.dir===undefined)delete process.env.DATA_DIR;else process.env.DATA_DIR=old.dir;
  if(old.enabled===undefined)delete process.env.HUB_BACKUPS_ENABLED;else process.env.HUB_BACKUPS_ENABLED=old.enabled;
  await fsp.rm(work,{recursive:true,force:true});
 }
});
