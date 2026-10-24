import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
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
  await call("/api/jobs",{method:"POST",token:active,body:{id:queued.data.jobId,operation:"cancel"},status:role==="viewer"?403:200});
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
