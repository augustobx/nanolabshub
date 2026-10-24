"use strict";
// Local server recovery only; this module is never called by an HTTP handler.
const fs=require("node:fs"),path=require("node:path"),os=require("node:os"),crypto=require("node:crypto"),{DatabaseSync}=require("node:sqlite");
function recoverOwner(dataDir,username,confirmation){
  if(!path.isAbsolute(dataDir)||!/^[-a-zA-Z0-9@._:+]{1,120}$/.test(username)||confirmation!=="RESET MFA "+username)throw Error("Se requieren ruta absoluta, propietario exacto y confirmación RESET MFA <usuario>");
  const directory=fs.lstatSync(dataDir),file=path.join(dataDir,"hub.sqlite"),st=fs.lstatSync(file);
  if(!directory.isDirectory()||directory.isSymbolicLink()||!st.isFile()||st.isSymbolicLink())throw Error("Persistencia Hub insegura");
  const backup=path.join(dataDir,"owner-recovery-"+new Date().toISOString().replace(/\D/g,"")+"-"+crypto.randomBytes(4).toString("hex")+".sqlite");
  const source=new DatabaseSync(file,{readOnly:true});
  try{
    const user=source.prepare("SELECT id FROM auth_users WHERE username=? AND role='owner' AND active=1").get(username);if(!user)throw Error("Propietario activo no encontrado");
    source.prepare("VACUUM INTO ?").run(backup);fs.chmodSync(backup,0o600);
  }finally{source.close();}
  const restored=new DatabaseSync(backup,{readOnly:true});
  try{if(restored.prepare("PRAGMA integrity_check").get().integrity_check!=="ok"||restored.prepare("PRAGMA foreign_key_check").all().length)throw Error("Falló la comprobación del respaldo previo");}finally{restored.close();}
  const d=new DatabaseSync(file);
  try{
    d.exec("PRAGMA busy_timeout=5000; BEGIN IMMEDIATE");
    try{
      const user=d.prepare("SELECT id FROM auth_users WHERE username=? AND role='owner' AND active=1").get(username);if(!user)throw Error("El propietario cambió antes de la recuperación");
      d.prepare("UPDATE auth_users SET mfa_secret=NULL,last_counter=-1 WHERE id=?").run(user.id);
      d.prepare("UPDATE auth_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL").run(Date.now(),user.id);
      for(const table of ["auth_challenges","auth_mfa_setup","auth_recovery_codes"])d.prepare("DELETE FROM "+table+" WHERE user_id=?").run(user.id);
      d.prepare("INSERT INTO audit_log(timestamp,user,action,target,details) VALUES(?,?,?,?,?)").run(new Date().toISOString(),"server-local:"+os.userInfo().username,"OWNER_MFA_RECOVERY",user.id,"Recuperación local con respaldo consistente verificado; exige contraseña existente y nuevo enrolamiento");
      d.exec("COMMIT");
    }catch(error){d.exec("ROLLBACK");throw error;}
  }finally{d.close();}
  return {username,backup,integrity:"ok",existingPasswordRequired:true,enrollmentRequired:true};
}
if(require.main===module){try{const args=Object.fromEntries(process.argv.slice(2).map(x=>{const i=x.indexOf("=");return [x.slice(0,i),x.slice(i+1)];}));console.log(JSON.stringify(recoverOwner(process.env.DATA_DIR||"",args["--username"]||"",args["--confirm"]||"")));}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={recoverOwner};
