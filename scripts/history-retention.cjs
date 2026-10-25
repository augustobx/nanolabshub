"use strict";
// Read-only evidence. History and registered archives have no automatic purge.
const fs=require("node:fs/promises"),path=require("node:path");
const TABLES=["audit_log","metrics_history","hub_jobs","hub_job_events","app_lifecycle_events","backup_jobs","backup_restore_checks"];
const POLICY={mode:"preserve-all",automaticDeletion:false,historyDays:null,backupDays:null,scope:"hub-managed-history-and-registered-backups",externalHostTasksVerified:false};
function createRetentionReport({open=()=>require("./backup-engine.cjs").db(),download=(apps,id)=>require("./backup-engine.cjs").download(apps,id),statfs=p=>fs.statfs(p),dataDir=process.env.DATA_DIR||"/app/data",backupDir="/opt/backups/nanolabshub"}={}){
 return async function report(apps){
  const db=open();let histories,archive,check;
  try{
   db.exec("BEGIN");
   const exists=t=>!!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(t);
   histories=TABLES.map(table=>({table,rows:exists(table)?db.prepare('SELECT COUNT(*) AS n FROM "'+table+'"').get().n:null}));
   archive=exists("backup_jobs")?db.prepare("SELECT id,checksum,created_at AS capturedAt FROM backup_jobs WHERE slug='nanolabshub' AND db_type='sqlite' AND status='integrity_ok' AND trigger IN ('manual','scheduled','release') ORDER BY created_at DESC,rowid DESC LIMIT 1").get():null;
   check=archive&&exists("backup_restore_checks")?db.prepare("SELECT status,checksum,manifest,checked_at AS checkedAt FROM backup_restore_checks WHERE backup_id=? ORDER BY checked_at DESC,rowid DESC LIMIT 1").get(archive.id):null;
   db.exec("COMMIT");
  }finally{db.close();}
  let recovery={status:archive?"unproven":"missing",backupId:archive?.id??null,capturedAt:archive?.capturedAt??null,checksum:archive?.checksum??null,checkedAt:null,tables:[]};
  if(check?.status==="passed"&&check.checksum===archive.checksum){
   try{
    const manifest=JSON.parse(check.manifest);
    if(manifest?.engine!=="sqlite"||!Array.isArray(manifest.tables)||!TABLES.every(t=>manifest.tables.some(x=>x.table===t&&Number.isSafeInteger(x.rows)&&x.rows>=0)))throw Error("Incomplete history evidence");
    // download() rechecks size, gzip and SHA-256 against the registry; no HTTP download.
    await download(apps,archive.id);
    recovery={...recovery,status:"passed",checkedAt:check.checkedAt,tables:manifest.tables.filter(x=>TABLES.includes(x.table))};
   }catch{recovery.status="unproven";}
  }
  const volumes=await Promise.all([["hub-data",path.resolve(dataDir)],["hub-backups",backupDir]].map(async([volume,dir])=>{
   try{const s=await statfs(dir),capacityBytes=s.blocks*s.bsize,freeBytes=s.bavail*s.bsize;if(!Number.isFinite(capacityBytes)||capacityBytes<=0||!Number.isFinite(freeBytes)||freeBytes<0||freeBytes>capacityBytes)throw Error("Unknown capacity");const usedPercent=100*(1-freeBytes/capacityBytes);return {volume,capacityBytes,freeBytes,usedPercent,status:usedPercent>=95?"critical":usedPercent>=85?"warning":"ok"};}
   catch{return {volume,status:"unknown",capacityBytes:null,freeBytes:null,usedPercent:null};}
  }));
  return {policy:POLICY,checkedAt:new Date().toISOString(),histories,recovery,volumes};
 };
}
module.exports={createRetentionReport,TABLES};
