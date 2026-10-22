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
  saasCount: 2, totalRecordsManaged: 1820, tenants, legacyPanels: [],
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
const backups = [{
  id: "demo-backup", appSlug: "onlyfood", appName: "OnlyFood", dbType: "postgres",
  filename: "onlyfood_demo_backup.sql.gz", path: "/opt/backups/onlyfood",
  sizeBytes: 10485760, sizeFormatted: "10 MB", createdAt: "22/10/2026 13:00",
  status: "unverified", storageLocation: "local",
}];
const responses = {
  "/api/governance": { success: true, data: governance },
  "/api/operations": { success: true, data: { timestamp: new Date().toISOString(), telemetry, containers: [container], apps } },
  "/api/apps/logs": { success: true, data: { logs: "fixture: real logs require the production server" } },
  "/api/apps": { success: true, data: apps },
  "/api/telemetry": { success: true, data: { telemetry, containers: [container] } },
  "/api/telemetry/history": { success: true, data: [] },
  "/api/backups": { success: true, data: backups },
  "/api/alerts": { success: true, data: { alerts: [] } },
};

let browser;
try {
  browser = await chromium.launch({ headless: true });
  for (const device of [
    { name: "desktop", viewport: { width: 1440, height: 900 } },
    { name: "mobile", viewport: { width: 390, height: 844 } },
  ]) {
    const context = await browser.newContext({ viewport: device.viewport, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/**", (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith("/api/auth/")) return route.continue();
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
    await page.getByRole("heading", { name: "Centro de control", level: 2 }).waitFor();
    await page.getByRole("heading", { name: "Aplicaciones y versiones" }).waitFor();
    await page.getByText("Git por revisar").first().waitFor();
    await page.locator("span:visible").filter({ hasText: "Mismo commit · 1 cambio local" }).first().waitFor();
    await page.screenshot({ path: `ui-screenshots/${device.name}-overview.png`, fullPage: true });
    if (device.name === "desktop") {
      await page.getByText("Commits diferentes").first().waitFor();
      await page.getByRole("button", { name: "Logs de OnlyFood" }).first().click();
      await page.getByRole("dialog", { name: /Logs de onlyfood-web/ }).waitFor();
      await page.getByText(/fixture: real logs/).waitFor();
      await page.keyboard.press("Escape");
    }
    if (device.name === "mobile") {
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      if (width > device.viewport.width + 4) throw new Error(`Mobile homepage overflows: ${width}px`);
    }

    for (const [path, label] of [
      ["/governance", "Clientes y SaaS"],
      ["/software", "Productos y versiones"],
      ["/hardware", "Infraestructura"],
      ["/backups", "Copias de seguridad"],
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
      await page.getByRole("navigation", { name: "Espacio de trabajo" }).getByRole("link", { name: /Clientes y SaaS/ }).waitFor();
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
