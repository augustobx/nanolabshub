const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs/promises");
const os=require("node:os");
const path=require("node:path");
const crypto=require("node:crypto");
const {gzipSync}=require("node:zlib");
const {gunzipSync}=require("node:zlib"),{DatabaseSync}=require("node:sqlite");

test("native SQLite snapshot preserves rows and source bytes, including Node without sqlite.backup",async()=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),"hub-snapshot-test-"));
 const oldDir=process.env.DATA_DIR;process.env.DATA_DIR=temp;
 try{
  const source=path.join(temp,"source.sqlite"),copy=path.join(temp,"copy.sqlite"),gz=path.join(temp,"snapshot.sqlite.gz");
  const db=new DatabaseSync(source);db.exec("CREATE TABLE fixture(id INTEGER PRIMARY KEY,value TEXT); INSERT INTO fixture(value) VALUES('saved'),('second'),('third')");db.close();
  const before=await fs.readFile(source);
  await require("./backup-engine.cjs").snapshotSQLite({sqlitePath:source},gz);
  await fs.writeFile(copy,gunzipSync(await fs.readFile(gz)));
  const restored=new DatabaseSync(copy,{readOnly:true});try{assert.equal(restored.prepare("SELECT COUNT(*) AS n FROM fixture").get().n,3);assert.equal(restored.prepare("PRAGMA integrity_check").get().integrity_check,"ok");}finally{restored.close();}
  assert.deepEqual(await fs.readFile(source),before);
 }finally{if(oldDir===undefined)delete process.env.DATA_DIR;else process.env.DATA_DIR=oldDir;delete require.cache[require.resolve("./backup-engine.cjs")];await fs.rm(temp,{recursive:true,force:true});}
});

test("backup integrity and safe schedules without touching any production DB",async()=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),"nano-backup-test-"));
 process.env.DATA_DIR=temp;
 const engine=require("./backup-engine.cjs");
 const d=engine.db();
 d.exec("CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY AUTOINCREMENT,timestamp TEXT NOT NULL,user TEXT NOT NULL,action TEXT NOT NULL,target TEXT NOT NULL,details TEXT NOT NULL)");
 d.close();
 const apps=[{slug:"backup-fixture",name:"Backup fixture",dbType:"mariadb",dbContainer:"backup-fixture-db",containerNames:["backup-fixture-web","backup-fixture-db"]}];
 try{
  const good=path.join(temp,"good.sql.gz");
  const contents=Buffer.from("CREATE TABLE test_backup(id INTEGER);\nINSERT INTO test_backup VALUES (42);\n");
  const compressed=gzipSync(contents);
  await fs.writeFile(good,compressed);
  const integrity=await engine.verify(good);
  assert.equal(integrity.sha,crypto.createHash("sha256").update(compressed).digest("hex"));
  assert.equal(integrity.size,compressed.length);
  const invalid=path.join(temp,"broken.sql.gz");
  await fs.writeFile(invalid,Buffer.alloc(120,0x61));
  await assert.rejects(engine.verify(invalid));
  engine.schedule(apps,"backup-fixture",{enabled:true,hourLocal:3,weekdays:"0,1,2,3,4,5,6"},"ci");
  assert.equal(engine.schedules(apps)[0].enabled,true);
  assert.equal(engine.schedules(apps)[0].hourLocal,3);
  assert.throws(()=>engine.schedule(apps,"backup-fixture",{enabled:true,hourLocal:24,weekdays:"0"},"ci"));
  assert.throws(()=>engine.schedule(apps,"unknown",{enabled:true,hourLocal:3,weekdays:"0"},"ci"));
  await assert.rejects(engine.download(apps,"../../etc/passwd"));
  process.env.HUB_BACKUPS_ENABLED="false";
  assert.deepEqual(await engine.tick(apps),[]);
 }finally{await fs.rm(temp,{recursive:true,force:true});}
});
