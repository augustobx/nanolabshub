import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { executeRemoteCommand } from "./ssh";
import type { GovernanceOverview, SaaSSlug, UniversalTenant } from "./types";
import { SAAS_PRODUCTS } from "./product-taxonomy";
const run = promisify(execFile);
const quote = (s: string) => "'" + s.replace(/'/g, "'\\''") + "'";
type DbTarget = {container:string; engine:"mysql"|"postgres"; database:string};
const TARGETS: Record<SaaSSlug, DbTarget> = {
  onlyfood:{container:"onlyfood-db-1",engine:"mysql",database:"onlyfood"},
  onlypadel:{container:"onlypadel-db",engine:"mysql",database:"onlypadel"},
  onlycars:{container:"onlycars-db-1",engine:"mysql",database:"onlycars"},
  onlyerp:{container:"onlyerp-db",engine:"mysql",database:"onlyerp_db"},
  onlygym:{container:"onlygym-db",engine:"postgres",database:"onlygym"},
  onlyturn:{container:"onlyturn-db",engine:"postgres",database:"onlyturn"}
};
const QUERIES: Record<SaaSSlug,string> = {
  onlyfood:"SELECT id,slug,name,status,createdAt FROM Tenant ORDER BY createdAt DESC LIMIT 2000;",
  onlypadel:"SELECT id,slug,name,status,createdAt FROM tenant ORDER BY createdAt DESC LIMIT 2000;",
  onlycars:"SELECT id,slug,name,status,createdAt FROM Tenant ORDER BY createdAt DESC LIMIT 2000;",
  onlyerp:"SELECT id,slug,nombre,estado,fecha_alta,planId FROM Tenant ORDER BY fecha_alta DESC LIMIT 2000;",
  onlygym:"SELECT id,slug,nombre,estado,creado_en,COALESCE(modulos::text, '{}'),plan FROM tenants ORDER BY creado_en DESC LIMIT 2000;",
  onlyturn:'SELECT id,slug,name,status,"createdAt" FROM "Tenant" ORDER BY "createdAt" DESC LIMIT 2000;'
};
// Never copy passwords into the Hub repository, command-line arguments or audit logs.
// Credentials are read in the target DB container from its pre-existing environment.
// Operators should provision a least-privileged read-only user in a separate change window.
const MYSQL_SCRIPT = [
  'user="$MARIADB_USER"; test -n "$user" || user="$MYSQL_USER"',
  'export MYSQL_PWD="$MARIADB_PASSWORD"; test -n "$MYSQL_PWD" || export MYSQL_PWD="$MYSQL_PASSWORD"',
  'test -n "$user" && test -n "$MYSQL_PWD" || exit 3',
  'if command -v mariadb >/dev/null 2>&1; then dbclient=mariadb; else dbclient=mysql; fi',
  'exec "$dbclient" -u "$user" -D "$1" -N -B --raw -e "$2"',
].join("; ");
const PG_SCRIPT = [
  'export PGPASSWORD="$POSTGRES_PASSWORD"',
  'exec psql -U "$POSTGRES_USER" -d "$1" -t -A -F "$(printf \'\\t\')" -c "$2"',
].join("; ");
async function selectOnly(saas: SaaSSlug): Promise<string> {
  const sql=QUERIES[saas], target=TARGETS[saas];
  if (!/^SELECT /i.test(sql) || /;\s*\S/.test(sql) || /--|\/\*/.test(sql)) throw Error("Consulta fuera del contrato de solo lectura");
  const argv=["exec",target.container,"sh","-ec",target.engine==="mysql"?MYSQL_SCRIPT:PG_SCRIPT,
    "hub-ro",target.database,sql];
  if (process.env.DOCKER_HOST_MODE === "internal") {
    try {return (await run("docker",argv,{timeout:10000,maxBuffer:4*1024*1024})).stdout.trim();}
    catch {throw Error("Conector de solo lectura sin respuesta");}
  }
  const result=await executeRemoteCommand("timeout 12 docker " + argv.map(quote).join(" "));
  if (result.code!==0) throw Error("Conector de solo lectura sin respuesta");
  return result.stdout.trim();
}
export function normalizeTenantStatus(raw:string):UniversalTenant["status"] {
  const status=raw.toUpperCase().trim();
  if (["ACTIVE","ACTIVO"].includes(status))return "ACTIVE";
  if (["TRIAL","PRUEBA","TRIALING"].includes(status))return "TRIAL";
  if (["SUSPENDED","SUSPENDIDO"].includes(status))return "SUSPENDED";
  if (["CANCELED","CANCELLED","CANCELADO","INACTIVO","INACTIVE"].includes(status))return "CANCELED";
  throw Error("Estado no reconocido; se detuvo la lectura para evitar normalizaciones falsas");
}
function dateOrBlank(v:string):string {
  if(!v||v==="NULL")return "";
  const parsed=new Date(v);
  return Number.isFinite(parsed.getTime())?parsed.toISOString():"";
}
function mapRows(saas:SaaSSlug,raw:string):UniversalTenant[] {
  if (!raw) return [];
  const product=SAAS_PRODUCTS.find(p=>p.slug===saas)!;
  return raw.split("\n").filter(Boolean).map(line=>{
    const fields=line.replace(/\r$/,"").split("\t");
    const [id,slug,name,status,date]=fields;
    if(!id||!slug||!name)throw Error("Fila incompleta; el conector " + saas + " no se considera saludable");
    let modules:Record<string,boolean>={};
    if(saas==="onlygym"&&fields[5]&&fields[5]!=="NULL") {
      const parsed:unknown=JSON.parse(fields[5]);
      if(parsed && typeof parsed==="object"&&!Array.isArray(parsed))
        modules=Object.fromEntries(Object.entries(parsed).filter(([key,value])=>/^[a-z0-9_]+$/i.test(key)&&typeof value==="boolean")) as Record<string,boolean>;
    }
    return {
      id:String(id),saas,saasName:product.name,slug:String(slug),name:String(name),
      status:normalizeTenantStatus(status),rawStatus:status,
      plan:saas==="onlygym" ? fields[6]||"Sin informar" :
        saas==="onlyerp"?"Plan #" + (fields[5]||"—"):"Sin plan conectado",
      createdAt:dateOrBlank(date),domain:"",
      metrics:{totalRecords:0,recordLabel:"Métricas no conectadas",available:false},modules
    };
  });
}
export async function getUniversalGovernanceOverview():Promise<GovernanceOverview>{
  const outcomes=await Promise.allSettled(SAAS_PRODUCTS.map(p=>selectOnly(p.slug).then(raw=>mapRows(p.slug,raw))));
  const tenants=outcomes.flatMap(outcome=>outcome.status==="fulfilled"?outcome.value:[]);
  const sources:NonNullable<GovernanceOverview["sources"]>=outcomes.map((outcome,index)=>({
    saas:SAAS_PRODUCTS[index].slug,
    status:outcome.status==="fulfilled"?"available":"unavailable",
    count:outcome.status==="fulfilled"?outcome.value.length:null,
    checkedAt:new Date().toISOString(),
    message:outcome.status==="rejected"?"Consulta fallida: no equivale a cero clientes":null
  }));
  return {
    tenants,sources,saasCount:SAAS_PRODUCTS.length,
    totalTenants:tenants.length,
    activeTenants:tenants.filter(t=>t.status==="ACTIVE").length,
    trialTenants:tenants.filter(t=>t.status==="TRIAL").length,
    suspendedTenants:tenants.filter(t=>t.status==="SUSPENDED"||t.status==="CANCELED").length,
    totalRecordsManaged:0,
    legacyPanels:SAAS_PRODUCTS.map(p=>({
      saas:p.name,legacyAdminUrl:"https://"+p.domain+"/superadmin",
      sunsetStatus:"active_deprecated",replacementUrl:"https://hub.nanoapps.ar/saas/"+p.slug,
      notes:"El panel anterior sigue siendo necesario para las acciones todavía no integradas."
    }))
  };
}
// No writes to any SaaS production database. Unsafe legacy SQL and credential literals removed.
export async function updateTenantStatusInDB():Promise<never> {
  throw Error("Cambios de estado deshabilitados: requiere adaptador API autenticado, auditado y probado.");
}
export async function toggleTenantModuleInDB():Promise<never> {
  throw Error("Edición de módulos deshabilitada: requiere adaptador API autenticado, auditado y probado.");
}
