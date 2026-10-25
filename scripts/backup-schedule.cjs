"use strict";
const {createHash}=require("node:crypto");
function ensureScheduleSchema(db){
 const definitions=[["interval_hours","INTEGER NOT NULL DEFAULT 24"],["auto_restore","INTEGER NOT NULL DEFAULT 0"],["last_run_slot","TEXT"]];
 const columns=()=>new Set(db.prepare("PRAGMA table_info(backup_schedules)").all().map(c=>c.name));
 if(definitions.every(([name])=>columns().has(name)))return;
 db.exec("BEGIN IMMEDIATE");try{const existing=columns();for(const [name,type] of definitions)if(!existing.has(name))db.exec(`ALTER TABLE backup_schedules ADD COLUMN ${name} ${type}`);db.exec("COMMIT");}catch(e){db.exec("ROLLBACK");throw e;}
}
function configuration(schedule){return {hourLocal:schedule.hourLocal,intervalHours:schedule.intervalHours??24,autoRestore:!!schedule.autoRestore,weekdays:schedule.weekdays.split(",").sort().join(",")};}
function configurationHash(schedule){return createHash("sha256").update(JSON.stringify(configuration(schedule))).digest("hex").slice(0,16);}
function latestSlot(schedule,now){
 const cfg=configuration(schedule);if(![6,12,24].includes(cfg.intervalHours)||!Number.isInteger(cfg.hourLocal)||cfg.hourLocal<0||cfg.hourLocal>=cfg.intervalHours||Number.isNaN(now.getTime()))throw Error("Agenda inválida");
 const parts=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:"America/Argentina/Buenos_Aires",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",hourCycle:"h23"}).formatToParts(now).map(p=>[p.type,p.value])),today=parts.year+"-"+parts.month+"-"+parts.day;
 // Calendar slots in Buenos Aires. Missed snapshots cannot be recreated: only
 // the latest due slot is queued, and the archive retains its actual creation time.
 for(let days=0;days<=7;days++){
  const date=new Date(Date.parse(today+"T12:00:00Z")-days*86400000),day=date.toISOString().slice(0,10),weekday=String(date.getUTCDay());
  if(!cfg.weekdays.split(",").includes(weekday))continue;
  for(let hour=cfg.hourLocal+Math.floor((23-cfg.hourLocal)/cfg.intervalHours)*cfg.intervalHours;hour>=cfg.hourLocal;hour-=cfg.intervalHours){
   if(days===0&&hour>Number(parts.hour))continue;
   const slotKey=day+"T"+String(hour).padStart(2,"0")+":00",legacy=cfg.intervalHours===24&&!cfg.autoRestore;
   return {day,slotKey,configurationHash:configurationHash(schedule),intervalHours:cfg.intervalHours,restoreAfterBackup:cfg.autoRestore,legacy,key:legacy?"scheduled:"+day:"scheduled:"+slotKey+":"+cfg.intervalHours+":"+configurationHash(schedule)};
  }
 }
 return null;
}
module.exports={ensureScheduleSchema,configurationHash,latestSlot};
