import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const origin = process.env.UI_BASE_URL || "http://127.0.0.1:3005";
await mkdir("ui-screenshots", { recursive: true });

const tenant = (id, saas, saasName, name, status, records) => ({
  id, saas, saasName, name, slug: name.toLowerCase().replace(/\s+/g, "-"),
  status, rawStatus: status, plan: "Profesional", createdAt: "2026-10-01",
  domain: `${saas}.example.com`, metrics: { totalRecords: records, recordLabel: "registros" },
  modules: { pedidos: true, notificaciones: true, reportes: false, fidelizacion: true, integraciones: false },
});
const tenants = [
  tenant("1", "onlyfood", "OnlyFood", "Restaurante de ejemplo", "ACTIVE", 1480),
  tenant("2", "onlypadel", "OnlyPadel", "Club deportivo de ejemplo", "TRIAL", 340),
];
const governance = {
  totalTenants: 2, activeTenants: 1, trialTenants: 1, suspendedTenants: 0,
  saasCount: 7, totalRecordsManaged: 1820, tenants, legacyPanels: [],
  sources: ["onlyfood","onlypadel","onlycars","onlyerp","onlygym","onlyturn","onlymob"].map(saas => ({
    saas, status: ["onlyfood","onlypadel"].includes(saas) ? "available" : "unavailable",
    count: saas === "onlyfood" || saas === "onlypadel" ? 1 : null,
    checkedAt: new Date().toISOString(), message: null
  })),
};
const container = {
  id: "demo-1", name: "onlyfood-web", image: "onlyfood:latest", cpuPercent: "2.7%", memoryUsage: "115MiB / 1GiB", status: "Up 3 hours",
  state: "running", health: "healthy", ports: "3000/tcp", created: "hace 3 horas",
};
const telemetry = {
  hostname: "Servidor de ejemplo", uptime: "5 días", osInfo: "Debian",
  cpu: { cores: 12, usagePercent: 27, loadAvg: [0.24, 0.35, 0.19] },
  memory: {
    totalBytes: 17179869184, usedBytes: 6442450944, freeBytes: 10737418240,
    usedPercent: 37.5, swapTotalBytes: 0, swapUsedBytes: 0, swapUsedPercent: 0,
  },
  disks: [{
    filesystem: "/dev/nvme0n1", mount: "/", totalBytes: 536870912000,
    usedBytes: 139586437120, freeBytes: 397284474880, usedPercent: 26,
  }],
  docker: { version: "29", containersTotal: 1, containersRunning: 1, containersPaused: 0, containersStopped: 0 },
  timestamp: new Date().toISOString(),
};
const apps = [
  { slug: "onlyfood", name: "OnlyFood", path: "/opt/apps/onlyfood", type: "saas",
    url: "https://onlyfood.example.com", hasDockerCompose: true, status: "operational",
    git: { isRepo: true, branch: "main", commitHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", remoteCommit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", remoteStatus: "different", commitMessage: "UI test example",
      commitDate: "2026-10-22", commitAuthor: "NanoLabs", dirtyFilesCount: 0 },
    containers: [container], web: { status: "online", httpStatus: 200, latencyMs: 55, checkedAt: new Date().toISOString() }, deployment: {revision: null,imageId: "sha256:aaaabbbbcccc", status: "unidentified"}, database: { type: "postgres", host: "localhost", port: 5432 } },
  { slug: "onlypadel", name: "OnlyPadel", path: "/opt/apps/onlypadel", type: "saas",
    hasDockerCompose: true, status: "degraded",
    git: { isRepo: true, branch: "main", commitHash: "cccccccccccccccccccccccccccccccccccccccc", remoteCommit: "cccccccccccccccccccccccccccccccccccccccc", remoteStatus: "synced", commitMessage: "UI test example",
      commitDate: "2026-10-22", commitAuthor: "NanoLabs", dirtyFilesCount: 1 },
    containers: [], web: { status: "offline", httpStatus: null, latencyMs: null, checkedAt: new Date().toISOString() }, deployment: {revision: null,imageId: null,status: "not_running"}, database: { type: "postgres", host: "localhost", port: 5432 } },
];
apps.forEach((app) => {
  app.lifecycle = { state: "active", updatedAt: null, updatedBy: null, note: "" };
});
apps.push({
  ...apps[0], slug: "retired-demo", name: "Aplicación archivada demo",
  type: "client", path: "/opt/apps/retired-demo",
  containers: [], status: "degraded",
  lifecycle: { state: "archived", updatedAt: new Date().toISOString(), updatedBy: "admin", note: "Cierre de prueba" },
});

