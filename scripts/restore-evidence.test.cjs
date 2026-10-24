"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),{DatabaseSync}=require("node:sqlite");
const {ensureRestoreSchema,latestEvidence}=require("./restore-evidence.cjs");
test("restore evidence migrates legacy checks without inventing proof and binds the latest result to exact bytes",()=>{
 const db=new DatabaseSync(":memory:");
 try{
  db.exec("CREATE TABLE backup_restore_checks(id TEXT PRIMARY KEY,backup_id TEXT,slug TEXT,checked_at TEXT,actor TEXT,status TEXT,details TEXT)");
  db.exec("INSERT INTO backup_restore_checks VALUES('old','archive','nanolabshub','2026-10-23','ci','passed','legacy')");
  ensureRestoreSchema(db);ensureRestoreSchema(db);
  const archive={id:"archive",checksum:"sha-a"};
  assert.equal(latestEvidence(db,archive).restoreTested,false);
  const add=db.prepare("INSERT INTO backup_restore_checks(id,backup_id,slug,checked_at,actor,status,details,checksum) VALUES(?,'archive','nanolabshub',?,'ci',?,'test',?)");
  add.run("one","2026-10-24T00:00:00Z","passed","sha-a");
  assert.deepEqual(latestEvidence(db,archive),{restoreTested:true,restoreStatus:"passed",restoreCheckedAt:"2026-10-24T00:00:00Z"});
  assert.equal(latestEvidence(db,{...archive,checksum:"sha-b"}).restoreTested,false);
  add.run("two","2026-10-24T00:01:00Z","failed","sha-a");
  assert.equal(latestEvidence(db,archive).restoreStatus,"failed");
  assert.equal(latestEvidence(db,archive).restoreTested,false);
  add.run("three","2026-10-24T00:01:00Z","passed","sha-a");
  assert.equal(latestEvidence(db,archive).restoreTested,true,"rowid breaks equal timestamp ties");
 }finally{db.close();}
});
