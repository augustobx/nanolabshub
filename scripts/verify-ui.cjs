"use strict";
// Portable synthetic runtime: loopback only, fresh data, no inherited Hub/SSH secrets.
const fs=require("node:fs"),path=require("node:path"),os=require("node:os"),crypto=require("node:crypto"),{spawn}=require("node:child_process");
const root=path.resolve(__dirname,".."),folder=fs.mkdtempSync(path.join(os.tmpdir(),"nanohub-ui-fixture-"));
const runtime=path.join(folder,"runtime"),origin="http://127.0.0.1:3105";
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/^(ADMIN_|HUB_|DATA_DIR|SSH|DATABASE_URL)/i.test(k)));
Object.assign(env,{NODE_ENV:"production",HOSTNAME:"127.0.0.1",PORT:"3105",DATA_DIR:path.join(folder,"data"),HUB_PUBLIC_ORIGIN:origin,ADMIN_USER:"ci_smoke",ADMIN_PASS:crypto.randomBytes(24).toString("hex"),HUB_MASTER_KEY:crypto.randomBytes(32).toString("hex"),HUB_BACKUPS_ENABLED:"true",HUB_LIFECYCLE_ENABLED:"false",HUB_SAAS_INTEGRATION_ENABLED:"false",HUB_SAAS_INTEGRATION_PRODUCTS:"",HUB_SAAS_MANAGEMENT_PRODUCTS:"",UI_BASE_URL:origin});
env.UI_ADMIN_USER=env.ADMIN_USER;env.UI_ADMIN_PASS=env.ADMIN_PASS;
env.UI_DATA_DIR=env.DATA_DIR;
fs.cpSync(path.join(root,".next/standalone"),runtime,{recursive:true,filter:file=>!path.basename(file).startsWith(".env")});
fs.cpSync(path.join(root,".next/static"),path.join(runtime,".next/static"),{recursive:true});
if(fs.existsSync(path.join(root,"public")))fs.cpSync(path.join(root,"public"),path.join(runtime,"public"),{recursive:true});
fs.writeFileSync(path.join(folder,".hub-ui-fixture"),"owned-by-verify-ui",{mode:0o600});
const fd=fs.openSync(path.join(folder,"server.log"),"w",0o600);
const server=spawn(process.execPath,[path.join(runtime,"server.js")],{cwd:runtime,env,stdio:["ignore",fd,fd],windowsHide:true});
function script(name){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,[path.join(root,"scripts",name)],{cwd:root,env,stdio:"inherit",windowsHide:true});child.on("error",reject);child.on("exit",code=>code===0?resolve():reject(Error(name+" exited "+code)));});}
async function main(){
  for(let i=0;i<40;i++){try{if((await fetch(origin+"/api/health")).ok)break;}catch{/* runtime is starting */}if(i===39)throw Error("Isolated UI server failed to start");await new Promise(r=>setTimeout(r,1000));}
  await script("ui-smoke.mjs");await script("management-ui-smoke.mjs");await script("identity-api-smoke.mjs");
}
main().then(()=>console.log("Isolated UI suite passed")).catch(error=>{console.error(error.message);console.error("Fixture diagnostics:",path.join(folder,"server.log"));process.exitCode=1;}).finally(()=>{server.kill();fs.closeSync(fd);});
