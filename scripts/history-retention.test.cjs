"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),{DatabaseSync}=require("node:sqlite"),{createRetentionReport,TABLES}=require("./history-retention.cjs");
function fixture({status="passed",checksum="a".repeat(64),manifest,archive=true,download=async()=>{},statfs=async()=>({blocks:100,bsize:1024,bavail:50})}={}){
 const db=new DatabaseSync(":memory:");
 for(const t of TABLES)db.exec(`CREATE TABLE ${t}(id TEXT)`);
 db.exec("DROP TABLE backup_jobs;CREATE TABLE backup_jobs(id TEXT,slug TEXT,db_type TEXT,status TEXT,trigger TEXT,created_at TEXT,checksum TEXT);DROP TABLE backup_restore_checks;CREATE TABLE backup_restore_checks(backup_id TEXT,status TEXT,checksum TEXT,manifest TEXT,checked_at TEXT)");
 db.exec("INSERT INTO audit_log VALUES('retained')");
 if(archive)db.prepare("INSERT INTO backup_jobs VALUES('copy','nanolabshub','sqlite','integrity_ok','scheduled','2026-10-25',?)").run("a".repeat(64));
 db.prepare("INSERT INTO backup_restore_checks VALUES('copy',?,?,?,'2026-10-25')").run(status,checksum,manifest??JSON.stringify({engine:"sqlite",tables:TABLES.map(table=>({table,rows:1}))}));
 return {db,report:createRetentionReport({open:()=>({exec:s=>db.exec(s),prepare:s=>db.prepare(s),close:()=>{}}),download,statfs})};
}
test("preserve-all exposes current counts and checksum-bound restored snapshot without purging",async()=>{
 let downloads=0;const {db,report}=fixture({download:async(apps,id)=>{assert.equal(id,"copy");downloads++;}});
 try{const r=await report([]);assert.equal(r.policy.automaticDeletion,false);assert.equal(r.policy.historyDays,null);assert.equal(r.policy.backupDays,null);assert.equal(r.policy.externalHostTasksVerified,false);assert.equal(r.histories.find(t=>t.table==="audit_log").rows,1);assert.equal(r.recovery.status,"passed");assert.equal(downloads,1);assert.equal(db.prepare("SELECT COUNT(*) AS n FROM audit_log").get().n,1);}finally{db.close();}
});
test("failed, changed, incomplete and unavailable archives never certify history recovery",async()=>{
 for(const options of [{status:"failed"},{checksum:"b".repeat(64)},{manifest:"{}"},{manifest:"bad json"},{manifest:JSON.stringify({engine:"sqlite",tables:[]})},{download:async()=>{throw Error("changed bytes");}}]){
  const {db,report}=fixture(options);try{assert.equal((await report([])).recovery.status,"unproven");}finally{db.close();}
 }
});
test("no archive and missing tables remain unknown; disk thresholds are observable",async()=>{
 const {db,report}=fixture({archive:false,statfs:async()=>({blocks:100,bsize:1024,bavail:4})});
 try{db.exec("DROP TABLE metrics_history");const r=await report([]);assert.equal(r.recovery.status,"missing");assert.equal(r.histories.find(t=>t.table==="metrics_history").rows,null);assert(r.volumes.every(v=>v.status==="critical"));}finally{db.close();}
 for(const [free,status] of [[15,"warning"],[16,"ok"],[-1,"unknown"]]){const f=fixture({statfs:async()=>({blocks:100,bsize:1,bavail:free})});try{assert.equal((await f.report([])).volumes[0].status,status);}finally{f.db.close();}}
});
test("a newer untested copy cannot borrow an older restore proof or imported timestamp",async()=>{
 const {db,report}=fixture();try{
  db.prepare("INSERT INTO backup_jobs VALUES('import','nanolabshub','sqlite','integrity_ok','imported','2027-01-01',?)").run("a".repeat(64));
  assert.equal((await report([])).recovery.backupId,"copy");
  db.prepare("INSERT INTO backup_jobs VALUES('new','nanolabshub','sqlite','integrity_ok','scheduled','2026-10-26',?)").run("a".repeat(64));
  const r=await report([]);assert.equal(r.recovery.backupId,"new");assert.equal(r.recovery.status,"unproven");assert.deepEqual(r.recovery.tables,[]);
 }finally{db.close();}
});
