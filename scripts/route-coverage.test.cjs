"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const routes={
  "/jobs":"scoped-jobs",
  "/backups/import":"scoped-import",
  "/alerts":"read", "/apps":"read", "/apps/deploy":"release", "/apps/deploy/stream":"release", "/apps/lifecycle":"lifecycle", "/apps/logs":"scoped-read", "/apps/logs/stream":"scoped-read", "/apps/restart":"scoped-write", "/audit":"read", "/auth/account":"account", "/auth/login":"public-limited", "/auth/logout":"account", "/auth/mfa":"public-limited", "/auth/users":"owner", "/backups":"backups", "/backups/download":"scoped-read", "/backups/restore-check":"backups", "/backups/schedule":"backups", "/backups/schedule/run":"machine", "/docker/prune":"retired", "/governance":"read", "/governance/module":"retired", "/governance/status":"retired", "/health":"public-health", "/infrastructure":"read", "/operations":"read", "/saas-management/[slug]":"scoped-management", "/security/summary":"read", "/telemetry":"read", "/telemetry/history":"read"
};
test("every API has an explicit acceptance/access category; new routes require review",()=>{
  const root=path.resolve(__dirname,"../src/app/api"),found=[];
  function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,e.name);if(e.isDirectory())walk(file);else if(e.name==="route.ts")found.push("/"+path.relative(root,path.dirname(file)).split(path.sep).join("/"));}}
  walk(root);assert.deepEqual(found.sort(),Object.keys(routes).sort(),"Update the acceptance matrix and access tests for new APIs");
  for(const [route,access] of Object.entries(routes)){
    const source=fs.readFileSync(path.join(root,route.slice(1),"route.ts"),"utf8");
    if(access.startsWith("public-"))continue;
    assert.match(source,access==="machine"?/timingSafeEqual/:/getSessionUser|getPrincipal|requireMutatingSession|requireMutatingPrincipal/,"Missing route-level auth: "+route);
  }
});
