import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function runDockerExec(container, cmdArgs) {
  try {
    const { stdout, stderr } = await execFileAsync("docker", [
      "exec",
      container,
      ...cmdArgs,
    ]);
    return stdout.trim();
  } catch (err) {
    return `ERR: ${err.message}`;
  }
}

async function testAll() {
  console.log("=== Testing Multi-SaaS DB Queries via Docker CLI ===");

  // OnlyFood
  const food = await runDockerExec("onlyfood-db-1", [
    "mariadb",
    "-u", "onlyfood",
    "-p42da82eca286a3086723f3f1e4e9ec7cee875e00c7b81e50d8b9fcf2ae87392f",
    "onlyfood",
    "-e", "SELECT id, slug, name, status, createdAt FROM Tenant;",
  ]);
  console.log("\n[OnlyFood Tenants]:\n", food);

  // OnlyPadel
  const padel = await runDockerExec("onlypadel-db", [
    "mariadb",
    "-u", "onlypadel",
    "-p8NfSlMUnJ7gxH7qMbvzUz8zHqsK3esUCxx6O3GeB2+GdAT3O",
    "onlypadel",
    "-e", "SELECT id, slug, name, status, createdAt FROM tenant;",
  ]);
  console.log("\n[OnlyPadel Tenants]:\n", padel);

  // OnlyCars
  const cars = await runDockerExec("onlycars-db-1", [
    "mariadb",
    "-u", "onlycars",
    "-p303ee52464e099ccdcaf0fc2254cd9f9",
    "onlycars",
    "-e", "SELECT id, slug, name, status, createdAt FROM Tenant;",
  ]);
  console.log("\n[OnlyCars Tenants]:\n", cars);

  // OnlyGym
  const gym = await runDockerExec("onlygym-db", [
    "psql",
    "-U", "onlygym",
    "-d", "onlygym",
    "-c", "SELECT id, slug, nombre, estado, plan, modulos, creado_en FROM tenants;",
  ]);
  console.log("\n[OnlyGym Tenants]:\n", gym);

  // OnlyTurn
  const turn = await runDockerExec("onlyturn-db", [
    "psql",
    "-U", "onlyturn",
    "-d", "onlyturn",
    "-c", 'SELECT id, slug, name, status, "createdAt" FROM "Tenant";',
  ]);
  console.log("\n[OnlyTurn Tenants]:\n", turn);

  // OnlyERP
  const erp = await runDockerExec("onlyerp-db", [
    "mysql",
    "-u", "onlyerp_app",
    "-pb46f852abfc4a5124253ba8ff7b52563",
    "onlyerp_db",
    "-e", "SELECT id, slug, nombre, estado, createdAt FROM Tenant;",
  ]);
  console.log("\n[OnlyERP Tenants]:\n", erp);
}

testAll();