const backups = [{
  id: "demo-backup", appSlug: "onlyfood", appName: "OnlyFood", dbType: "postgres",
  filename: "onlyfood_demo_backup.sql.gz", path: "/opt/backups/onlyfood",
  sizeBytes: 10485760, sizeFormatted: "10 MB", createdAt: "22/10/2026 13:00",
  status: "unverified", storageLocation: "local",
}];
const responses = {
  "/api/governance": { success: true, data: governance },
  "/api/operations": { success: true, data: { timestamp: new Date().toISOString(), telemetry, containers: [container], apps } },
  "/api/infrastructure": { success: true, data: {
    timestamp: new Date().toISOString(), host: telemetry,
    totals: { running: 1, unhealthy: 0, unassigned: 0, databases: 0, domains: 1 },
    containers: [{ name: "onlyfood-web", kind: "service", state: "running", health: "healthy", appName: "OnlyFood", owner: "onlyfood", expectedStopped: false, image: "onlyfood:latest", ports: "3000/tcp" }],
    groups: {
      core: [], database: [], service: [{ name: "onlyfood-web", kind: "service", state: "running", health: "healthy", appName: "OnlyFood", owner: "onlyfood", expectedStopped: false, image: "onlyfood:latest", ports: "3000/tcp" }],
      worker: [], unassigned: []
    },
    domains: [{ slug: "onlyfood", appName: "OnlyFood", url: "https://onlyfood.example.com", lifecycle: "active", status: "online", httpStatus: 200, checkedAt: new Date().toISOString(), source: "registry_probe" }]
  } },
  "/api/apps/logs": { success: true, data: { logs: "fixture: real logs require the production server" } },
  "/api/apps": { success: true, data: apps },
  "/api/telemetry": { success: true, data: { telemetry, containers: [container] } },
  "/api/telemetry/history": { success: true, data: [] },
  "/api/backups": { success: true, data: backups, schedules: [
    { slug: "onlyfood", name: "OnlyFood", enabled: false, hourLocal: 3, weekdays: "0,1,2,3,4,5,6", lastRunDay: null },
    { slug: "onlypadel", name: "OnlyPadel", enabled: true, hourLocal: 4, weekdays: "0", lastRunDay: "2026-10-21" },
  ] },
  "/api/audit": { success: true, data: [{id:1,timestamp:new Date().toISOString(),actor:"ci",action:"BACKUP_CREATED",target:"nanolabshub",details:"Copia verificada",source:"hub-local"}] },
  "/api/security/summary": { success: true, data: {
    access:{adminCredentialsConfigured:true,multiFactorAvailable:false,roleBasedPermissionsAvailable:false,localAudit:true},
    switches:{backups:true,lifecycle:true,saasConnectors:false},
    connectors:["onlyfood","onlypadel","onlycars","onlyerp","onlygym","onlyturn","onlymob"].map(slug=>({slug,name:slug,enabled:false,credentialConfigured:false,safeWriteContract:false})),
    offsite:{providerConfigured:false,lastVerifiedAt:null},
    legacy:{dbCredentialsRotation:"not_verified",superadminMigration:"incomplete"}
  } },
  "/api/backups/restore-check": { success: true, data: [] },
  "/api/alerts": { success: true, data: { alerts: [] } },
};

