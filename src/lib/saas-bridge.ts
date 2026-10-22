import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { UniversalTenant, SaaSSlug, GovernanceOverview } from "./types";
import { executeRemoteCommand } from "./ssh";

const execFileAsync = promisify(execFile);

/**
 * Universal Docker DB runner that handles execution inside the Docker container
 * or via SSH fallback when running elsewhere.
 */
async function queryDockerDB(container: string, cmdArgs: string[]): Promise<string> {
  if (process.env.DOCKER_HOST_MODE === "internal") {
    try {
      const { stdout } = await execFileAsync("docker", ["exec", container, ...cmdArgs]);
      return stdout.trim();
    } catch (err: any) {
      console.error("queryDockerDB error", container, err instanceof Error ? err.message.slice(0,120) : "unknown");
      throw new Error("Error consultando el conector " + container);
    }
  }

  // Fallback via SSH
  const escapedArgs = cmdArgs.map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(" ");
  const remoteCmd = `docker exec ${container} ${escapedArgs}`;
  const res = await executeRemoteCommand(remoteCmd);
  if (res.code !== 0) throw new Error("El conector Docker no pudo ejecutar la consulta");
  return res.stdout || "";
}

/**
 * Normalizes status strings across different DB standards to Universal status
 */
function normalizeStatus(raw: string): "ACTIVE" | "TRIAL" | "SUSPENDED" | "CANCELED" {
  const s = (raw || "").toUpperCase().trim();
  if (s === "ACTIVE" || s === "ACTIVO") return "ACTIVE";
  if (s === "TRIAL" || s === "PRUEBA") return "TRIAL";
  if (s === "SUSPENDED" || s === "SUSPENDIDO") return "SUSPENDED";
  if (s === "CANCELED" || s === "CANCELADO" || s === "INACTIVE" || s === "INACTIVO") return "CANCELED";
  return "ACTIVE";
}

/**
 * ONLYFOOD DB CONNECTOR
 */
async function getOnlyFoodTenants(): Promise<UniversalTenant[]> {
  try {
    const rawTenants = await queryDockerDB("onlyfood-db-1", [
      "mariadb",
      "-u",
      "onlyfood",
      "-p42da82eca286a3086723f3f1e4e9ec7cee875e00c7b81e50d8b9fcf2ae87392f",
      "onlyfood",
      "-N",
      "-e",
      "SELECT id, slug, name, status, createdAt FROM Tenant;",
    ]);

    if (!rawTenants) return [];

    // Metrics: orders count per tenant
    const rawOrders = await queryDockerDB("onlyfood-db-1", [
      "mariadb",
      "-u",
      "onlyfood",
      "-p42da82eca286a3086723f3f1e4e9ec7cee875e00c7b81e50d8b9fcf2ae87392f",
      "onlyfood",
      "-N",
      "-e",
      "SELECT tenantId, COUNT(*) FROM `Order` GROUP BY tenantId;",
    ]);
    const ordersMap = new Map<string, number>();
    rawOrders.split("\n").forEach((line) => {
      const [tId, cnt] = line.trim().split("\t");
      if (tId) ordersMap.set(tId, Number(cnt) || 0);
    });

    const lines = rawTenants.split("\n").filter(Boolean);
    return lines.map((line) => {
      const [id, slug, name, status, createdAt] = line.trim().split("\t");
      return {
        id,
        saas: "onlyfood",
        saasName: "OnlyFood SaaS",
        slug,
        name: name || slug,
        status: normalizeStatus(status),
        rawStatus: status,
        plan: "Gastronómico Pro",
        createdAt: createdAt ? createdAt.split(".")[0] : new Date().toISOString(),
        domain: `${slug}.nanoapps.ar`,
        metrics: {
          totalRecords: ordersMap.get(id) || 0,
          recordLabel: "Pedidos",
          secondaryMetric: {
            label: "Menú Digital",
            value: 1,
          },
        },
        modules: {
          delivery: true,
          kitchen_display: true,
          whatsapp_alerts: true,
          kiosco: false,
        },
      };
    });
  } catch (err) {
    console.error("Error fetching OnlyFood tenants:", err);
    return [];
  }
}

/**
 * ONLYPADEL DB CONNECTOR
 */
