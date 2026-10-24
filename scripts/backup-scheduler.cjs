"use strict";
const fs=require("node:fs");
const HEARTBEAT="/tmp/nanolabs-scheduler-heartbeat";

async function dispatch() {
  const key=process.env.HUB_BACKUP_SCHEDULER_KEY||"";
  if(Buffer.byteLength(key)<32){console.error("Scheduler: falta HUB_BACKUP_SCHEDULER_KEY segura");return false;}
  try {
    const response=await fetch("http://nanolabshub:3000/api/backups/schedule/run",{
      method:"POST",
      headers:{Authorization:"Bearer "+key},
      signal:AbortSignal.timeout(32*60*1000)
    });
    if(!response.ok){console.error("Scheduler: Hub HTTP",response.status);return false;}
    const payload=await response.json();
    if(payload.success!==true || !Array.isArray(payload.data)){
      console.error("Scheduler: respuesta de Hub inválida");
      return false;
    }
    // Heartbeat means the authenticated scheduler reached the Hub successfully;
    // it does NOT mean a particular backup was restored or completed.
    fs.writeFileSync(HEARTBEAT,String(Date.now()),{mode:0o600});
    if(payload.data.length)console.log("Scheduler:",JSON.stringify(payload.data));
    return true;
  }catch(e){
    console.error("Scheduler:",e instanceof Error?e.message:"error inesperado");
    return false;
  }
}
let running=false;
async function tick(){if(running)return;running=true;try{await dispatch();}finally{running=false;}}
setInterval(()=>void tick(),30*1000);
void tick();
