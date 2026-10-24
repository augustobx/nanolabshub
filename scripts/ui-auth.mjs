// Synthetic local UI credentials only. No production URL is accepted.
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
function statePath(origin) {assert.ok(["127.0.0.1","localhost"].includes(new URL(origin).hostname));return path.join(os.tmpdir(),"nanohub-ui-auth-"+createHash("sha256").update(origin).digest("hex").slice(0,12)+".json");}
export async function rememberRecovery(origin,codes){await writeFile(statePath(origin),JSON.stringify({origin,codes}),{mode:0o600});}
export async function nextRecovery(origin){const file=statePath(origin),state=JSON.parse(await readFile(file,"utf8"));assert.equal(state.origin,origin);const code=state.codes.shift();assert.ok(code,"No synthetic recovery codes left; use a fresh isolated DATA_DIR");await writeFile(file,JSON.stringify(state),{mode:0o600});return code;}
export function fixtureTOTP(secret){let bits=0,value=0;const out=[],alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";for(const char of secret){const n=alphabet.indexOf(char);assert.ok(n>=0);value=(value<<5)|n;bits+=5;if(bits>=8){bits-=8;out.push((value>>>bits)&255);}}const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));const h=createHmac("sha1",Buffer.from(out)).update(counter).digest(),offset=h[h.length-1]&15;return String((h.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,"0");}
export async function signInFixture(context,origin){
  statePath(origin);
  const r=await context.request.post(origin+"/api/auth/login",{data:{username:process.env.UI_ADMIN_USER||"ci_smoke",password:process.env.UI_ADMIN_PASS||"ci_smoke_password"}});assert.equal(r.status(),200);const login=(await r.json()).data;
  if(login.mfaRequired){const v=await context.request.post(origin+"/api/auth/mfa",{data:{challenge:login.challenge,code:await nextRecovery(origin)}});assert.equal(v.status(),200);return;}
  assert.equal(login.enrollmentRequired,true);
  const headers={Origin:origin,Cookie:r.headers()['set-cookie'].split(';')[0]};const setup=await context.request.post(origin+"/api/auth/account",{headers,data:{operation:"mfa.begin"}});assert.equal(setup.status(),200);const s=(await setup.json()).data;
  const confirm=await context.request.post(origin+"/api/auth/account",{headers,data:{operation:"mfa.confirm",code:fixtureTOTP(s.secret)}});assert.equal(confirm.status(),200);await rememberRecovery(origin,(await confirm.json()).data.recoveryCodes);
}