async function getOnlyPadelTenants(): Promise<UniversalTenant[]> {
  try {
    const rawTenants = await queryDockerDB("onlypadel-db", [
      "mariadb",
      "-u",
      "onlypadel",
      "-p8NfSlMUnJ7gxH7qMbvzUz8zHqsK3esUCxx6O3GeB2+GdAT3O",
      "onlypadel",
      "-N",
      "-e",
      "SELECT id, slug, name, status, createdAt FROM tenant;",
    ]);

    if (!rawTenants) return [];

    // Metrics: bookings count per tenant
    const rawBookings = await queryDockerDB("onlypadel-db", [
      "mariadb",
      "-u",
      "onlypadel",
      "-p8NfSlMUnJ7gxH7qMbvzUz8zHqsK3esUCxx6O3GeB2+GdAT3O",
      "onlypadel",
      "-N",
      "-e",
      "SELECT tenantId, COUNT(*) FROM booking GROUP BY tenantId;",
    ]);
    const bookingsMap = new Map<string, number>();
    rawBookings.split("\n").forEach((line) => {
      const [tId, cnt] = line.trim().split("\t");
      if (tId) bookingsMap.set(tId, Number(cnt) || 0);
    });

    const lines = rawTenants.split("\n").filter(Boolean);
    return lines.map((line) => {
      const [id, slug, name, status, createdAt] = line.trim().split("\t");
      return {
        id,
        saas: "onlypadel",
        saasName: "OnlyPadel SaaS",
        slug,
        name: name || slug,
        status: normalizeStatus(status),
        rawStatus: status,
        plan: "Club Platinum",
        createdAt: createdAt ? createdAt.split(".")[0] : new Date().toISOString(),
        domain: `${slug}.nanoapps.ar`,
        metrics: {
          totalRecords: bookingsMap.get(id) || 0,
          recordLabel: "Reservas",
          secondaryMetric: {
            label: "Canchas",
            value: 4,
          },
        },
        modules: {
          turnos_online: true,
          torneos: true,
          ranking_jugadores: true,
          passkeys: true,
        },
      };
    });
  } catch (err) {
    console.error("Error fetching OnlyPadel tenants:", err);
    return [];
  }
}

/**
 * ONLYCARS DB CONNECTOR
 */
async function getOnlyCarsTenants(): Promise<UniversalTenant[]> {
  try {
    const rawTenants = await queryDockerDB("onlycars-db-1", [
      "mariadb",
      "-u",
      "onlycars",
      "-p303ee52464e099ccdcaf0fc2254cd9f9",
      "onlycars",
      "-N",
      "-e",
      "SELECT id, slug, name, status, createdAt FROM Tenant;",
    ]);

    if (!rawTenants) return [];

    // Metrics: vehicles count per tenant
    const rawVehicles = await queryDockerDB("onlycars-db-1", [
      "mariadb",
      "-u",
      "onlycars",
      "-p303ee52464e099ccdcaf0fc2254cd9f9",
      "onlycars",
      "-N",
      "-e",
      "SELECT tenantId, COUNT(*) FROM Vehiculo GROUP BY tenantId;",
    ]);
    const vehiclesMap = new Map<string, number>();
    rawVehicles.split("\n").forEach((line) => {
      const [tId, cnt] = line.trim().split("\t");
      if (tId) vehiclesMap.set(tId, Number(cnt) || 0);
    });

    const lines = rawTenants.split("\n").filter(Boolean);
    return lines.map((line) => {
      const [id, slug, name, status, createdAt] = line.trim().split("\t");
      return {
        id,
        saas: "onlycars",
        saasName: "OnlyCars SaaS",
        slug,
        name: name || slug,
        status: normalizeStatus(status),
        rawStatus: status,
        plan: "Dealership Enterprise",
        createdAt: createdAt ? createdAt.split(".")[0] : new Date().toISOString(),
        domain: `${slug}.nanoapps.ar`,
        metrics: {
          totalRecords: vehiclesMap.get(id) || 0,
          recordLabel: "Vehículos",
          secondaryMetric: {
            label: "Publicaciones",
            value: 12,
          },
        },
        modules: {
          stock_multisede: true,
          cotizador_creditos: true,
          crm_prospectos: true,
          firma_digital: false,
        },
      };
    });
  } catch (err) {
    console.error("Error fetching OnlyCars tenants:", err);
    return [];
  }
}

/**
 * ONLYGYM DB CONNECTOR
 */