let browser;
try {
  browser = await chromium.launch({ headless: true });
  for (const device of [
    { name: "desktop", viewport: { width: 1440, height: 900 } },
    { name: "mobile", viewport: { width: 390, height: 844 } },
  ]) {
    // Requests are mocked for each viewport independently.
    apps[0].lifecycle.state = "active";
    const context = await browser.newContext({ viewport: device.viewport, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/**", (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith("/api/auth/")) return route.continue();
      if (url.pathname === "/api/backups/schedule" && route.request().method() === "POST") {
        const input = route.request().postDataJSON();
        const schedule = responses["/api/backups"].schedules.find((item) => item.slug === input.slug);
        if (schedule) Object.assign(schedule, input.config);
        return route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ success: true, data: responses["/api/backups"].schedules }) });
      }
      if (url.pathname === "/api/apps/lifecycle") {
        if (route.request().method() === "GET") {
          return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: [] }) });
        }
        const body = route.request().postDataJSON();
        const target = apps.find((app) => app.slug === body.slug);
        if (!target || body.confirmation !== target.slug || (body.action === "archive" && body.acknowledgeBackup !== true)) {
          return route.fulfill({ status: 422, contentType: "application/json", body: JSON.stringify({ success: false, error: "Confirmación insuficiente" }) });
        }
        const next = { suspend: "suspended", archive: "archived", resume: "active", pending_retirement: "pending_retirement" }[body.action];
        target.lifecycle = { ...target.lifecycle, state: next };
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { label: next, details: "Docker: acción confirmada en fixture" } }) });
      }
      const fixture = responses[url.pathname];
      if (!fixture) return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ success: false, error: "UI test fixture missing" }) });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture) });
    });

    await page.goto(`${origin}/login`, { waitUntil: "domcontentloaded" });
    await page.screenshot({ path: `ui-screenshots/${device.name}-login.png`, fullPage: true });
    await page.locator('input[type="text"]').fill("ci_smoke");
    await page.locator('input[type="password"]').fill("ci_smoke_password");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((url) => url.pathname === "/", { timeout: 15000 });
    await page.getByRole("heading", { name: "Toda tu operación, en orden." }).waitFor();
    await page.getByRole("heading", { name: "Productos SaaS" }).waitFor();
    await page.getByRole("link", { name: /Superadmin/i }).first().waitFor();
    await page.screenshot({ path: `ui-screenshots/${device.name}-overview.png`, fullPage: true });
    await page.goto(origin + "/operations", { waitUntil: "domcontentloaded" });
    await page.getByText("Git por revisar").first().waitFor();
    await page.locator("span:visible").filter({ hasText: "Mismo commit · 1 cambio local" }).first().waitFor();
    if (device.name === "desktop") {
      await page.getByText("Commits diferentes").first().waitFor();
      await page.getByRole("button", { name: "Logs de OnlyFood" }).first().click();
      await page.getByRole("dialog", { name: /Logs de onlyfood-web/ }).waitFor();
      await page.getByText(/fixture: real logs/).waitFor();
      await page.keyboard.press("Escape");
    }
    await page.screenshot({ path: `ui-screenshots/${device.name}-operations.png`, fullPage: true });
    if (device.name === "mobile") {
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      if (width > device.viewport.width + 4) throw new Error(`Mobile homepage overflows: ${width}px`);
    }

    for (const [path, label] of [
      ["/governance", "Clientes y tenants"],
      ["/superadmin", "Superadmin"],
      ["/saas", "Productos SaaS"],
      ["/saas/onlyfood", "Espacio de SaaS"],
      ["/software", "Aplicaciones y versiones"],
      ["/infrastructure", "Infraestructura"],
      ["/hardware", "Infraestructura"],
      ["/backups", "Copias de seguridad"],
      ["/continuity", "Recuperación"],
      ["/security", "Seguridad"],
      ["/audit", "Auditoría"],
      ["/legacy", "Migración de paneles"],
      ["/networking", "Dominios y red"],
    ]) {
      await page.goto(`${origin}${path}`, { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: label, exact: true }).first().waitFor({ timeout: 15000 });
      await page.screenshot({
        path: `ui-screenshots/${device.name}-${path.slice(1)}.png`, fullPage: true,
        animations: "disabled",
      });
      if (device.name === "mobile") {
        const width = await page.evaluate(() => document.documentElement.scrollWidth);
        if (width > device.viewport.width + 4) {
          throw new Error(`Mobile horizontal overflow at ${path}: ${width}px (viewport ${device.viewport.width}px)`);
        }
      }
      if (path === "/continuity") {
        await page.getByRole("heading", { name: "Preparación de recuperación por aplicación" }).waitFor();
        await page.getByText("Copia externa verificada").first().waitFor();
      }
      if (path === "/security") {
        await page.getByRole("heading", { name: "Integración por SaaS" }).waitFor();
      }
      if (path === "/audit") {
        await page.getByRole("heading", { name: "Eventos locales del Hub" }).waitFor();
        await page.getByText("BACKUP_CREATED").first().waitFor();
      }
      if (path === "/legacy") {
        await page.getByRole("heading", { name: "Planes de migración por producto" }).waitFor();
      }
      if (path === "/infrastructure") {
        await page.getByRole("heading", { name: "Inventario técnico clasificado" }).waitFor();
        await page.getByRole("button", { name: /Servicios web/ }).click();
        await page.getByText("onlyfood-web").first().waitFor();
      }
      if (path === "/networking") {
        await page.getByRole("heading", { name: "Inventario de URLs" }).waitFor();
        await page.getByText("HTTP responde").first().waitFor();
      }
      if (path === "/saas") {
        await page.getByRole("link", { name: "Abrir OnlyFood" }).waitFor();
        await page.getByRole("link", { name: "Abrir OnlyPadel" }).waitFor();
        if (await page.getByRole("link", { name: "Abrir NanoMonitor" }).count()) throw new Error("SaaS catalog includes internal apps");
      }
      if (path === "/saas/onlyfood") {
        await page.getByRole("button", { name: "Tenants", exact: true }).click();
        await page.getByRole("heading", { name: "Tenants de OnlyFood" }).waitFor();
        await page.getByRole("button", { name: "Configuración" }).click();
        await page.getByText("Pendiente de integración").first().waitFor();
        await page.screenshot({ path: `ui-screenshots/${device.name}-saas-workspace.png`, fullPage: true });
      }
      if (path === "/superadmin") {
        await page.getByRole("heading", { name: "Mapa de integración por producto" }).waitFor();
        await page.getByText("0 / 7").waitFor();
      }
      if (path === "/backups") {
        await page.getByRole("heading", { name: "Generar backup manual" }).waitFor();
        await page.getByRole("button", { name: "Seleccionar OnlyPadel SaaS para backup" }).click();
        const appCard = page.getByRole("button", { name: "Seleccionar OnlyPadel SaaS para backup" });
        if (await appCard.getAttribute("aria-pressed") !== "true") throw new Error("Manual backup card selection was not reflected");
        await page.getByRole("button", { name: "Generar backup ahora" }).click();
        const confirm = page.getByRole("dialog", { name: "Confirmar respaldo" });
        await confirm.waitFor();
        await confirm.getByText("OnlyPadel SaaS").waitFor();
        await confirm.getByRole("button", { name: "Cancelar" }).click();
        await confirm.waitFor({ state: "hidden" });
        await page.getByRole("searchbox", { name: "Buscar aplicación para backup" }).fill("nanolabs hub");
        await page.getByRole("button", { name: "Seleccionar NanoLabs Hub para backup" }).waitFor();
        if (await page.getByRole("button", { name: "Seleccionar OnlyPadel SaaS para backup" }).count() !== 0) {
          throw new Error("Manual backup search did not filter app cards");
        }
        await page.getByRole("searchbox", { name: "Buscar aplicación para backup" }).fill("");
        await page.screenshot({ path: `ui-screenshots/${device.name}-backups-manual.png`, fullPage: true, animations: "disabled" });
        await page.getByText("Backups programados").waitFor();
        const selector = page.getByRole("combobox", { name: "Hora de OnlyFood" });
        await selector.selectOption("5");
        await page.getByRole("button", { name: "Guardar" }).first().click();
        await page.getByRole("link", { name: "Descargar" }).count();
      }
      if (path === "/software") {
        const archived = page.getByText("Aplicación archivada demo");
        if (await archived.isVisible().catch(() => false)) throw new Error("An archived app appeared in active catalog");
        await page.getByRole("button", { name: /Mostrar archivadas/ }).click();
        await archived.waitFor();
        await page.getByRole("button", { name: "Ocultar archivadas" }).click();
        await archived.waitFor({ state: "hidden" });

        if (device.name === "desktop") {
        await page.getByRole("button", { name: "SaaS" , exact: true }).click();
        const onlyFood = page.locator("#software-item-onlyfood");
        await onlyFood.getByRole("button", { name: "Archivar aplicación" }).click();
        const dialog = page.getByRole("dialog", { name: "Archivar aplicación" });
        await dialog.waitFor();
        const confirmButton = dialog.getByRole("button", { name: "Confirmar archivar aplicación" });
        if (await confirmButton.isEnabled()) throw new Error("Archive button initially enabled without confirmation");
        await dialog.getByRole("textbox", { name: "Confirmar identificador de aplicación" }).fill("onlyfood");
        if (await confirmButton.isEnabled()) throw new Error("Archive button enabled without backup acknowledgement");
        await dialog.getByRole("checkbox").check();
        await confirmButton.click();
        await dialog.waitFor({ state: "hidden" });
        await onlyFood.waitFor({ state: "hidden" });
        }
      }
      if (path === "/governance") {
        const button = page.getByRole("button", { name: "Administrar módulos" }).first();
        await button.waitFor({ timeout: 10000 });
        await button.click();
        const dialog = page.locator('[role="dialog"]');
        try {
          await dialog.waitFor({ timeout: 7000 });
        } catch (error) {
          await page.screenshot({ path: `ui-screenshots/${device.name}-tenant-dialog-debug.png`, fullPage: true });
          console.error("Missing tenant dialog. Clicked button:", await button.count(),
            "visible dialogs:", await page.locator('[role="dialog"]').count(),
            "page headings:", await page.locator("h1,h2,h3").allTextContents());
          throw error;
        }
        await dialog.getByRole("heading", { name: /de ejemplo/i }).waitFor();
        await page.getByRole("tab", { name: "Funcionalidades" }).click();
        await page.getByRole("switch", { name: /pedidos/i }).waitFor();
        await page.waitForTimeout(250);
        await page.screenshot({ path: `ui-screenshots/${device.name}-tenant-dialog.png`, fullPage: false });
        await page.keyboard.press("Escape");
        await page.getByRole("dialog").waitFor({ state: "hidden" });
      }
    }
    if (device.name === "mobile") {
      await page.goto(origin, { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "Abrir navegación" }).click();
      await page.getByRole("navigation", { name: "Negocio" }).getByRole("link", { name: /Productos SaaS/ }).waitFor();
      await page.waitForTimeout(250);
      await page.screenshot({ path: "ui-screenshots/mobile-navigation.png", fullPage: false });
    }
    if (errors.length) throw new Error(`${device.name} browser errors: ${errors.join("; ")}`);
    await context.close();
    console.log(`UI smoke OK: ${device.name}`);
  }
} finally {
  await browser?.close();
}
