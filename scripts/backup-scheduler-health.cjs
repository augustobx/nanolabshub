"use strict";
const fs=require("node:fs");
const HEARTBEAT="/tmp/nanolabs-scheduler-heartbeat";
const MAX_AGE_MS=35*60*1000;
function isHealthy(file=HEARTBEAT,now=Date.now()){
  try{
    const timestamp=Number(fs.readFileSync(file,"utf8").trim());
    return Number.isFinite(timestamp)&&timestamp>0&&timestamp<=now+60*1000&&now-timestamp<MAX_AGE_MS;
  }catch{return false;}
}
if(require.main===module)process.exit(isHealthy()?0:1);
module.exports={isHealthy,MAX_AGE_MS,HEARTBEAT};