async function getOnlyGymTenants(): Promise<UniversalTenant[]> {
  try {
    const rawTenants = await queryDockerDB("onlygym-db", [
      "psql",
      "-U",
      "onlygym",
      "-d",
      "onlygym",
      "-t",
      "-A",
      "-F",
      "\t",
      "-c",
      "SELECT id, slug, nombre, estado, plan, COALESCE(modulos::text, '{}'), creado_en FROM tenants;",
    ]);

    if (!rawTenants) return [];

    // Metrics: clientes count per tenant
    const rawClientes = await queryDockerDB("onlygym-db", [
      "psql",
      "-U",
      "onlygym",
      "-d",
      "onlygym",
      "-t",
      "-A",
      "-F",
      "\t",
      "-c",
      "SELECT tenant_id, COUNT(*) FROM clientes GROUP BY tenant_id;",
    ]);
    const clientesMap = new Map<string, number>();
    rawClientes.split("\n").forEach((line) => {
      const [tId, cnt] = line.trim().split("\t");
      if (tId) clientesMap.set(tId, Number(cnt) || 0);
    });

    const lines = rawTenants.split("\n").filter(Boolean);
    return lines.map((line) => {
      const [id, slug, name, status, plan, modulosJson, createdAt] = line.trim().split("\t");
      let mods: Record<string, boolean> = {
        clases: true,
        puntos: true,
        progreso: true,
        entrenamiento: true,
      };
      try {
        if (modulosJson) mods = { ...mods, ...JSON.parse(modulosJson) };
      } catch {}

      return {
        id,
        saas: "onlygym",
        saasName: "OnlyGym SaaS",
        slug,
        name: name || slug,
        status: normalizeStatus(status),
        rawStatus: status,
        plan: plan ? `Gimnasio ${plan.toUpperCase()}` : "Gimnasio Profesional",
        createdAt: createdAt ? createdAt.split(".")[0] : new Date().toISOString(),
        domain: `${slug}.nanoapps.ar`,
        metrics: {
          totalRecords: clientesMap.get(id) || 0,
          recordLabel: "Socios",
          secondaryMetric: {
            label: "Rutinas",
            value: 8,
          },
        },
        modules: mods,
      };
    });
  } catch (err) {
    console.error("Error fetching OnlyGym tenants:", err);
    return [];
  }
}

/**
 * ONLYTURN DB CONNECTOR
 */
async function getOnlyTurnTenants(): Promise<UniversalTenant[]> {
  try {
    const rawTenants = await queryDockerDB("onlyturn-db", [
      "psql",
      "-U",
      "onlyturn",
      "-d",
      "onlyturn",
      "-t",
      "-A",
      "-F",
      "\t",
      "-c",
      'SELECT id, slug, name, status, "createdAt" FROM "Tenant";',
    ]);

    if (!rawTenants) return [];

    // Metrics: bookings count
    const rawBookings = await queryDockerDB("onlyturn-db", [
      "psql",
      "-U",
      "onlyturn",
      "-d",
      "onlyturn",
      "-t",
      "-A",
      "-F",
      "\t",
      "-c",
      'SELECT "tenantId", COUNT(*) FROM "Booking" GROUP BY "tenantId";',
    ]);
    const bookingsMap = new Map<string, number>();
    rawBookings.split("\n").forEach((line) => {
      const [tId, cnt] = line.trim().split("\t");
      if (tId) bookingsMap.set(tId, Number(cnt) || 0);
    });

    const lines = rawTenants.split("\n").filter(Boolean);
    return lines.map((line) => {
      const [id, slug, name, status, createdAt] = line.trim().split("\t");
      return {
        id,
        saas: "onlyturn",
        saasName: "OnlyTurn SaaS",
        slug,
        name: name || slug,
        status: normalizeStatus(status),
        rawStatus: status,
        plan: "Turnos Inteligente Pro",
        createdAt: createdAt ? createdAt.split(".")[0] : new Date().toISOString(),
        domain: `${slug}.nanoapps.ar`,
        metrics: {
          totalRecords: bookingsMap.get(id) || 0,
          recordLabel: "Citas / Turnos",
          secondaryMetric: {
            label: "Profesionales",
            value: 3,
          },
        },
        modules: {
          agenda_online: true,
          recordatorios_whatsapp: true,
          cobros_señas: true,
          multi_profesional: true,
        },
      };
    });
  } catch (err) {
    console.error("Error fetching OnlyTurn tenants:", err);
    return [];
  }
}

/**
 * ONLYERP DB CONNECTOR
 */
