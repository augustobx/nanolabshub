"use strict";
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const { pipeline } = require("node:stream/promises");
const { Transform } = require("node:stream");
const fs = require("node:fs");
const { createGunzip } = require("node:zlib");
const LIMIT = 512 * 1024 ** 2;
const LABEL = "ar.nanoapps.hub.restore";
const ALLOWED = new Set(["onlyfood", "onlygym", "onlyturn", "onlycars"]);

// No shell, no inherited production environment, no passwords in diagnostics.
function docker(args, { input, timeout = 180000, maxOutput = 2 * 1024 ** 2, binary = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, { stdio: [input ? "pipe" : "ignore", "pipe", "pipe"] });
    let output = "", bytes = 0, settled = false;const chunks=[];
    const timer = setTimeout(() => done(Error("Tiempo agotado en el sandbox de restauración")), timeout);
    function done(error) {
      if (settled) return;
      settled = true; clearTimeout(timer);
      if (error) { child.kill("SIGKILL"); reject(error); } else resolve(binary?Buffer.concat(chunks):output.trim());
    }
    child.on("error", () => done(Error("Docker no disponible para la restauración aislada")));
    child.stdout.on("data", b => {
      bytes += b.length;
      if (bytes > maxOutput) done(Error("Respuesta del sandbox demasiado grande"));
      else if(binary)chunks.push(b);else output += b.toString();
    });
    child.stderr.resume(); // SQL errors can contain customer values: never persist stderr.
    child.on("close", code => done(code === 0 ? null : Error("El comando del sandbox falló; no se aprobó la restauración")));
    if (input) pipeline(input, child.stdin).catch(() => done(Error("No se pudo importar el archivo en el sandbox")));
  });
}

function sandboxSpec(app, image, nonce) {
  if (!ALLOWED.has(app.slug) || !["postgres", "mariadb"].includes(app.dbType)) throw Error("Aplicación fuera del alcance de restauración SQL");
  if (!/^sha256:[a-f0-9]{64}$/.test(image)) throw Error("Se requiere la imagen local exacta de la base");
  if (!/^[a-f0-9]{32}$/.test(nonce)) throw Error("Identidad de sandbox inválida");
  const name = "nanohub-restore-" + nonce;
  const role = "hub_restore_" + nonce;
  const tmp = "rw,nosuid,nodev,noexec,size=1g,mode=1777";
  const args = ["create", "--name", name, "--label", LABEL + "=" + nonce,
    "--network", "none", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges:true",
    "--memory", "1g", "--memory-swap", "1g", "--cpus", "1", "--pids-limit", "128",
    "--restart", "no", "--log-driver", "none", "--tmpfs", "/tmp:rw,nosuid,nodev,size=64m,mode=1777"];
  if (app.dbType === "postgres") args.push("--user", "postgres", "--tmpfs", "/var/lib/postgresql/data:" + tmp,
    "--tmpfs", "/var/run/postgresql:rw,nosuid,nodev,noexec,size=8m,mode=1777", "--env", "PGDATA=/var/lib/postgresql/data/restore",
    "--env", "POSTGRES_USER=" + role, "--env", "POSTGRES_HOST_AUTH_METHOD=trust", image, "postgres", "-c", "listen_addresses=");
  else args.push("--user", "mysql", "--tmpfs", "/var/lib/mysql:" + tmp,
    "--tmpfs", "/run/mysqld:rw,nosuid,nodev,noexec,size=8m,mode=1777", "--entrypoint", "sh",
    image, "-ec", "mariadb-install-db --datadir=/var/lib/mysql --auth-root-authentication-method=normal --skip-test-db >/dev/null 2>&1; exec mariadbd --datadir=/var/lib/mysql --socket=/run/mysqld/mysqld.sock --skip-networking --skip-grant-tables --skip-log-bin --event-scheduler=OFF");
  return { name, nonce, role, args };
}

