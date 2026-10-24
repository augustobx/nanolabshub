"use strict";
const {DatabaseSync}=require("node:sqlite"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
function createJobStore({dataDir,clock=Date.now,leaseMs=120000}){
  function db(){fs.mkdirSync(dataDir,{recursive:true,mode:0o700});const d=new DatabaseSync(path.join(dataDir,"hub.sqlite"));d.exec(`PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS hub_jobs(id TEXT PRIMARY KEY,kind TEXT NOT NULL,resource TEXT NOT NULL,idempotency_key TEXT NOT NULL UNIQUE,payload TEXT NOT NULL,actor TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN ('pending','running','succeeded','failed','uncertain','cancelled')),attempts INTEGER NOT NULL DEFAULT 0,max_attempts INTEGER NOT NULL,due_at INTEGER NOT NULL,lease_owner TEXT,lease_until INTEGER,heartbeat INTEGER,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,error TEXT,result TEXT);
    CREATE INDEX IF NOT EXISTS hub_jobs_due ON hub_jobs(state,due_at);
    CREATE UNIQUE INDEX IF NOT EXISTS hub_jobs_resource ON hub_jobs(kind,resource) WHERE state='running';
    CREATE TABLE IF NOT EXISTS hub_job_events(id INTEGER PRIMARY KEY AUTOINCREMENT,job_id TEXT NOT NULL,at INTEGER NOT NULL,state TEXT NOT NULL,details TEXT NOT NULL);`);return d;}
  function use(fn){const d=db();try{return fn(d);}finally{d.close();}}
  function tx(d,fn){d.exec("BEGIN IMMEDIATE");try{const x=fn();d.exec("COMMIT");return x;}catch(error){d.exec("ROLLBACK");throw error;}}
  function event(d,id,state,details){d.prepare("INSERT INTO hub_job_events(job_id,at,state,details) VALUES(?,?,?,?)").run(id,clock(),state,details);}
  function row(d,id){const x=d.prepare("SELECT * FROM hub_jobs WHERE id=?").get(id);return x?{...x,payload:JSON.parse(x.payload),result:x.result?JSON.parse(x.result):null}:null;}
  function enqueue({kind,resource,key,payload={},actor,maxAttempts=3}){
    if(!/^[a-z][a-z.-]{0,40}$/.test(kind)||!/^[a-z0-9-]{1,80}$/.test(resource)||typeof key!=="string"||key.length>200||!key||typeof actor!=="string"||actor.length>120||!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>5||Buffer.byteLength(JSON.stringify(payload))>16384)throw Error("Trabajo inválido");
    return use(d=>tx(d,()=>{
      const idempotency=kind+":"+resource+":"+key,old=d.prepare("SELECT id,payload,actor FROM hub_jobs WHERE idempotency_key=?").get(idempotency);
      if(old){if(old.payload!==JSON.stringify(payload)||old.actor!==actor)throw Error("Conflicto de idempotencia");return row(d,old.id);}
      const id=crypto.randomUUID(),now=clock();d.prepare("INSERT INTO hub_jobs(id,kind,resource,idempotency_key,payload,actor,state,max_attempts,due_at,created_at,updated_at) VALUES(?,?,?,?,?,?,'pending',?,?,?,?)").run(id,kind,resource,idempotency,JSON.stringify(payload),actor,maxAttempts,now,now,now);event(d,id,"pending","Trabajo persistido por "+actor);return row(d,id);
    }));
  }
  function expire(d){const expired=d.prepare("SELECT id FROM hub_jobs WHERE state='running' AND lease_until<=?").all(clock());for(const x of expired){d.prepare("UPDATE hub_jobs SET state='uncertain',updated_at=?,error=? WHERE id=? AND state='running'").run(clock(),"Heartbeat vencido: requiere reconciliar el resultado antes de repetir",x.id);event(d,x.id,"uncertain","Lease vencido; sin repetición automática");}return expired.length;}
  function claim(kind,allowedResources){
    if(!Array.isArray(allowedResources)||!allowedResources.length)return null;
    return use(d=>tx(d,()=>{
      expire(d);
      // A Hub release replaces the HTTP process that runs backups/restores/imports.
      // Coordinate claims in this same transaction, rather than racing separate preflight reads.
      if(kind==="release"&&d.prepare("SELECT 1 FROM hub_jobs WHERE kind IN ('backup','restore','backup-import') AND state IN ('running','uncertain') LIMIT 1").get())return null;
      if(["backup","restore","backup-import"].includes(kind)&&d.prepare("SELECT 1 FROM hub_jobs WHERE kind='release' AND resource='nanolabshub' AND state IN ('running','uncertain') LIMIT 1").get())return null;
      const slots=allowedResources.map(()=>"?").join(",");
      const next=d.prepare(`SELECT id FROM hub_jobs j WHERE kind=? AND state='pending' AND due_at<=? AND attempts<max_attempts AND resource IN (${slots}) AND NOT EXISTS (SELECT 1 FROM hub_jobs busy WHERE busy.kind=j.kind AND busy.resource=j.resource AND busy.state IN ('running','uncertain')) ORDER BY due_at,created_at LIMIT 1`).get(kind,clock(),...allowedResources);
      if(!next)return null;
      const owner=crypto.randomUUID(),now=clock();d.prepare("UPDATE hub_jobs SET state='running',attempts=attempts+1,lease_owner=?,lease_until=?,heartbeat=?,updated_at=? WHERE id=? AND state='pending'").run(owner,now+leaseMs,now,now,next.id);event(d,next.id,"running","Trabajo reclamado");return row(d,next.id);
    }));
  }
  function heartbeat(id,owner){return use(d=>!!d.prepare("UPDATE hub_jobs SET heartbeat=?,lease_until=?,updated_at=? WHERE id=? AND lease_owner=? AND state='running' AND lease_until>?").run(clock(),clock()+leaseMs,clock(),id,owner,clock()).changes);}
  function finish(id,owner,result){return use(d=>tx(d,()=>{const changed=d.prepare("UPDATE hub_jobs SET state='succeeded',result=?,error=NULL,lease_until=NULL,updated_at=? WHERE id=? AND lease_owner=? AND state IN ('running','uncertain')").run(JSON.stringify(result),clock(),id,owner);if(!changed.changes)throw Error("Lease o estado de trabajo no válido");event(d,id,"succeeded","Resultado confirmado");return row(d,id);}));}
  function fail(id,owner,message,{retryable=false,uncertain=false}={}){return use(d=>tx(d,()=>{
    const job=row(d,id);if(!job||job.lease_owner!==owner||job.state!=="running")throw Error("Lease o estado de trabajo no válido");
    const retry=retryable&&job.attempts<job.max_attempts&&!uncertain,state=uncertain?"uncertain":retry?"pending":"failed",delay=Math.min(15*60000,60000*5**Math.max(0,job.attempts-1));
    d.prepare("UPDATE hub_jobs SET state=?,error=?,due_at=?,lease_until=NULL,updated_at=? WHERE id=?").run(state,String(message).slice(0,240),clock()+(retry?delay:0),clock(),id);event(d,id,state,retry?"Reintento programado":uncertain?"Resultado no confirmado":"Intento fallido");return row(d,id);
  }));}
  function cancel(id,actor){return use(d=>tx(d,()=>{const changed=d.prepare("UPDATE hub_jobs SET state='cancelled',updated_at=? WHERE id=? AND state='pending'").run(clock(),id);if(!changed.changes)throw Error("Solo puede cancelarse un trabajo pendiente");event(d,id,"cancelled","Cancelado por "+actor);return row(d,id);}));}
  function reconcile(id,{result,evidence,state="succeeded"}){if(typeof evidence!=="string"||evidence.length<10||!["succeeded","failed"].includes(state))throw Error("Falta evidencia de reconciliación");return use(d=>tx(d,()=>{const changed=d.prepare("UPDATE hub_jobs SET state=?,result=?,error=?,lease_until=NULL,updated_at=? WHERE id=? AND state='uncertain'").run(state,JSON.stringify(result),state==="failed"?"Operación fallida; estado final comprobado mediante reconciliación":null,clock(),id);if(!changed.changes)throw Error("Solo puede reconciliarse un resultado incierto");event(d,id,state,evidence.slice(0,500));return row(d,id);}));}
  function retry(id,actor){return use(d=>tx(d,()=>{const job=row(d,id);if(!job||job.state!=="failed")throw Error("Solo puede reintentarse un trabajo fallido confirmado");d.prepare("UPDATE hub_jobs SET state='pending',actor=?,attempts=0,error=NULL,due_at=?,updated_at=? WHERE id=?").run(actor,clock(),clock(),id);event(d,id,"pending","Reintento explícito por "+actor);return row(d,id);}));}
  return {enqueue,claim,heartbeat,finish,fail,cancel,reconcile,retry,get:id=>use(d=>row(d,id)),list:()=>use(d=>d.prepare("SELECT id,kind,resource,actor,state,attempts,max_attempts AS maxAttempts,due_at AS dueAt,created_at AS createdAt,updated_at AS updatedAt,error,result FROM hub_jobs ORDER BY CASE state WHEN 'uncertain' THEN 0 WHEN 'running' THEN 1 WHEN 'pending' THEN 2 WHEN 'failed' THEN 3 ELSE 4 END,updated_at DESC LIMIT 200").all()),events:id=>use(d=>d.prepare("SELECT at,state,details FROM hub_job_events WHERE job_id=? ORDER BY id").all(id)),expire:()=>use(d=>tx(d,()=>expire(d)))};
}
module.exports={createJobStore};