async function getOnlyERPTenants(): Promise<UniversalTenant[]> {
  try {
    const rawTenants = await queryDockerDB("onlyerp-db", [
      "mysql",
      "-u",
      "onlyerp_app",
      "-pb46f852abfc4a5124253ba8ff7b52563",
      "onlyerp_db",
      "-N",
      "-e",
      "SELECT id, slug, nombre, estado, createdAt FROM Tenant;",
    ]);

    if (!rawTenants) return [];

    // Metrics: Products count
    const rawProducts = await queryDockerDB("onlyerp-db", [
      "mysql",
      "-u",
      "onlyerp_app",
      "-pb46f852abfc4a5124253ba8ff7b52563",
      "onlyerp_db",
      "-N",
      "-e",
      "SELECT tenantId, COUNT(*) FROM Producto GROUP BY tenantId;",
    ]);
    const productsMap = new Map<string, number>();
    rawProducts.split("\n").forEach((line) => {
      const [tId, cnt] = line.trim().split("\t");
      if (tId) productsMap.set(tId, Number(cnt) || 0);
    });

    const lines = rawTenants.split("\n").filter(Boolean);
    return lines.map((line) => {
      const [id, slug, name, status, createdAt] = line.trim().split("\t");
      return {
        id,
        saas: "onlyerp",
        saasName: "OnlyERP · Tommasi",
        slug,
        name: name || slug,
        status: normalizeStatus(status),
        rawStatus: status,
        plan: "Distribución Mayorista",
        createdAt: createdAt ? createdAt.split(".")[0] : new Date().toISOString(),
        domain: `onlyerp.nanoapps.ar`,
        metrics: {
          totalRecords: productsMap.get(id) || 0,
          recordLabel: "Artículos Stock",
          secondaryMetric: {
            label: "Depósitos",
            value: 2,
          },
        },
        modules: {
          facturacion_afip: true,
          cuentas_corrientes: true,
          repartos_hojas_ruta: true,
          listas_precios_multiples: true,
        },
      };
    });
  } catch (err) {
    console.error("Error fetching OnlyERP tenants:", err);
    return [];
  }
}

/**
 * Returns all tenants unified across the 6 SaaS platforms
 */
export async function getUniversalGovernanceOverview(): Promise<GovernanceOverview> {
  const [food, padel, cars, gym, turn, erp] = await Promise.all([
    getOnlyFoodTenants(),
    getOnlyPadelTenants(),
    getOnlyCarsTenants(),
    getOnlyGymTenants(),
    getOnlyTurnTenants(),
    getOnlyERPTenants(),
  ]);

  const allTenants = [...food, ...padel, ...cars, ...gym, ...turn, ...erp];

  const totalTenants = allTenants.length;
  const activeTenants = allTenants.filter((t) => t.status === "ACTIVE").length;
  const trialTenants = allTenants.filter((t) => t.status === "TRIAL").length;
  const suspendedTenants = allTenants.filter((t) => t.status === "SUSPENDED" || t.status === "CANCELED").length;
  const totalRecordsManaged = allTenants.reduce((acc, t) => acc + t.metrics.totalRecords, 0);

  const legacyPanels = [
    {
      saas: "OnlyFood",
      legacyAdminUrl: "https://onlyfood.nanoapps.ar/admin",
      sunsetStatus: "active_deprecated" as const,
      replacementUrl: "https://hub.nanoapps.ar/governance?saas=onlyfood",
      notes: "Panel anterior: migración de funciones administrativas por verificar.",
    },
    {
      saas: "OnlyPadel",
      legacyAdminUrl: "https://onlypadel.nanoapps.ar/admin",
      sunsetStatus: "active_deprecated" as const,
      replacementUrl: "https://hub.nanoapps.ar/governance?saas=onlypadel",
      notes: "Panel anterior: migración de funciones administrativas por verificar.",
    },
    {
      saas: "OnlyCars",
      legacyAdminUrl: "https://onlycars.nanoapps.ar/admin",
      sunsetStatus: "active_deprecated" as const,
      replacementUrl: "https://hub.nanoapps.ar/governance?saas=onlycars",
      notes: "Panel anterior: migración de funciones administrativas por verificar.",
    },
    {
      saas: "OnlyGym",
      legacyAdminUrl: "https://onlygym.nanoapps.ar/admin",
      sunsetStatus: "active_deprecated" as const,
      replacementUrl: "https://hub.nanoapps.ar/governance?saas=onlygym",
      notes: "Panel anterior: migración de funciones administrativas por verificar.",
    },
    {
      saas: "OnlyTurn",
      legacyAdminUrl: "https://onlyturn.nanoapps.ar/admin",
      sunsetStatus: "active_deprecated" as const,
      replacementUrl: "https://hub.nanoapps.ar/governance?saas=onlyturn",
      notes: "Panel anterior: migración de funciones administrativas por verificar.",
    },
    {
      saas: "OnlyERP · Tommasi",
      legacyAdminUrl: "https://onlyerp.nanoapps.ar/superadmin",
      sunsetStatus: "active_deprecated" as const,
      replacementUrl: "https://hub.nanoapps.ar/governance?saas=onlyerp",
      notes: "Panel anterior: migración de funciones administrativas por verificar.",
    },
  ];

  return {
    totalTenants,
    activeTenants,
    trialTenants,
    suspendedTenants,
    saasCount: 6,
    totalRecordsManaged,
    tenants: allTenants,
    legacyPanels,
  };
}