function createSandboxRunner({ run: transport = docker, pause = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  let running = false, deadline=0;
  function run(args,options={}){
    const remaining=deadline-Date.now();
    if(remaining<=0)throw Error("La restauración aislada excedió 10 minutos");
    return transport(args,{...options,timeout:Math.min(remaining,options.timeout||180000)});
  }
  async function cleanup(id,spec) {
    if (!id || !spec) return;
    try{
      const state = JSON.parse(await transport(["inspect", id],{timeout:30000}));
      if (state[0]?.Id !== id || state[0]?.Name !== "/" + spec.name || state[0]?.Config?.Labels?.[LABEL] !== spec.nonce) throw Error("Sandbox sin propiedad demostrada");
      await transport(["rm", "--force", "--volumes", id],{timeout:30000});
    }catch{const error=Error("No se confirmó la limpieza del sandbox; requiere revisión antes de repetir");error.uncertain=true;throw error;}
  }
  async function restore(app, file, {format="sql"}={}) {
    if (running) throw Error("Ya hay una restauración SQL aislada en curso");
    if (!ALLOWED.has(app.slug) || !app.dbContainer || !app.containerNames?.includes(app.dbContainer) || !/^[\w.-]+$/.test(app.dbContainer)) throw Error("Base de origen fuera del alcance autorizado");
    if(!["sql","postgres-custom"].includes(format)||format==="postgres-custom"&&app.dbType!=="postgres")throw Error("Formato de restauración no compatible");
    running = true;
    deadline=Date.now()+600000;
    let spec, id;
    try {
      // Only metadata from the registered DB; all SQL goes to a new, owned container ID.
      const source = JSON.parse(await run(["inspect", "--format", "{{json .Image}}", app.dbContainer]));
      const metadata = JSON.parse(await run(["image", "inspect", source]));
      const expected = app.dbType === "postgres" ? "postgres@sha256:" : "mariadb@sha256:";
      if (!metadata[0]?.RepoDigests?.some(d => d.startsWith(expected) || d.startsWith("docker.io/library/" + expected))) throw Error("La imagen de base debe tener digest oficial PostgreSQL/MariaDB");
      spec = sandboxSpec(app, source, crypto.randomBytes(16).toString("hex"));
      id = await run(spec.args);
      if (!/^[a-f0-9]{64}$/.test(id)) { id = null; throw Error("Docker no confirmó un ID de sandbox válido"); }
      // Verify ownership before start, exec and removal. A name is never a target for SQL.
      async function owned() {
        const state = JSON.parse(await run(["inspect", id]));
        if (state[0]?.Id !== id || state[0]?.Name !== "/" + spec.name || state[0]?.Config?.Labels?.[LABEL] !== spec.nonce) throw Error("El contenedor no pertenece a esta prueba");
      }
      await owned();
      await run(["start", id]);
      const pg = app.dbType === "postgres";
      const query = pg ? ["psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-U", spec.role, "-d", "postgres"] : ["mariadb", "--protocol=socket", "-uroot", "--batch", "--skip-column-names"];
      let ready = false;
      for (let attempt = 0; attempt < 60; attempt++) {
        try { await run(["exec", id, ...(pg ? ["sh", "-ec", 'test "$(cat /proc/1/comm)" = postgres; exec pg_isready -U "$1"', "sh", spec.role] : ["mariadb-admin", "--protocol=socket", "-uroot", "ping"])], { timeout: 3000 }); ready = true; break; }
        catch { await pause(1000); }
      }
      if (!ready) throw Error("La base temporal no quedó lista");
      await owned();
      let bytes = 0;
      const { PassThrough } = require("node:stream");
      const stream = new PassThrough();
      const bounded = new Transform({ transform(b, enc, cb) { bytes += b.length; cb(bytes > LIMIT ? Error("SQL descomprimido supera 512 MB") : null, b); } });
      const feeding = pipeline(fs.createReadStream(file), createGunzip(), bounded, stream).catch(error => { stream.destroy(error); throw error; });
      const importCommand=format==="postgres-custom"?["pg_restore","--exit-on-error","--create","--no-owner","--no-privileges","-U",spec.role,"-d","postgres"]:query;
      await Promise.all([feeding, run(["exec", "-i", id, ...importCommand], { input: stream })]);
      await owned();
      let manifest;
      if (pg) {
        const dbs = await run(["exec", id, ...query, "-A", "-t", "-c", "SELECT datname FROM pg_database WHERE datallowconn AND NOT datistemplate ORDER BY datname"]);
        if(dbs.split("\n").filter(Boolean).length>64)throw Error("Más de 64 bases en la copia; requiere un procedimiento dedicado");
        manifest = { databases: [], tables: 0, rows: 0, constraintsValidated: 0 };
        for (const database of dbs.split("\n").filter(Boolean)) {
          if (!/^[a-zA-Z0-9_.-]{1,63}$/.test(database)) throw Error("Nombre de base no compatible con la prueba aislada");
          const sql = "SELECT json_build_object('tables',(SELECT count(*) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')),'constraints',(SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema')),'invalidConstraints',(SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE NOT convalidated AND n.nspname NOT IN ('pg_catalog','information_schema')));";
          const counts = JSON.parse(await run(["exec", id, "psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-U", spec.role, "-d", database, "-c", sql]));
          if (counts.invalidConstraints) throw Error("La copia contiene restricciones sin validar");
          if(manifest.tables+counts.tables>2000)throw Error("Más de 2000 tablas; requiere un procedimiento dedicado");
          const rowsSQL = "SELECT format('SELECT count(*) AS n FROM %I.%I;',schemaname,tablename) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema') ORDER BY schemaname,tablename;";
          const statements = await run(["exec", id, "psql", "-X", "-A", "-t", "-U", spec.role, "-d", database, "-c", rowsSQL]);
          const { Readable } = require("node:stream");
          const rows = statements ? (await run(["exec", "-i", id, "psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-U", spec.role, "-d", database], { input: Readable.from([statements]) })).split("\n").reduce((sum, n) => sum + Number(n), 0) : 0;
          if (!Number.isSafeInteger(rows)) throw Error("Conteo de filas inválido");
          manifest.databases.push({ database, tables: counts.tables, rows, constraintsValidated:counts.constraints }); manifest.tables += counts.tables; manifest.rows += rows;manifest.constraintsValidated+=counts.constraints;
        }
      } else {
        await run(["exec", id, "mariadb-check", "--protocol=socket", "-uroot", "--all-databases", "--check"]);
        const rowsSQL = "SELECT CONCAT('SELECT COUNT(*) FROM `',REPLACE(TABLE_SCHEMA,'`','``'),'`.`',REPLACE(TABLE_NAME,'`','``'),'`;') FROM information_schema.TABLES WHERE TABLE_TYPE='BASE TABLE' AND TABLE_SCHEMA NOT IN ('mysql','information_schema','performance_schema','sys') ORDER BY TABLE_SCHEMA,TABLE_NAME;";
        const statements = await run(["exec", id, ...query, "-e", rowsSQL]);
        if(statements.split("\n").length>2000)throw Error("Más de 2000 tablas; requiere un procedimiento dedicado");
        const { Readable } = require("node:stream");
        const rows = statements ? (await run(["exec", "-i", id, ...query], { input: Readable.from([statements]) })).split("\n").reduce((sum, n) => sum + Number(n), 0) : 0;
        if (!Number.isSafeInteger(rows)) throw Error("Conteo de filas inválido");
        const fkSQL="SET SESSION group_concat_max_len=1048576; SELECT CONCAT('SELECT COUNT(*) FROM `',REPLACE(TABLE_SCHEMA,'`','``'),'`.`',REPLACE(TABLE_NAME,'`','``'),'` c LEFT JOIN `',REPLACE(REFERENCED_TABLE_SCHEMA,'`','``'),'`.`',REPLACE(REFERENCED_TABLE_NAME,'`','``'),'` p ON ',GROUP_CONCAT(CONCAT('c.`',REPLACE(COLUMN_NAME,'`','``'),'` = p.`',REPLACE(REFERENCED_COLUMN_NAME,'`','``'),'`') ORDER BY ORDINAL_POSITION SEPARATOR ' AND '),' WHERE ',GROUP_CONCAT(CONCAT('c.`',REPLACE(COLUMN_NAME,'`','``'),'` IS NOT NULL') ORDER BY ORDINAL_POSITION SEPARATOR ' AND '),' AND p.`',REPLACE(MIN(REFERENCED_COLUMN_NAME),'`','``'),'` IS NULL;') FROM information_schema.KEY_COLUMN_USAGE WHERE REFERENCED_TABLE_NAME IS NOT NULL AND TABLE_SCHEMA NOT IN ('mysql','information_schema','performance_schema','sys') GROUP BY TABLE_SCHEMA,TABLE_NAME,CONSTRAINT_NAME,REFERENCED_TABLE_SCHEMA,REFERENCED_TABLE_NAME;";
        const fkStatements=await run(["exec",id,...query,"-e",fkSQL]);
        const fkResults=fkStatements?(await run(["exec","-i",id,...query],{input:Readable.from([fkStatements])})).split("\n"):[];
        if(fkResults.some(n=>!/^0$/.test(n)))throw Error("La copia contiene claves foráneas sin correspondencia");
        manifest = { tables: statements ? statements.split("\n").length : 0, rows, tableCheck: "passed",foreignKeysChecked:fkResults.length };
      }
      return { engine: app.dbType, image: source, bytes, ...manifest, format,ownershipValidation:format==="postgres-custom"?"omitted-for-custom-archive":"dump-defined", comparison: "restored-copy-only", applicationStarted: false };
    } finally {
      try {
        await cleanup(id,spec); // Only this new container's anonymous scratch volumes.
      } finally { running = false; }
    }
  }
  return { restore };
}
module.exports = { createSandboxRunner, sandboxSpec, docker };
