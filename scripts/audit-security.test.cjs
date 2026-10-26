const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),os=require('node:os');
const {createHmac,webcrypto}=require('node:crypto'),ts=require('typescript');
const root=path.resolve(__dirname,'../src');
const configured={ADMIN_USER:'fixture_admin',ADMIN_PASS:'fixture_password_long_2026',HUB_MASTER_KEY:'fixture_master_key_2026_not_production_'.repeat(2)};
function modules(env={},stubs={}) {
 const cache=new Map();
 function load(file){
  file=path.resolve(file);if(Object.hasOwn(stubs,file))return stubs[file];if(cache.has(file))return cache.get(file).exports;
  const module={exports:{}};cache.set(file,module);
  const output=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const ctx={module,exports:module.exports,process:{env,cwd:()=>path.resolve(root,"..")},Buffer,TextEncoder,TextDecoder,atob,btoa,crypto:webcrypto,URL,URLSearchParams,Request,Response,ReadableStream,AbortSignal,console,setTimeout,clearTimeout,
   require(name){if(Object.hasOwn(stubs,name))return stubs[name];if(name==='next/headers')return {cookies:async()=>({get:()=>undefined})};if(name==='next/server')return {NextResponse:{next:()=>new Response('next'),json:Response.json,redirect:url=>new Response(null,{status:307,headers:{location:String(url)}})}};if(name.startsWith('@/'))return load(path.join(root,name.slice(2)+'.ts'));if(name.startsWith('.')){const target=path.resolve(path.dirname(file),name);return name.endsWith('.cjs')?require(target):load(target+'.ts');}return require(name);}};
  vm.runInNewContext(output,ctx,{filename:file});return module.exports;
 }
 return file=>load(path.join(root,file));
}
function sign(payload){return Buffer.from(payload).toString('base64url')+'.'+createHmac('sha256',configured.HUB_MASTER_KEY+'\n'+configured.ADMIN_PASS).update(payload).digest('hex');}
function request(url,cookie,method='GET'){return {url,nextUrl:new URL(url),method,cookies:{get:()=>cookie?{value:cookie}:undefined}};}
test('legacy signatures and malformed cookies no longer authenticate',()=>{
 const auth=modules(configured)('lib/auth.ts');
 for(const token of [undefined,'bad.token',sign('fixture_admin:NaN'),sign('fixture_admin:'+(Date.now()+100000))])assert.equal(auth.verifySessionToken(token).valid,false);
});
test('middleware rejects forged cookies and dot-path bypasses, permits only the exact scheduler POST',async()=>{
 const principal={username:'fixture_admin',role:'owner',scopes:[],mfaReady:true};
 const load=modules(configured,{[path.join(root,'lib/auth.ts')]:{SESSION_COOKIE_NAME:'nanolabs_hub_session',verifySessionToken:token=>({valid:token==='fixture-token',principal:token==='fixture-token'?principal:null})}}),{middleware}=load('middleware.ts');const cookie='fixture-token';
 for(const url of ['/api/apps','/api/telemetry/history?limit=1','/api/apps/logs/file.log','/api/health.extra','/api/backups/schedule/run/extra']){
  assert.equal((await middleware(request('http://localhost'+url,'forged.signature'))).status,401);
  assert.equal((await middleware(request('http://localhost'+url,cookie))).status,200);
 }
 assert.equal((await middleware(request('http://localhost/security','forged.signature'))).status,307);
 assert.equal((await middleware(request('http://localhost/api/backups/schedule/run',null,'GET'))).status,401);
 assert.equal((await middleware(request('http://localhost/api/backups/schedule/run',null,'POST'))).status,200);
 assert.equal((await middleware(request('http://localhost/api/health',null))).status,200);
});
test('container command inputs and protected products are rejected before any execution',async()=>{
 let calls=0;const load=modules(configured,{[path.join(root,'lib/ssh.ts')]:{executeRemoteCommand:async()=>{calls++;return {code:0,stdout:'fixture log',stderr:''}}}});
 const api=load('lib/server-api.ts');
 for(const name of ['$(id)','onlyfood-app-1-$(id)','name";id','--help','name\nwhoami']){
  await assert.rejects(api.getContainerLogs(name));await assert.rejects(api.restartContainer(name));
 }
 for(const name of ['onlypadel-web','onlycars-db-1','onlyerp-web'])await assert.rejects(api.restartContainer(name),/protegido/);
 await assert.rejects(api.restartContainer('nanolabshub'),/worker independiente/);
 for(const lines of [-1,0,1001,NaN,Infinity])await assert.rejects(api.getContainerLogs('onlyfood-app-1',lines));
 await assert.rejects(api.deployApp('onlyfood'),/genérico deshabilitado/);assert.equal(calls,0);
 assert.equal(await api.getContainerLogs('onlyfood-app-1',10),'fixture log');assert.equal(calls,1);
});
test('bounded request reader rejects oversized streams without trusting Content-Length',async()=>{
 const {limitedText}=modules()('lib/request-body.ts');
 assert.equal(await limitedText(new Request('http://fixture',{method:'POST',body:'hello'}),10),'hello');
 await assert.rejects(limitedText(new Request('http://fixture',{method:'POST',body:'12345678901'}),10));
 await assert.rejects(limitedText(new Request('http://fixture',{method:'POST',body:'x',headers:{'content-length':'999'}}),10));
});
test('loss of telemetry produces visible warnings, not an empty healthy alert list',async()=>{
 const load=modules({}, {[path.join(root,'lib/server-api.ts')]:{getServerTelemetry:async()=>{throw Error('private connection detail')},getContainers:async()=>{throw Error('private docker detail')}}});
 const alerts=await load('lib/alerts.ts').evaluateSystemAlerts();assert.equal(alerts.length,2);assert.ok(alerts.every(a=>a.level==='warning'));assert.ok(!JSON.stringify(alerts).includes('private'));
});
test('single-flight cache shares reads, does not cache failures, and invalidates on demand',async()=>{
 const {liveValue,clearLiveCache}=modules()('lib/live-cache.ts');let n=0;
 await Promise.all([liveValue('x',async()=>++n),liveValue('x',async()=>++n)]);assert.equal(n,1);
 clearLiveCache();await liveValue('x',async()=>++n);assert.equal(n,2);
 await assert.rejects(liveValue('bad',async()=>{throw Error('fail')}));assert.equal(await liveValue('bad',async()=>42),42);
});
test('SQLite failure blocks persistence; metrics are sampled and login attempts persist',()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'hub-persistence-')),opened=[];const actual=require('node:sqlite');
 const sqlite={DatabaseSync:class extends actual.DatabaseSync{constructor(...args){super(...args);opened.push(this)}}};
 try{
  const env={...configured,DATA_DIR:folder};const db=modules(env,{'node:sqlite':sqlite})('lib/db.ts').getDatabase();assert.equal(db.type,'sqlite');assert.equal(db.persistentReady(),true);
  const sample={timestamp:new Date().toISOString(),cpu_usage:1,load1:1,ram_used_bytes:1,ram_total_bytes:2,disk_used_percent:2,containers_running:3};
  db.insertMetric(sample);db.insertMetric(sample);assert.equal(db.getMetricsHistory().length,1);
  for(let i=0;i<10;i++)assert.equal(db.allowLoginAttempt('fixture-ip'),true);assert.equal(db.allowLoginAttempt('fixture-ip'),false);
  db.resetLoginAttempts('fixture-ip');assert.equal(db.allowLoginAttempt('fixture-ip'),true);
  const fail=modules(env,{'node:sqlite':{DatabaseSync:class{constructor(){throw Error('unavailable')}}}})('lib/db.ts');assert.throws(()=>fail.getDatabase(),/operación bloqueada/);
 }finally{for(const db of opened)db.close();fs.rmSync(folder,{recursive:true,force:true});}
});
test('catalog capabilities reflect operations and distinguish read connectors from management',()=>{
 const {productCapabilities}=modules()('lib/product-capabilities.ts');
 const c=productCapabilities({sources:[{saas:'onlyfood',status:'available'}],managementProducts:['onlyfood'],managementSources:[{saas:'onlyfood',status:'available',operations:['tenant.update']}]},'onlyfood');
 assert.equal(c.available,true);assert.equal(c.settings,true);assert.equal(c.tenantRead,true);assert.equal(c.statusWrite,false);assert.equal(c.impersonation,false);
 assert.equal(productCapabilities(null,'onlyfood').available,false);
});
test('scheduler endpoint still requires its distinct key after middleware bypass',async()=>{
 let calls=0;const load=modules({...configured,HUB_BACKUP_SCHEDULER_KEY:'s'.repeat(64)},{[path.join(root,'lib/backup-service.ts')]:{assertBackupSecurity(){},backupEngine:{tick:async()=>{calls++;return []}}}});
 const {POST}=load('app/api/backups/schedule/run/route.ts');
 assert.equal((await POST(new Request('http://fixture',{method:'POST'}))).status,403);assert.equal(calls,0);
 assert.equal((await POST(new Request('http://fixture',{method:'POST',headers:{authorization:'Bearer '+'s'.repeat(64)}}))).status,200);assert.equal(calls,1);
});
test('authorization denies viewer writes, protected products and unassigned operator apps',()=>{
 const {authorizeRequest,authorizeResource}=modules(configured)('lib/authorization-policy.ts');
 const viewer={role:'viewer',scopes:[],mfaReady:true},operator={role:'operator',scopes:['onlyfood'],mfaReady:true},owner={role:'owner',scopes:[],mfaReady:true};
 for(const p of ['/api/backups','/api/saas-management/onlyfood','/api/apps/lifecycle'])assert.equal(authorizeRequest(viewer,p,'POST'),false);
 assert.equal(authorizeRequest(viewer,'/api/apps/logs','GET'),false);assert.equal(authorizeRequest(operator,'/api/auth/users','POST'),false);
 assert.equal(authorizeRequest(operator,'/api/unknown-new-mutation','POST'),false);
 assert.equal(authorizeRequest({...owner,mfaReady:false},'/api/apps','GET'),false);
 assert.doesNotThrow(()=>authorizeResource(operator,'onlyfood'));assert.throws(()=>authorizeResource(operator,'onlygym'),/permiso/);
 for(const slug of ['onlypadel'])assert.throws(()=>authorizeResource(owner,slug),/protegido/);
 assert.doesNotThrow(()=>authorizeResource(owner,'onlycars'));assert.throws(()=>authorizeResource(operator,'onlycars'),/permiso/);assert.doesNotThrow(()=>authorizeResource({...operator,scopes:['onlycars']},'onlycars'));assert.equal(authorizeRequest(operator,'/api/saas-management/onlycars','POST'),true);
 for(const slug of ['onlycars','onlyerp']){assert.doesNotThrow(()=>authorizeResource(owner,slug));assert.throws(()=>authorizeResource(operator,slug),/permiso/);assert.doesNotThrow(()=>authorizeResource({...operator,scopes:[slug]},slug));assert.throws(()=>authorizeResource(viewer,slug),/consulta/);assert.equal(authorizeRequest(operator,'/api/saas-management/'+slug,'POST'),true);}
 assert.throws(()=>authorizeResource(viewer,'onlyfood'),/consulta/);
});
test('protected backup schedules are blocked even when a legacy row enables them',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hub-backup-policy-'));const module={exports:{}};
 try{
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'backup-engine.cjs'),'utf8'),{module,exports:module.exports,process:{env:{DATA_DIR:dir,HUB_BACKUPS_ENABLED:'true'}},require,console,Buffer,TransformStream,setTimeout,clearTimeout});
  const engine=module.exports,apps=['onlypadel'].map(slug=>({slug,name:slug,dbType:'mariadb',dbContainer:slug+'-db',containerNames:[slug+'-db']}));
  let d=engine.db();for(const a of apps)d.prepare('INSERT INTO backup_schedules(slug,enabled,hour_local,weekdays,updated_at) VALUES(?,1,3,?,?)').run(a.slug,'0,1,2,3,4,5,6',new Date().toISOString());d.close();
  for(const a of apps){assert.throws(()=>engine.schedule(apps,a.slug,{enabled:true,hourLocal:3,weekdays:'0'},'fixture'),/protegido/);await assert.rejects(engine.createBackup(apps,a.slug),/protegido/);}
  assert.ok(engine.schedules(apps).every(s=>s.protected&&s.enabled===false));assert.deepEqual(Array.from(await engine.tick(apps)),[]);
  d=engine.db();assert.equal(d.prepare('SELECT COUNT(*) AS n FROM backup_jobs').get().n,0);d.close();
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('interrupted lifecycle can recover, and saved plans cannot target another product',async()=>{
 let commands=[],saved=null,running=false;
 const record={slug:'onlyfood',state:'active',restorePlan:JSON.stringify([{name:'onlyfood-app-1',restart:'unless-stopped',wasRunning:true}])};
 const db={type:'sqlite',getLifecycleStates:()=>[record],saveLifecycleState:x=>{saved=x},logAudit(){}};
 const load=modules(configured,{[path.join(root,'lib/db.ts')]:{getDatabase:()=>db},[path.join(root,'lib/ssh.ts')]:{executeRemoteCommand:async cmd=>{
  commands.push(cmd);let stdout='';if(cmd.startsWith('docker ps'))stdout='onlyfood-app-1\nonlyfood-db-1';
  if(cmd.startsWith('docker inspect'))stdout=JSON.stringify([{Name:'/onlyfood-app-1',State:{Running:running,Status:running?'running':'exited'},HostConfig:{RestartPolicy:{Name:'unless-stopped'}}},{Name:'/onlyfood-db-1',State:{Running:true,Status:'running'},HostConfig:{RestartPolicy:{Name:'unless-stopped'}}}]);
  if(cmd.startsWith('docker start'))running=true;return {code:0,stdout,stderr:''};
 }}});
 const api=load('lib/app-lifecycle.ts');assert.equal(api.appLifecycle('onlyfood',api.getLifecycleRecords()).recoveryRequired,true);
 assert.throws(()=>api.assertAppActive('onlyfood'),/Recuperación pendiente/);
 assert.equal((await api.changeLifecycle({slug:'onlyfood',action:'resume',actor:'fixture',confirmation:'onlyfood'})).to,'active');assert.equal(saved.restorePlan,null);assert.equal(running,true);
 record.restorePlan=JSON.stringify([{name:'onlypadel-web',restart:'always',wasRunning:true}]);commands=[];
 await assert.rejects(api.changeLifecycle({slug:'onlyfood',action:'resume',actor:'fixture',confirmation:'onlyfood'}),/no autorizados/);assert.equal(commands.length,0);
});
test('backup coverage excludes missing files and labels external copies as metadata only',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hub-backup-inventory-')),backups=path.join(dir,'backups'),folder=path.join(backups,'fixture');fs.mkdirSync(folder,{recursive:true});
 const map=p=>String(p).replace(/\\/g,'/').startsWith('/opt/backups')?path.join(backups,String(p).replace(/\\/g,'/').slice('/opt/backups'.length)):p;
 const proxy={...fs,lstatSync:p=>fs.lstatSync(map(p)),readdirSync:(p,o)=>fs.readdirSync(map(p),o)};
 const module={exports:{}};
 try{
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'backup-engine.cjs'),'utf8'),{module,exports:module.exports,process:{env:{DATA_DIR:dir}},require:n=>n==='node:fs'?proxy:require(n),console,Buffer,setTimeout,clearTimeout});
  const e=module.exports,filename='fixture_20261023.sql.gz',file=path.join(folder,filename);fs.writeFileSync(file,require('node:zlib').gzipSync(Buffer.from('fixture '.repeat(100))));
  const d=e.db();d.prepare('INSERT INTO backup_jobs(id,slug,db_type,filename,status,created_at,finished_at,size_bytes,trigger) VALUES(?,?,?,?,?,?,?,?,?)').run('fixture-id','fixture','mariadb',filename,'integrity_ok',new Date().toISOString(),new Date().toISOString(),fs.statSync(file).size,'test');d.close();
  const apps=[{slug:'fixture',name:'Fixture',dbType:'mariadb'}];assert.equal(e.list(apps)[0].status,'verified');
  fs.copyFileSync(file,path.join(folder,'external.sql.gz'));assert.equal(e.externalInventory(apps)[0].count,1);assert.equal(e.externalInventory(apps)[0].status,'metadata_only');
  fs.unlinkSync(file);assert.equal(e.list(apps)[0].status,'failed');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
