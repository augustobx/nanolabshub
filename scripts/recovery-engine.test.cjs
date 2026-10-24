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
  backup.download=async()=>({file:gz,size:bytes,name:"fixture_20261022_sqlite.sqlite.gz"});
  const recovery=require("./recovery-engine.cjs");
  const id=crypto.randomUUID(), apps=[{slug:"fixture",dbType:"sqlite"}];
  const result=await recovery.checkIsolated(apps,id,"ci");
  assert.equal(result.status,"passed");
  assert.match(result.details,/integrity_check=ok/);
  assert.equal(recovery.listChecks("fixture").length,1);
  const rows=backup.db();try{
   assert.equal(rows.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action='BACKUP_SQLITE_CHECK_PASSED'").get().n,1);
  }finally{rows.close();}
  assert.equal((await fsp.readFile(file)).compare(originalContent),0,"source SQLite must remain identical");
  assert.equal((await fsp.readdir(work)).filter(x=>x.startsWith("isolated-restore-")).length,0);
  await assert.rejects(recovery.checkIsolated(apps,"../file","ci"));
 }finally{
  backup.download=original;
  if(old.dir===undefined)delete process.env.DATA_DIR;else process.env.DATA_DIR=old.dir;
  if(old.enabled===undefined)delete process.env.HUB_BACKUPS_ENABLED;else process.env.HUB_BACKUPS_ENABLED=old.enabled;
  await fsp.rm(work,{recursive:true,force:true});
 }
});
