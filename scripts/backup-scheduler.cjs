"use strict";
async function dispatch() {
  const key=process.env.HUB_BACKUP_SCHEDULER_KEY||"";
  if(key.length<32){console.error("Scheduler: falta HUB_BACKUP_SCHEDULER_KEY");return;}
  try{
    const r=await fetch("http://nanolabshub:3000/api/backups/schedule/run",{
      method:"POST",headers:{Authorization:"Bearer "+key},
      signal:AbortSignal.timeout(22*60*1000)
    });
    if(!r.ok)console.error("Scheduler: HTTP",r.status);
    else{const body=await r.json();if(body.data?.length)console.log("Scheduler:",JSON.stringify(body.data));}
  }catch(e){console.error("Scheduler:",e.message);}
}
let pending=false;
async function tick(){if(pending)return;pending=true;try{await dispatch();}finally{pending=false;}}
setInterval(()=>void tick(),5*60*1000);
void tick();
