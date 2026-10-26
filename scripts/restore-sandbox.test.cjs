"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs/promises"),os=require("node:os"),path=require("node:path"),{gzipSync}=require("node:zlib");
const {createSandboxRunner,sandboxSpec}=require("./restore-sandbox.cjs");
const image="sha256:"+"a".repeat(64),id="b".repeat(64);
const app={slug:"onlygym",dbType:"postgres",dbContainer:"fixture-source",containerNames:["fixture-source"]};
test("SQL sandbox has no host volumes, published ports, network, privileges or production secrets",()=>{
 for(const dbType of ["postgres","mariadb","mysql"]){
  const spec=sandboxSpec({...app,dbType},image,"c".repeat(32));
  const args=spec.args;
  for(const forbidden of ["--volume","-v","--mount","--publish","-p","--privileged","--env-file"])assert.ok(!args.includes(forbidden));
  assert.equal(args[args.indexOf("--network")+1],"none");
  assert.equal(args[args.indexOf("--cap-drop")+1],"ALL");
  assert.ok(args.includes("--read-only"));assert.ok(args.includes("--memory"));assert.ok(args.includes("--pids-limit"));
  assert.ok(args.includes("--user"));assert.ok(!args.some(a=>/POSTGRES_PASSWORD|MYSQL_ROOT_PASSWORD|MARIADB_ROOT_PASSWORD/.test(a)));
 }
 assert.throws(()=>sandboxSpec({...app,slug:"onlypadel"},image,"c".repeat(32)),/fuera del alcance/);
 const cars=sandboxSpec({...app,slug:"onlycars",dbType:"mariadb"},image,"c".repeat(32));
 assert.equal(cars.args[cars.args.indexOf("--network")+1],"none");assert.ok(!cars.args.includes("-v"));assert.ok(!cars.args.includes("-p"));
 assert.throws(()=>sandboxSpec(app,"postgres:latest","c".repeat(32)),/imagen local exacta/);
});
test("SQL is sent only to the new verified ID; failure cleans only its own sandbox",async()=>{
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),"hub-sandbox-test-")),file=path.join(folder,"fixture.sql.gz");
 await fs.writeFile(file,gzipSync("CREATE TABLE fixture(id INTEGER);\nINSERT INTO fixture VALUES(1);\n"));
 const calls=[];let spec;
 const run=async(args,options={})=>{
  calls.push(args);
  if(args[0]==="inspect"&&args.includes("--format"))return JSON.stringify(image);
  if(args[0]==="image")return JSON.stringify([{RepoDigests:["postgres@sha256:"+"a".repeat(64)]}]);
  if(args[0]==="create"){spec=args;return id;}
  if(args[0]==="inspect")return JSON.stringify([{Id:id,Name:"/"+spec[spec.indexOf("--name")+1],Config:{Labels:{"ar.nanoapps.hub.restore":spec[spec.indexOf("--label")+1].split("=")[1]}}}]);
  if(args[0]==="exec"&&args.includes("-i")){let bytes=0;for await(const chunk of options.input)bytes+=chunk.length;assert.ok(bytes>0);throw Error("invalid SQL fixture");}
  return "";
 };
 try{
  await assert.rejects(createSandboxRunner({run,pause:async()=>{}}).restore(app,file),/invalid SQL/);
  assert.deepEqual(calls.filter(a=>a[0]==="rm"),[["rm","--force","--volumes",id]]);
  for(const args of calls.filter(a=>["exec","start","rm"].includes(a[0])))assert.ok(args.includes(id)&&!args.includes("fixture-source"));
 }finally{await fs.rm(folder,{recursive:true,force:true});}
});
test("protected sources are rejected before Docker and non-official images cannot start",async()=>{
 let calls=0;
 const runner=createSandboxRunner({run:async args=>{calls++;return args[0]==="image"?JSON.stringify([{RepoDigests:["untrusted/database@sha256:"+"a".repeat(64)]}]):JSON.stringify(image);}});
 await assert.rejects(runner.restore({...app,slug:"onlypadel"},"unused"),/fuera del alcance/);assert.equal(calls,0);
 await assert.rejects(runner.restore(app,"unused"),/digest oficial/);assert.equal(calls,2);
});
test("lost sandbox ownership never deletes a container and leaves an uncertain cleanup result",async()=>{
 const calls=[];
 const run=async args=>{
  calls.push(args);
  if(args[0]==="inspect"&&args.includes("--format"))return JSON.stringify(image);
  if(args[0]==="image")return JSON.stringify([{RepoDigests:["postgres@sha256:"+"a".repeat(64)]}]);
  if(args[0]==="create")return id;
  if(args[0]==="inspect")return JSON.stringify([{Id:id,Name:"/unowned-container",Config:{Labels:{}}}]);
  throw Error("Unexpected command");
 };
 await assert.rejects(createSandboxRunner({run}).restore(app,"unused"),error=>error.uncertain===true);
 assert.equal(calls.filter(a=>["start","exec","rm"].includes(a[0])).length,0);
});
