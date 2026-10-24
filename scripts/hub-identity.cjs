"use strict";
// Hub identities only. No SaaS credentials, connections or tables are used here.
const crypto = require("node:crypto"), fs = require("node:fs"), path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const ROLES = ["owner", "operator", "viewer"];
const SCOPES = ["nanolabshub", "onlyfood", "onlygym", "onlyturn"];
const ABSOLUTE_MS = 12 * 3600000, IDLE_MS = 30 * 60000, RECENT_MS = 10 * 60000;
const digest = value => crypto.createHash("sha256").update(value).digest("hex");
function hashPassword(password) {
  if (typeof password !== "string" || password.length < 16 || password.length > 1024) throw Error("La contraseña debe tener entre 16 y 1024 caracteres");
  const salt = crypto.randomBytes(16).toString("hex");
  return salt + ":" + crypto.scryptSync(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 ** 2 }).toString("hex");
}
function passwordMatches(password, stored) {
  if (typeof password !== "string" || password.length > 1024) return false;
  const [salt, expected] = stored.split(":");
  const actual = crypto.scryptSync(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 ** 2 });
  return expected?.length === 128 && crypto.timingSafeEqual(actual, Buffer.from(expected, "hex"));
}
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32(bytes) {
  let bits = 0, value = 0, out = "";
  for (const byte of bytes) { value = (value << 8) | byte; bits += 8; while (bits >= 5) { bits -= 5; out += alphabet[(value >>> bits) & 31]; } }
  if (bits) out += alphabet[(value << (5 - bits)) & 31];
  return out;
}
function unbase32(text) {
  let bits = 0, value = 0; const out = [];
  for (const char of text) { const n = alphabet.indexOf(char); if (n < 0) throw Error("Secreto TOTP inválido"); value = (value << 5) | n; bits += 5; if (bits >= 8) { bits -= 8; out.push((value >>> bits) & 255); } }
  return Buffer.from(out);
}
// RFC 6238 / RFC 4226: HMAC-SHA1, 30 seconds, six digits.
function totp(secret, counter, digits = 6) {
  const bytes = Buffer.alloc(8); bytes.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac("sha1", unbase32(secret)).update(bytes).digest(), offset = h[h.length - 1] & 15;
  return String((h.readUInt32BE(offset) & 0x7fffffff) % (10 ** digits)).padStart(digits, "0");
}
function matchingCounter(secret, code, now, last = -1) {
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) return null;
  const current = Math.floor(now / 30000);
  for (const n of [current - 1, current, current + 1]) if (n > last && crypto.timingSafeEqual(Buffer.from(totp(secret, n)), Buffer.from(code))) return n;
  return null;
}
function createIdentityStore(config) {
  const clock = config.clock || Date.now;
  const key = () => { if (typeof config.masterKey !== "string" || config.masterKey.length < 32 || config.masterKey === "nanolabs_governance_supreme_2026") throw Error("Clave maestra Hub no configurada"); return crypto.hkdfSync("sha256", config.masterKey, "nanohub-identity-v1", "mfa-encryption", 32); };
  function encrypt(secret) { const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", key(), iv); const body = Buffer.concat([c.update(secret, "utf8"), c.final()]); return [iv, c.getAuthTag(), body].map(b => b.toString("base64url")).join("."); }
  function decrypt(value) { const [iv, tag, body] = value.split(".").map(s => Buffer.from(s, "base64url")); const c = crypto.createDecipheriv("aes-256-gcm", key(), iv); c.setAuthTag(tag); return Buffer.concat([c.update(body), c.final()]).toString("utf8"); }
  function open() {
    key(); fs.mkdirSync(config.dataDir, { recursive: true, mode: 0o700 });
    const db = new DatabaseSync(path.join(config.dataDir, "hub.sqlite"));
    db.exec(`PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS auth_users(id TEXT PRIMARY KEY,username TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('owner','operator','viewer')),scopes TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,mfa_secret TEXT,last_counter INTEGER NOT NULL DEFAULT -1,created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS auth_sessions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES auth_users(id),token_hash TEXT UNIQUE NOT NULL,created_at INTEGER NOT NULL,last_seen INTEGER NOT NULL,expires_at INTEGER NOT NULL,authenticated_at INTEGER NOT NULL,enrollment_only INTEGER NOT NULL,revoked_at INTEGER);
      CREATE INDEX IF NOT EXISTS auth_sessions_user ON auth_sessions(user_id);
      CREATE TABLE IF NOT EXISTS auth_challenges(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES auth_users(id),expires_at INTEGER NOT NULL,attempts INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS auth_mfa_setup(user_id TEXT PRIMARY KEY REFERENCES auth_users(id),secret TEXT NOT NULL,expires_at INTEGER NOT NULL,bound_session TEXT,rotating INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS auth_recovery_codes(user_id TEXT NOT NULL REFERENCES auth_users(id),code_hash TEXT NOT NULL,used_at INTEGER,PRIMARY KEY(user_id,code_hash));
      CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY AUTOINCREMENT,timestamp TEXT NOT NULL,user TEXT NOT NULL,action TEXT NOT NULL,target TEXT NOT NULL,details TEXT NOT NULL);`);
    const setupColumns=db.prepare("PRAGMA table_info(auth_mfa_setup)").all().map(c=>c.name);
    if(!setupColumns.includes("bound_session"))db.exec("ALTER TABLE auth_mfa_setup ADD COLUMN bound_session TEXT");
    if(!setupColumns.includes("rotating"))db.exec("ALTER TABLE auth_mfa_setup ADD COLUMN rotating INTEGER NOT NULL DEFAULT 0");
    return db;
  }
  function transaction(db, fn) { db.exec("BEGIN IMMEDIATE"); try { const result = fn(); db.exec("COMMIT"); return result; } catch (error) { db.exec("ROLLBACK"); throw error; } }
  function using(fn) { const db = open(); try { return fn(db); } finally { db.close(); } }
  function audit(db, actor, action, target, details = "") { db.prepare("INSERT INTO audit_log(timestamp,user,action,target,details) VALUES(?,?,?,?,?)").run(new Date(clock()).toISOString(), actor, action, target, details); }
  function bootstrap(db) {
    if (db.prepare("SELECT COUNT(*) AS n FROM auth_users").get().n) return;
    const username = config.bootstrapUser;
    if (!/^[a-zA-Z0-9@._:+-]{1,120}$/.test(username || "") || config.bootstrapPassword === "Qap.1029Qap.1029") throw Error("Propietario inicial no configurado");
    const passwordHash = hashPassword(config.bootstrapPassword);
    transaction(db, () => {
      if (db.prepare("SELECT COUNT(*) AS n FROM auth_users").get().n) return;
      db.prepare("INSERT INTO auth_users(id,username,password_hash,role,scopes,created_at) VALUES(?,?,?,'owner','[]',?)").run(crypto.randomUUID(), username, passwordHash, clock());
      audit(db, username, "IDENTITY_BOOTSTRAP", username, "Propietario inicial creado; enrolamiento MFA requerido");
    });
  }
  function session(db, user, enrollmentOnly = false) {
    const token = "v2." + crypto.randomBytes(32).toString("hex"), id = crypto.randomUUID(), now = clock();
    db.prepare("INSERT INTO auth_sessions(id,user_id,token_hash,created_at,last_seen,expires_at,authenticated_at,enrollment_only) VALUES(?,?,?,?,?,?,?,?)").run(id,user.id,digest(token),now,now,now+ABSOLUTE_MS,now,enrollmentOnly?1:0);
    audit(db,user.username,"LOGIN_SUCCESS",id,enrollmentOnly?"Sesión limitada a enrolamiento MFA":"Sesión con segundo factor");
    return { token, enrollmentRequired: enrollmentOnly };
  }
  function principal(db, token, touch = false) {
    if (typeof token !== "string" || !/^v2\.[a-f0-9]{64}$/.test(token)) return null;
    const row = db.prepare("SELECT s.*,u.username,u.role,u.scopes,u.active,u.mfa_secret FROM auth_sessions s JOIN auth_users u ON u.id=s.user_id WHERE token_hash=?").get(digest(token));
    const now = clock();
    if (!row || row.revoked_at !== null || !row.active || row.expires_at <= now || row.last_seen + IDLE_MS <= now || row.last_seen > now + 60000) return null;
    if (touch && now - row.last_seen >= 60000) db.prepare("UPDATE auth_sessions SET last_seen=? WHERE id=? AND revoked_at IS NULL").run(now,row.id);
    return { userId:row.user_id,username:row.username,role:row.role,scopes:JSON.parse(row.scopes),sessionId:row.id,authenticatedAt:row.authenticated_at,mfaReady:!!row.mfa_secret&&!row.enrollment_only,enrollmentRequired:!!row.enrollment_only,expiresAt:row.expires_at };
  }
  function requirePrincipal(db, token, options = {}) {
    const p = principal(db, token);
    if (!p || (!options.enrollment && !p.mfaReady) || (options.owner && p.role !== "owner") || (options.recent && p.authenticatedAt + RECENT_MS <= clock())) throw Error("Sesión, permisos o verificación reciente requeridos");
    return p;
  }
  function factor(db, user, code) {
    const n = matchingCounter(decrypt(user.mfa_secret), code, clock(), user.last_counter);
    if (n !== null) return !!db.prepare("UPDATE auth_users SET last_counter=? WHERE id=? AND last_counter<?").run(n,user.id,n).changes;
    if (typeof code !== "string" || !/^[a-f0-9]{32}$/.test(code)) return false;
    return !!db.prepare("UPDATE auth_recovery_codes SET used_at=? WHERE user_id=? AND code_hash=? AND used_at IS NULL").run(clock(),user.id,digest(code)).changes;
  }
  function login(username, password) {
    return using(db => {
      bootstrap(db);
      const user = typeof username === "string" ? db.prepare("SELECT * FROM auth_users WHERE username=?").get(username.trim()) : null;
      // Same scrypt cost for an unknown account to reduce username timing differences.
      const stored = user?.password_hash || "00000000000000000000000000000000:"+"0".repeat(128);
      if (!passwordMatches(password,stored) || !user?.active) { audit(db,"anonymous","LOGIN_FAILED","AUTH"); return null; }
      if (!user.mfa_secret) return transaction(db,()=>session(db,user,true));
      return transaction(db,()=>{const challenge=crypto.randomBytes(32).toString("hex");db.prepare("INSERT INTO auth_challenges(token_hash,user_id,expires_at) VALUES(?,?,?)").run(digest(challenge),user.id,clock()+5*60000);return {challenge,mfaRequired:true};});
    });
  }
  function completeLogin(challenge, code) {
    if (typeof challenge !== "string" || !/^[a-f0-9]{64}$/.test(challenge)) return null;
    return using(db=>transaction(db,()=>{
      const c=db.prepare("SELECT * FROM auth_challenges WHERE token_hash=?").get(digest(challenge));
      if(!c||c.expires_at<=clock()||c.attempts>=5)return null;
      db.prepare("UPDATE auth_challenges SET attempts=attempts+1 WHERE token_hash=?").run(digest(challenge));
      const user=db.prepare("SELECT * FROM auth_users WHERE id=?").get(c.user_id);
      if(!user?.active||!user.mfa_secret||!factor(db,user,code)){audit(db,"anonymous","MFA_FAILED","AUTH");return null;}
      db.prepare("DELETE FROM auth_challenges WHERE user_id=?").run(user.id);
      return session(db,user);
    }));
  }
  function beginEnrollment(token,password,code) {
    return using(db=>transaction(db,()=>{
      const p=requirePrincipal(db,token,{enrollment:true,recent:true});
      if(p.mfaReady){const user=db.prepare("SELECT * FROM auth_users WHERE id=?").get(p.userId);if(!passwordMatches(password,user.password_hash)||!factor(db,user,code))throw Error("Para reemplazar MFA ingresá tu contraseña y un segundo factor válido");}
      const secret=base32(crypto.randomBytes(20));
      db.prepare("INSERT INTO auth_mfa_setup(user_id,secret,expires_at,bound_session,rotating) VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET secret=excluded.secret,expires_at=excluded.expires_at,bound_session=excluded.bound_session,rotating=excluded.rotating").run(p.userId,encrypt(secret),clock()+10*60000,p.sessionId,p.mfaReady?1:0);
      return {secret,uri:"otpauth://totp/"+encodeURIComponent("NanoHub:"+p.username)+"?secret="+secret+"&issuer=NanoHub&algorithm=SHA1&digits=6&period=30"};
    }));
  }
  function confirmEnrollment(token,code) {
    return using(db=>transaction(db,()=>{
      const p=requirePrincipal(db,token,{enrollment:true,recent:true});
      const setup=db.prepare("SELECT * FROM auth_mfa_setup WHERE user_id=?").get(p.userId);
      if(!setup||setup.expires_at<=clock()||setup.bound_session!==p.sessionId||(p.mfaReady&&!setup.rotating))throw Error("Enrolamiento vencido o no disponible");
      const counter=matchingCounter(decrypt(setup.secret),code,clock());
      if(counter===null)throw Error("Código incorrecto");
      const recoveryCodes=Array.from({length:10},()=>crypto.randomBytes(16).toString("hex"));
      db.prepare("UPDATE auth_users SET mfa_secret=?,last_counter=? WHERE id=?").run(setup.secret,counter,p.userId);
      db.prepare("DELETE FROM auth_recovery_codes WHERE user_id=?").run(p.userId);
      for(const c of recoveryCodes)db.prepare("INSERT INTO auth_recovery_codes(user_id,code_hash) VALUES(?,?)").run(p.userId,digest(c));
      db.prepare("DELETE FROM auth_mfa_setup WHERE user_id=?").run(p.userId);
      db.prepare("UPDATE auth_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL").run(clock(),p.userId);
      audit(db,p.username,setup.rotating?"MFA_ROTATED":"MFA_ENROLLED",p.userId);
      return {...session(db,{id:p.userId,username:p.username}),recoveryCodes};
    }));
  }
  function listSessions(token) { return using(db=>{const p=requirePrincipal(db,token,{enrollment:true});return db.prepare("SELECT id,created_at AS createdAt,last_seen AS lastSeen,expires_at AS expiresAt,revoked_at AS revokedAt FROM auth_sessions WHERE user_id=? ORDER BY created_at DESC LIMIT 100").all(p.userId).map(s=>({...s,current:s.id===p.sessionId}));}); }
  function revoke(token,sessionId,all=false) { return using(db=>transaction(db,()=>{const p=requirePrincipal(db,token,{enrollment:true});if(all){db.prepare("UPDATE auth_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL").run(clock(),p.userId);}else{const changed=db.prepare("UPDATE auth_sessions SET revoked_at=? WHERE id=? AND user_id=? AND revoked_at IS NULL").run(clock(),sessionId||p.sessionId,p.userId);if(!changed.changes)throw Error("Sesión no encontrada");}audit(db,p.username,"SESSION_REVOKED",all?"all":sessionId||p.sessionId);})); }
  function reauthenticate(token,password,code) { return using(db=>transaction(db,()=>{const p=requirePrincipal(db,token);const user=db.prepare("SELECT * FROM auth_users WHERE id=?").get(p.userId);if(!passwordMatches(password,user.password_hash)||!factor(db,user,code))return null;db.prepare("UPDATE auth_sessions SET revoked_at=? WHERE id=?").run(clock(),p.sessionId);audit(db,p.username,"SESSION_REAUTHENTICATED",p.sessionId);return session(db,user);})); }
  function listUsers(token) { return using(db=>{requirePrincipal(db,token,{owner:true});return db.prepare("SELECT id,username,role,scopes,active,created_at AS createdAt,(mfa_secret IS NOT NULL) AS mfaReady FROM auth_users ORDER BY username").all().map(u=>({...u,scopes:JSON.parse(u.scopes),active:!!u.active,mfaReady:!!u.mfaReady}));}); }
  function saveUser(token,input) { return using(db=>transaction(db,()=>{
    const p=requirePrincipal(db,token,{owner:true,recent:true});
    if(!input||!ROLES.includes(input.role)||!Array.isArray(input.scopes)||input.scopes.some(s=>!SCOPES.includes(s))||new Set(input.scopes).size!==input.scopes.length||typeof input.active!=="boolean")throw Error("Usuario, rol o alcance inválido");
    let id=input.id;
    if(id){
      const previous=db.prepare("SELECT * FROM auth_users WHERE id=?").get(id);if(!previous)throw Error("Usuario no encontrado");
      if(input.resetMfa===true){if(id===p.userId)throw Error("Para reemplazar tu propio MFA usá Mi cuenta");db.prepare("UPDATE auth_users SET mfa_secret=NULL,last_counter=-1 WHERE id=?").run(id);db.prepare("DELETE FROM auth_recovery_codes WHERE user_id=?").run(id);db.prepare("DELETE FROM auth_mfa_setup WHERE user_id=?").run(id);audit(db,p.username,"MFA_RESET_BY_OWNER",id);}
      if(previous.role==="owner"&&previous.active&&(!input.active||input.role!=="owner")&&db.prepare("SELECT COUNT(*) AS n FROM auth_users WHERE role='owner' AND active=1").get().n<=1)throw Error("Debe conservarse un propietario activo");
      db.prepare("UPDATE auth_users SET role=?,scopes=?,active=? WHERE id=?").run(input.role,JSON.stringify(input.scopes),input.active?1:0,id);
      if(input.password!==undefined)db.prepare("UPDATE auth_users SET password_hash=? WHERE id=?").run(hashPassword(input.password),id);
      db.prepare("UPDATE auth_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL").run(clock(),id);
      db.prepare("DELETE FROM auth_challenges WHERE user_id=?").run(id);
    }else{
      if(typeof input.username!=="string"||!/^[a-zA-Z0-9@._:+-]{1,120}$/.test(input.username))throw Error("Usuario inválido");
      id=crypto.randomUUID();db.prepare("INSERT INTO auth_users(id,username,password_hash,role,scopes,active,created_at) VALUES(?,?,?,?,?,?,?)").run(id,input.username,hashPassword(input.password),input.role,JSON.stringify(input.scopes),input.active?1:0,clock());
    }
    audit(db,p.username,input.id?"USER_UPDATED":"USER_CREATED",id,JSON.stringify({role:input.role,scopes:input.scopes,active:input.active}));return {id};
  })); }
  function changePassword(token,currentPassword,newPassword) { return using(db=>transaction(db,()=>{const p=requirePrincipal(db,token,{recent:true});const user=db.prepare("SELECT * FROM auth_users WHERE id=?").get(p.userId);if(!passwordMatches(currentPassword,user.password_hash))throw Error("Contraseña incorrecta");db.prepare("UPDATE auth_users SET password_hash=? WHERE id=?").run(hashPassword(newPassword),p.userId);db.prepare("UPDATE auth_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL").run(clock(),p.userId);db.prepare("DELETE FROM auth_challenges WHERE user_id=?").run(p.userId);audit(db,p.username,"PASSWORD_CHANGED",p.userId);})); }
  function securitySummary(){return using(db=>({activeUsers:db.prepare("SELECT COUNT(*) AS n FROM auth_users WHERE active=1").get().n,activeOwners:db.prepare("SELECT COUNT(*) AS n FROM auth_users WHERE active=1 AND role='owner'").get().n,mfaUsers:db.prepare("SELECT COUNT(*) AS n FROM auth_users WHERE active=1 AND mfa_secret IS NOT NULL").get().n}));}
  return {login,completeLogin,beginEnrollment,confirmEnrollment,principal:token=>typeof token==="string"&&/^v2\.[a-f0-9]{64}$/.test(token)?using(db=>principal(db,token)):null,touch:token=>using(db=>principal(db,token,true)),listSessions,revoke,reauthenticate,listUsers,saveUser,changePassword,securitySummary};
}
module.exports={createIdentityStore,totp,base32,ABSOLUTE_MS,IDLE_MS,RECENT_MS,SCOPES,ROLES};
