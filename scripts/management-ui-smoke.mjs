import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
import { signInFixture } from "./ui-auth.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || "playwright");

const origin = process.env.UI_BASE_URL || "http://127.0.0.1:3005";
assert.ok(["127.0.0.1", "localhost"].includes(new URL(origin).hostname), "UI fixtures cannot run against a public deployment");
const out = process.env.UI_SCREENSHOT_DIR || "ui-screenshots/management";
await mkdir(out, { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_BROWSER_EXECUTABLE || undefined });
let assertions = 0;
const now = "2026-10-23T00:00:00.000Z";
const end = "2027-10-23T00:00:00.000Z";

for (const device of [
  { name: "desktop", viewport: { width: 1440, height: 1000 } },
  { name: "mobile", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
]) {
  const context = await browser.newContext(device);
  await signInFixture(context, origin);
  const page = await context.newPage();
  const errors = [];
  const commands = [];
  page.on("pageerror", (error) => errors.push(error.message));

  const catalogs = {
    onlyshop: { modules: ["pwaEnabled", "accountsEnabled"], limits: ["maxProducts"], optionalLimits: [], currency: "ARS", immutableSlug: true, statuses: ["ACTIVE", "TRIAL", "PAST_DUE", "SUSPENDED", "CANCELED"] },
    onlyerp: { modules: ["VENTAS", "AFIP"], limits: ["maxUsers", "maxLocations", "maxWarehouses"], optionalLimits: [], currency: "ARS", paymentCalendar: true, adminIdentity: "username", ownerIdentity: "username", immutableSlug: true, statuses: ["ACTIVE", "TRIAL", "SUSPENDED", "CANCELED"] },
    onlycars: { modules: ["pwa_clientes", "seller_pwa", "branding_documentos"], limits: ["maxVehicles", "maxLocations", "maxUsers"], optionalLimits: [], currency: "USD", paymentPeriods: true, immutableSlug: true, tenantFields: ["email", "phone", "address", "city", "cuit"], domainManagement: true, trialDates: true, statuses: ["ACTIVE", "TRIAL", "PAST_DUE", "SUSPENDED", "CANCELED"] },
    onlyfood: { modules: ["orders", "loyalty"], limits: ["maxLocations", "maxProducts"], optionalLimits: [], paymentLifecycle: true, trialDates: true, statuses: ["ACTIVE", "TRIAL", "PAST_DUE", "SUSPENDED", "CANCELED"] },
    onlygym: { modules: ["socios", "reportes"], limits: ["maxUsers", "maxBranches", "maxMembers"], optionalLimits: ["maxMembers"] },
    onlyturn: { modules: ["whatsappNotifications", "advancedReports"], limits: ["maxLocations", "maxStaff", "maxResources", "maxBookings"], optionalLimits: [] },
  };
  const operations = ["tenant.create", "tenant.update", "tenant.status", "subscription.update", "subscription.renew", "module.set", "admin.update", "admin.revoke", "plan.create", "plan.update", "payment.record", "payment.status", "domain.add"];
  const plans = {};
  const tenants = {};
  let sequence = 1;
  const revision = () => new Date(Date.parse(now) + sequence++).toISOString();

  for (const product of ["onlygym", "onlyturn", "onlyfood", "onlycars", "onlyerp", "onlyshop"]) {
    const catalog = catalogs[product];
    const plan = {
      id: "plan-" + product,
      code: "PRO",
      name: "Profesional",
      description: "Fixture",
      priceCents: 10000,
      currency: catalog.currency || "ARS",
      active: true,
      modules: Object.fromEntries(catalog.modules.map((k) => [k, true])),
      limits: Object.fromEntries(catalog.limits.map((k) => [k, 100])),
      version: revision(),
    };
    plans[product] = [plan];
    tenants[product] = [
      {
        id: "tenant-" + product,
        name: "Empresa QA " + product,
        slug: "qa-" + product,
        status: "ACTIVE",
        version: revision(),
        plan,
        subscription: { id: "sub-" + product, planId: plan.id, status: "ACTIVE", start: now, end },
        modules: Object.fromEntries([...catalog.modules].map((k) => [k, { enabled: true, override: null }])),
        admins: [{ id: "owner-" + product, name: "Propietario QA", email: "owner@example.invalid", username: "fixture-owner", role: "OWNER", active: true }],
        usage: { clientes: 3 },
        payments: [],
      },
    ];
  }

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const ok = (data) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data }) });
    if (path === "/api/alerts") return ok({ alerts: [] });
    if (path === "/api/auth/account") return ok({ username: "ci_smoke", role: "owner", mfaReady: true });
    if (path === "/api/governance") {
      return ok({
        managementProducts: ["onlygym", "onlyturn", "onlyfood", "onlycars", "onlyerp", "onlyshop"],
        tenants: Object.entries(tenants).flatMap(([saas, ts]) =>
          ts.map((t) => ({
            ...t,
            saas,
            saasName: saas,
            rawStatus: t.status,
            plan: t.plan?.name || "Pro",
            planExpiresAt: t.subscription?.end || end,
            createdAt: now,
            domain: "",
            metrics: { totalRecords: 3, recordLabel: "registros", available: true },
          }))
        ),
        sources: ["onlygym", "onlyturn", "onlyfood", "onlycars", "onlyerp", "onlyshop"].map((saas) => ({
          saas,
          status: "available",
          count: tenants[saas].length,
        })),
      });
    }
    if (!path.startsWith("/api/saas-management/")) return ok([]);
    const product = path.split("/").at(-1);
    if (request.method() === "GET") {
      const resource = url.searchParams.get("resource");
      if (resource === "catalog") return ok({ ...catalogs[product], operations, currency: catalogs[product].currency || "ARS", destructiveDelete: false });
      if (resource === "plans") return ok({ items: plans[product], nextOffset: null });
      if (resource === "tenant") return ok(tenants[product].find((t) => t.id === url.searchParams.get("tenantId")));
      if (resource === "audit") return ok({ items: [{ id: "event-1", tenantId: tenants[product][0].id, actor: "ci_smoke", action: "hub.management", entity: "tenant.update", entityId: tenants[product][0].id, result: "success", createdAt: now }], nextOffset: null });
      throw Error("Unexpected resource");
    }
    const c = request.postDataJSON();
    const i = c.input;
    commands.push(c);
    const t = tenants[product].find((item) => item.id === i.tenantId);
    if (c.operation === "subscription.renew") {
      t.subscription.end = new Date(Date.parse(t.subscription.end) + i.days * 86400000).toISOString();
      t.status = "ACTIVE";
    }
    if (c.operation === "module.set") {
      t.modules[i.key] = { enabled: i.enabled ?? true, override: i.enabled };
    }
    if (t) t.version = revision();
    return ok({ entityId: t?.id || "plan", tenantId: t?.id || null, version: t?.version || null });
  });

  await page.goto(`${origin}/clientes?saas=onlyshop&tenantId=tenant-onlyshop`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Membresías y Clientes" }).waitFor();
  const drawer = page.getByRole("dialog", { name: /Empresa QA onlyshop/i });
  await drawer.waitFor({ timeout: 10000 });
  await drawer.getByRole("button", { name: "+30 días" }).click();
  await drawer.getByRole("tab", { name: /Módulos/i }).click();
  await drawer.getByRole("combobox").first().selectOption("off");
  await drawer.getByRole("button", { name: /Guardar cambios \(1\)/ }).click();
  await page.screenshot({ path: `${out}/${device.name}-drawer.png`, fullPage: true });
  assertions += 3;

  assert.equal(errors.length, 0, errors.join("\n"));
  assert.ok(commands.some((c) => c.operation === "subscription.renew"));
  assert.ok(commands.some((c) => c.operation === "module.set"));
  await context.close();
}

await browser.close();
console.log(JSON.stringify({ assertions, result: "MANAGEMENT_UI_SMOKE_PASS", screenshotDirectory: out }));
