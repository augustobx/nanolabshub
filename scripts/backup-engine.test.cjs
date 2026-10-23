const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs/promises");
const os=require("node:os");
const path=require("node:path");
const crypto=require("node:crypto");
const {gzipSync}=require("node:zlib");

test("backup integrity and safe schedules without touching any production DB",async()=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),"nano-backup-test-"));
 process.env.DATA_DIR=temp;
 const engine=require("./backup-engine.cjs");
 const d=engine.db();
 d.exec("CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY AUTOINCREMENT,timestamp TEXT NOT NULL,user TEXT NOT NULL,action TEXT NOT NULL,target TEXT NOT NULL,details TEXT NOT NULL)");
 d.close();
 const apps=[{slug:"onlypadel",name:"OnlyPadel",dbType:"mariadb",dbContainer:"onlypadel-db",containerNames:["onlypadel-web","onlypadel-db"]}];
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
  engine.schedule(apps,"onlypadel",{enabled:true,hourLocal:3,weekdays:"0,1,2,3,4,5,6"},"ci");
  assert.equal(engine.schedules(apps)[0].enabled,true);
  assert.equal(engine.schedules(apps)[0].hourLocal,3);
  assert.throws(()=>engine.schedule(apps,"onlypadel",{enabled:true,hourLocal:24,weekdays:"0"},"ci"));
  assert.throws(()=>engine.schedule(apps,"unknown",{enabled:true,hourLocal:3,weekdays:"0"},"ci"));
  await assert.rejects(engine.download(apps,"../../etc/passwd"));
  process.env.HUB_BACKUPS_ENABLED="false";
  assert.deepEqual(await engine.tick(apps),[]);
 }finally{await fs.rm(temp,{recursive:true,force:true});}
});
