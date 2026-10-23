"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {isHealthy,MAX_AGE_MS}=require("./backup-scheduler-health.cjs");

test("scheduler is unhealthy without a successful poll",()=>{
  assert.equal(isHealthy(path.join(os.tmpdir(),"missing-nanolabs-heartbeat-"+process.pid)),false);
});
test("scheduler heartbeat must be recent, numeric and not far in the future",()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"hub-scheduler-test-"));
  const file=path.join(dir,"heartbeat");
  const now=1_800_000_000_000;
  try {
    fs.writeFileSync(file,String(now));
    assert.equal(isHealthy(file,now),true);
    fs.writeFileSync(file,String(now-MAX_AGE_MS-1));
    assert.equal(isHealthy(file,now),false);
    fs.writeFileSync(file,String(now+61_000));
    assert.equal(isHealthy(file,now),false);
    fs.writeFileSync(file,"invalid");
    assert.equal(isHealthy(file,now),false);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
