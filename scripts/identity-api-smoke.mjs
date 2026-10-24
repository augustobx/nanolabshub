import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fixtureTOTP, nextRecovery } from "./ui-auth.mjs";
const base=process.env.UI_BASE_URL;
assert.ok(base&&["127.0.0.1","localhost"].includes(new URL(base).hostname),"Identity smoke is local only");
let assertions=0;
async function call(path,{token,method="GET",body,status=200,origin=base}={}){
  const r=await fetch(base+path,{method,headers:{"Content-Type":"application/json",Origin:origin,...(token?{Cookie:token}:{})},...(body?{body:JSON.stringify(body)}:{})});
  assert.equal(r.status,status,path);assertions++;const j=await r.json();return {...j,cookie:r.headers.get("set-cookie")?.split(";")[0]};
}
const username=process.env.UI_ADMIN_USER,password=process.env.UI_ADMIN_PASS;
assert.ok(username&&password);
const l=await call("/api/auth/login",{method:"POST",body:{username,password}});assert.equal(l.data.mfaRequired,true);
const owner=await call("/api/auth/mfa",{method:"POST",body:{challenge:l.data.challenge,code:await nextRecovery(base)}}),token=owner.cookie;
assert.ok(token);
await call("/api/auth/users",{method:"POST",token,origin:"https://untrusted.example.invalid",body:{},status:403});
const users=await call("/api/auth/users",{token});assert(users.data.every(u=>!('password_hash' in u)&&!('mfa_secret' in u)));
const requestId=randomUUID(),queued=await call("/api/backups",{method:"POST",token,body:{slug:"onlyfood",requestId},status:202});
const repeated=await call("/api/backups",{method:"POST",token,body:{slug:"onlyfood",requestId},status:202});assert.equal(queued.data.jobId,repeated.data.jobId);
assert.equal((await call("/api/jobs",{token})).data.length,1);
await call("/api/backups",{token}); // Initialize and exercise the actual registry/schema migration.
await call("/api/backups/import",{token});
await call("/api/backups/import",{method:"POST",token,origin:"https://untrusted.example.invalid",body:{slug:"onlyfood",filename:"fixture.sql.gz",requestId:randomUUID()},status:403});
await call("/api/backups/import",{method:"POST",token,body:{slug:"onlyfood",filename:"../hub.sqlite",requestId:randomUUID()},status:422});
await call("/api/backups/import",{method:"POST",token,body:{slug:"onlypadel",filename:"fixture.sql.gz",requestId:randomUUID()},status:403});
// Seed only the explicitly selected ephemeral Hub DB. No archive is produced or executed.
const dataDir=fs.realpathSync(process.env.UI_DATA_DIR||"");
assert.ok([os.tmpdir(),process.env.RUNNER_TEMP].filter(Boolean).some(root=>{const rel=path.relative(fs.realpathSync(root),dataDir);return rel&&!rel.startsWith("..")&&!path.isAbsolute(rel);}),"Fixture data must be inside the OS/CI temporary directory");
const restoreIds={onlyfood:randomUUID(),onlygym:randomUUID()},fixtureDb=new DatabaseSync(path.join(dataDir,"hub.sqlite"));
try{
 for(const [slug,id] of Object.entries(restoreIds))fixtureDb.prepare("INSERT INTO backup_jobs(id,slug,db_type,filename,status,created_at,finished_at,size_bytes,checksum,trigger) VALUES(?,?,?,?,'integrity_ok',?,?,100,?,'manual')").run(id,slug,slug==="onlyfood"?"mariadb":"postgres",slug+"_synthetic_api_fixture.sql.gz",new Date().toISOString(),new Date().toISOString(),"a".repeat(64));
}finally{fixtureDb.close();}
const restoreRequest=randomUUID();
await call("/api/backups/restore-check",{method:"POST",token,origin:"https://untrusted.example.invalid",body:{backupId:restoreIds.onlyfood,requestId:restoreRequest},status:403});
await call("/api/backups/restore-check",{method:"POST",token,body:{backupId:restoreIds.onlyfood},status:422});
const restore=await call("/api/backups/restore-check",{method:"POST",token,body:{backupId:restoreIds.onlyfood,requestId:restoreRequest},status:202});
const restoreRepeat=await call("/api/backups/restore-check",{method:"POST",token,body:{backupId:restoreIds.onlyfood,requestId:restoreRequest},status:202});
assert.equal(restore.data.jobId,restoreRepeat.data.jobId);assert.equal(restore.data.state,"pending");
for(const role of ["viewer","operator"]){
  const user="api_fixture_"+role;
  const created=await call("/api/auth/users",{method:"POST",token,body:{username:user,password,role,scopes:["onlyfood"],active:true}});
  const login=await call("/api/auth/login",{method:"POST",body:{username:user,password}});assert.equal(login.data.enrollmentRequired,true);
  await call("/api/operations",{token:login.cookie,status:403});
  await call("/api/auth/users",{token:login.cookie,status:403});
  const setup=await call("/api/auth/account",{method:"POST",token:login.cookie,body:{operation:"mfa.begin"}});
  const enrolled=await call("/api/auth/account",{method:"POST",token:login.cookie,body:{operation:"mfa.confirm",code:fixtureTOTP(setup.data.secret)}});
  await call("/api/auth/account",{token:login.cookie,status:401});
  const active=enrolled.cookie;assert.ok(active);
  await call("/api/jobs",{token:active});
  const inventory=await call("/api/backups/import",{token:active,status:role==="viewer"?403:200});
  if(role==="operator")assert.deepEqual(inventory.data.map(s=>s.slug),["onlyfood"]);
  await call("/api/backups/import",{method:"POST",token:active,body:{slug:"onlygym",filename:"fixture.sql.gz",requestId:randomUUID()},status:403});
  await call("/api/jobs",{method:"POST",token:active,body:{id:queued.data.jobId,operation:"cancel"},status:role==="viewer"?403:200});
  await call("/api/jobs",{method:"POST",token:active,body:{id:restore.data.jobId,operation:"cancel"},status:role==="viewer"?403:200});
  await call("/api/backups/restore-check",{method:"POST",token:active,body:{backupId:restoreIds.onlygym,requestId:randomUUID()},status:403});
  await call("/api/auth/users",{token:active,status:403});
  await call("/api/saas-management/onlygym?resource=catalog",{token:active,status:403});
  await call("/api/apps/restart",{method:"POST",token:active,body:{containerName:"onlygym-web"},status:403});
  if(role==="viewer")await call("/api/apps/logs?container=onlyfood-app-1",{token:active,status:403});
  await call("/api/auth/users",{method:"POST",token,body:{id:created.data.id,role,scopes:["onlyfood"],active:false}});
  await call("/api/auth/account",{token:active,status:401});
}
for(const containerName of ["onlypadel-web","onlycars-app-1","onlyerp-web"])await call("/api/apps/restart",{method:"POST",token,body:{containerName},status:403});
await call("/api/auth/logout",{method:"POST",token});
await call("/api/auth/account",{token,status:401});
console.log("Real isolated identity API assertions:",assertions);