/**
 * Updates a tenant status directly in its dedicated database
 */
export async function updateTenantStatusInDB(
  saas: SaaSSlug,
  tenantId: string,
  newStatus: "ACTIVE" | "TRIAL" | "SUSPENDED" | "CANCELED"
): Promise<{ success: boolean; output: string }> {
  let output = "";

  switch (saas) {
    case "onlyfood": {
      output = await queryDockerDB("onlyfood-db-1", [
        "mariadb",
        "-u",
        "onlyfood",
        "-p42da82eca286a3086723f3f1e4e9ec7cee875e00c7b81e50d8b9fcf2ae87392f",
        "onlyfood",
        "-e",
        `UPDATE Tenant SET status = '${newStatus}' WHERE id = '${tenantId}';`,
      ]);
      break;
    }
    case "onlypadel": {
      output = await queryDockerDB("onlypadel-db", [
        "mariadb",
        "-u",
        "onlypadel",
        "-p8NfSlMUnJ7gxH7qMbvzUz8zHqsK3esUCxx6O3GeB2+GdAT3O",
        "onlypadel",
        "-e",
        `UPDATE tenant SET status = '${newStatus}' WHERE id = '${tenantId}';`,
      ]);
      break;
    }
    case "onlycars": {
      output = await queryDockerDB("onlycars-db-1", [
        "mariadb",
        "-u",
        "onlycars",
        "-p303ee52464e099ccdcaf0fc2254cd9f9",
        "onlycars",
        "-e",
        `UPDATE Tenant SET status = '${newStatus}' WHERE id = '${tenantId}';`,
      ]);
      break;
    }
    case "onlygym": {
      const gymStatus = newStatus === "ACTIVE" ? "activo" : newStatus === "TRIAL" ? "prueba" : "suspendido";
      output = await queryDockerDB("onlygym-db", [
        "psql",
        "-U",
        "onlygym",
        "-d",
        "onlygym",
        "-c",
        `UPDATE tenants SET estado = '${gymStatus}' WHERE id = ${Number(tenantId) || 0};`,
      ]);
      break;
    }
    case "onlyturn": {
      output = await queryDockerDB("onlyturn-db", [
        "psql",
        "-U",
        "onlyturn",
        "-d",
        "onlyturn",
        "-c",
        `UPDATE "Tenant" SET status = '${newStatus}' WHERE id = '${tenantId}';`,
      ]);
      break;
    }
    case "onlyerp": {
      const erpStatus = newStatus === "ACTIVE" ? "ACTIVO" : newStatus === "TRIAL" ? "PRUEBA" : "SUSPENDIDO";
      output = await queryDockerDB("onlyerp-db", [
        "mysql",
        "-u",
        "onlyerp_app",
        "-pb46f852abfc4a5124253ba8ff7b52563",
        "onlyerp_db",
        "-e",
        `UPDATE Tenant SET estado = '${erpStatus}' WHERE id = ${Number(tenantId) || 0};`,
      ]);
      break;
    }
  }

  return { success: true, output: output || "Actualización de estado exitosa" };
}

/**
 * Toggles a feature module in the tenant's database
 */
export async function toggleTenantModuleInDB(
  saas: SaaSSlug,
  tenantId: string,
  moduleKey: string,
  enabled: boolean
): Promise<{ success: boolean; output: string }> {
  let output = "";

  if (saas === "onlygym") {
    // OnlyGym stores modules in JSONB
    const current = await queryDockerDB("onlygym-db", [
      "psql",
      "-U",
      "onlygym",
      "-d",
      "onlygym",
      "-t",
      "-A",
      "-c",
      `SELECT COALESCE(modulos::text, '{}') FROM tenants WHERE id = ${Number(tenantId) || 0};`,
    ]);
    let modsObj: Record<string, boolean> = {};
    try {
      modsObj = JSON.parse(current || "{}");
    } catch {}
    modsObj[moduleKey] = enabled;

    output = await queryDockerDB("onlygym-db", [
      "psql",
      "-U",
      "onlygym",
      "-d",
      "onlygym",
      "-c",
      `UPDATE tenants SET modulos = '${JSON.stringify(modsObj)}'::jsonb WHERE id = ${Number(tenantId) || 0};`,
    ]);
  } else {
    // No production connector exists for these SaaS: never report a fake success.
    throw new Error("La edición de módulos todavía no está integrada para esta SaaS");
  }

  return { success: true, output };
}

