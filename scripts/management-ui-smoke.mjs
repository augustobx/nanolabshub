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
const now = "2026-10-23T00:00:00.000Z", end = "2027-10-23T00:00:00.000Z";
for (const device of [{ name: "desktop", viewport: { width: 1440, height: 1000 } }, { name: "mobile", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]) {
  const context = await browser.newContext(device);
  await signInFixture(context,origin);
  const page = await context.newPage(), errors = [], commands = [], receipts = new Map();
  const capture = async name => {
    await page.waitForFunction(() => !document.querySelector("fieldset")?.disabled);
    await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; window.scrollTo(0, 0); });
    await page.waitForFunction(() => scrollY === 0);
    await page.screenshot({ path: `${out}/${device.name}-${name}.png`, fullPage: true, animations: "disabled" });
  };
  let uncertainPayment = true, rejectedStale = false, uncertainId;
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", dialog => dialog.accept());
  const catalogs = { onlyshop:{modules:["pwaEnabled","accountsEnabled"],limits:["maxProducts"],optionalLimits:[],currency:"ARS",immutableSlug:true,statuses:["ACTIVE","TRIAL","PAST_DUE","SUSPENDED","CANCELED"]}, onlyerp:{modules:["VENTAS","AFIP"],limits:["maxUsers","maxLocations","maxWarehouses"],optionalLimits:[],currency:"ARS",paymentCalendar:true,adminIdentity:"username",ownerIdentity:"username",immutableSlug:true,statuses:["ACTIVE","TRIAL","SUSPENDED","CANCELED"]}, onlycars: {modules:["pwa_clientes","seller_pwa","branding_documentos"],limits:["maxVehicles","maxLocations","maxUsers"],optionalLimits:[],currency:"USD",paymentPeriods:true,immutableSlug:true,tenantFields:["email","phone","address","city","cuit"],domainManagement:true,trialDates:true,statuses:["ACTIVE","TRIAL","PAST_DUE","SUSPENDED","CANCELED"]}, onlyfood: {modules:["orders","loyalty"],limits:["maxLocations","maxProducts"],optionalLimits:[],paymentLifecycle:true,trialDates:true,statuses:["ACTIVE","TRIAL","PAST_DUE","SUSPENDED","CANCELED"]}, onlygym: { modules: ["socios", "reportes"], limits: ["maxUsers", "maxBranches", "maxMembers"], optionalLimits: ["maxMembers"] }, onlyturn: { modules: ["whatsappNotifications", "advancedReports"], limits: ["maxLocations", "maxStaff", "maxResources", "maxBookings"], optionalLimits: [] } };
  const operations = ["tenant.create", "tenant.update", "tenant.status", "subscription.update", "subscription.renew", "module.set", "admin.update", "admin.revoke", "plan.create", "plan.update", "payment.record", "payment.status", "domain.add"];
  const plans = {}, tenants = {};
  let sequence = 1;
  const revision = () => new Date(Date.parse(now) + sequence++).toISOString();
  for (const product of ["onlygym", "onlyturn", "onlyfood", "onlycars", "onlyerp", "onlyshop"]) {
    const catalog = catalogs[product], plan = { id: "plan-" + product, code: "PRO", name: "Profesional", description: "Fixture", priceCents: 10000, currency: catalog.currency || "ARS", active: true, modules: Object.fromEntries(catalog.modules.map(k => [k, true])), limits: Object.fromEntries(catalog.limits.map(k => [k, 100])), version: revision() };
    plans[product] = [plan]; tenants[product] = [{ id: "tenant-" + product, name: "Empresa QA " + product, slug: "qa-" + product, status: "ACTIVE", version: revision(), plan,
      subscription: { id: "sub-" + product, planId: plan.id, status: "ACTIVE", start: now, end, ...(product === "onlyfood" ? {trialEndsAt:"2025-01-01T00:00:00.000Z"} : {}) }, ...(product === "onlyfood" ? {access:{enabled:false,reason:"Prueba vencida"}} : {}), modules: Object.fromEntries([...catalog.modules, ...(product === "onlyturn" ? catalog.limits : [])].map(k => [k, { enabled: catalog.modules.includes(k) ? true : 100, override: null }])),
      admins: [{ id: "owner-" + product, name: "Propietario QA", email: "owner@example.invalid", username:"fixture-owner", role: "OWNER", active: true }], usage: product === "onlyfood" ? {clients:3,orders:2,products:4,locations:1} : { clientes: 3, reservas: 2 }, payments: [] }];
  }
  await page.route("**/api/**", async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    const ok = data => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data }) });
    if (path === "/api/alerts") return ok({ alerts: [] });
    if (path === "/api/governance") return ok({ managementProducts: ["onlygym", "onlyturn", "onlyfood", "onlycars", "onlyerp", "onlyshop"], tenants: Object.entries(tenants).flatMap(([saas, ts]) => ts.map(t => ({ ...t, saas, saasName: saas, rawStatus: t.status, createdAt: now, domain: "", metrics: { totalRecords: 3, recordLabel: "registros", available: true } }))), sources: ["onlygym", "onlyturn", "onlyfood", "onlycars", "onlyerp", "onlyshop"].map(saas => ({ saas, status: "available", count: tenants[saas].length })) });
    if (!path.startsWith("/api/saas-management/")) return ok([]);
    const product = path.split("/").at(-1); assert.ok(["onlygym", "onlyturn", "onlyfood", "onlycars", "onlyerp", "onlyshop"].includes(product));
    if (request.method() === "GET") {
      const resource = url.searchParams.get("resource");
      if (resource === "catalog") return ok({ ...catalogs[product], operations: ["onlyerp","onlyshop"].includes(product) ? operations.filter(o=>!["payment.status","domain.add"].includes(o)) : product === "onlycars" ? operations.filter(o=>o!=="payment.status") : operations, currency: catalogs[product].currency || "ARS", destructiveDelete: false });
      if (resource === "plans") return ok({ items: plans[product], nextOffset: null });
      if (resource === "tenant") return ok(tenants[product].find(t => t.id === url.searchParams.get("tenantId")));
      if (resource === "audit") return ok({ items: [{ id: "event-1", tenantId: tenants[product][0].id, actor: "ci_smoke", action: "hub.management", entity: "tenant.update", entityId: tenants[product][0].id, result: "success", createdAt: now }], nextOffset: null });
      throw Error("Unexpected resource");
    }
    const c = request.postDataJSON(), i = c.input; commands.push(c);
    assert.ok(c.requestId && operations.includes(c.operation)); assert.equal(c.actor, undefined);
    if (receipts.has(c.requestId)) { assert.equal(c.requestId, uncertainId); return ok(receipts.get(c.requestId)); }
    let t = tenants[product].find(t => t.id === i.tenantId), entityId = t?.id || "new-plan";
    if (c.operation === "tenant.update" && !rejectedStale) {
      rejectedStale = true; t.version = revision();
      return route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ success: false, code: "STALE_VERSION", error: "Los datos cambiaron. Actualizá la ficha antes de guardar." }) });
    }
    if (t) assert.equal(i.version, t.version);
    if (c.operation === "tenant.update") { if(product==="onlycars"){assert.equal(i.slug,t.slug);t.contact=Object.fromEntries(catalogs.onlycars.tenantFields.map(k=>[k,i[k]]));} t.name = i.name; t.slug = i.slug; }
    if(c.operation === "domain.add"){assert.equal(product,"onlycars");assert.equal(i.confirmOwnership,true);t.domains=[...(t.domains||[]),{hostname:i.hostname,primary:i.primary,custom:i.custom,verified:true}];}
    if (c.operation === "tenant.status") t.status = i.status;
    if (c.operation === "subscription.update") { assert.ok(new Date(i.end) > new Date(i.start)); t.subscription = { ...t.subscription, start: i.start, end: i.end, planId: i.planId }; t.status = i.status; }
    if (c.operation === "subscription.renew") { assert.equal(typeof i.days, "number"); t.subscription.end = new Date(Date.parse(t.subscription.end) + i.days * 86400000).toISOString(); t.status = "ACTIVE"; if(product==="onlyfood")t.access={enabled:true,reason:null}; }
    if (c.operation === "module.set") { assert.ok(typeof i.enabled === "boolean" || i.enabled === null); t.modules[i.key] = { enabled: i.enabled ?? t.plan.modules[i.key] ?? i.limit, override: i.enabled ?? i.limit }; }
    if (c.operation === "admin.update") { t.admins[0] = { ...t.admins[0], name: i.name, email: i.email, username:i.username }; assert.equal(i.password, "Fixture-new-password-2026"); }
    if (c.operation === "payment.record") { assert.equal(i.amountCents, 12345); if(product==="onlycars"){assert.equal(i.currency,"USD");assert.ok(i.start&&i.end);assert.equal(i.days,undefined);}else if(product==="onlyerp"){assert.equal(i.currency,"ARS");assert.equal(i.applySubscription,false);assert.ok(i.month&&i.year&&i.dueAt);assert.equal(i.days,undefined);}else if(product!=="onlyfood")assert.equal(i.days, 0);else{assert.equal(i.status,"PENDING");assert.ok(i.start&&i.end);assert.equal(i.currency,"ARS");} t.payments.push({ id: c.requestId, amountCents: i.amountCents, method: i.method, reference: i.reference, status: i.status || "registered", currency:i.currency, month:i.month, year:i.year, dueAt:i.dueAt, start:i.start, end:i.end, createdAt: now }); }
    if (c.operation === "payment.status") {const p=t.payments.find(p=>p.id===i.paymentId);p.status=i.status; t.status=i.status==="OVERDUE"?"PAST_DUE":i.status==="PAID"?"ACTIVE":t.status;}
    if (c.operation === "plan.update") { const p = plans[product].find(p => p.id === i.planId); assert.equal(i.version, p.version); Object.assign(p, i, { version: revision() }); }
    if (c.operation === "plan.create") { entityId = "plan-new-" + product; plans[product].push({ ...i, id: entityId, version: revision() }); }
    if (c.operation === "tenant.create") { entityId = "new-" + product; t = { ...structuredClone(tenants[product][0]), id: entityId, name: i.name, slug: i.slug, status: i.status }; tenants[product].push(t); }
    if (t) t.version = revision();
    const result = { entityId, tenantId: t?.id || null, version: t?.version || null }; receipts.set(c.requestId, result);
    if (c.operation === "payment.record" && uncertainPayment) {
      uncertainPayment = false; uncertainId = c.requestId;
      return route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ success: false, error: "No se confirmó la respuesta de la plataforma." }) });
    }
    return ok(result);
  });
  for (const product of ["onlygym", "onlyturn", "onlyfood", "onlycars", "onlyerp", "onlyshop"]) {
    await page.goto(origin + "/saas/" + product + "/manage?tenantId=tenant-" + product);
    await page.getByRole("heading", { name: "Administración de " + ({onlygym:"OnlyGym",onlyturn:"OnlyTurn",onlyfood:"OnlyFood",onlycars:"OnlyCars",onlyerp:"OnlyERP",onlyshop:"OnlyShop"}[product]) }).waitFor();
    await page.getByRole("textbox", { name: "Nombre", exact: true }).fill("Empresa editada QA");
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
    if (product === "onlygym") { await page.getByRole("alert").filter({ hasText: "Los datos cambiaron" }).waitFor(); await page.getByRole("textbox", { name: "Nombre", exact: true }).fill("Empresa editada QA"); await page.getByRole("button", { name: "Guardar cambios", exact: true }).click(); }
    await page.getByRole("status").filter({ hasText: "Cambio confirmado" }).waitFor();
        if(product === "onlycars"){
      assert.equal(await page.getByRole("textbox",{name:"Identificador / subdominio"}).getAttribute("readonly"),"");
      await page.getByRole("textbox",{name:"Nombre de dominio",exact:true}).fill("qa.example.invalid");
      await page.getByLabel("Confirmo que verifiqué").check();await page.getByRole("button",{name:"Agregar dominio",exact:true}).click();
      await page.getByRole("status").filter({hasText:"Cambio confirmado"}).waitFor();assert.equal(tenants.onlycars[0].domains[0].hostname,"qa.example.invalid");
    }
    await capture(product + "-identity");
    await page.getByRole("button", { name: "Módulos y límites", exact: true }).click();
    const moduleForm = page.locator("form").first(); await moduleForm.getByRole("combobox").selectOption("off"); await moduleForm.getByRole("button", { name: "Aplicar excepción" }).click();
    await page.getByText("Valor efectivo: Deshabilitado", { exact: true }).first().waitFor();
    await capture(product + "-modules");
    await page.getByRole("button", { name: "Suscripción", exact: true }).click();
    await page.getByRole("spinbutton", { name: "Días de extensión", exact: true }).fill("30"); await page.getByRole("button", { name: "Renovar y activar" }).click(); await page.getByRole("status").filter({ hasText: "Cambio confirmado" }).waitFor();
    await page.getByRole("button", { name: "Accesos", exact: true }).click();
    await page.getByRole("textbox", { name: product === "onlyerp" ? "Usuario de acceso" : "Correo", exact: true }).fill(product === "onlyerp" ? "changed-owner" : "changed@example.invalid");
    await page.getByLabel("Nueva contraseña", { exact: false }).fill("Fixture-new-password-2026"); await page.getByRole("button", { name: "Actualizar acceso" }).click(); await page.getByRole("status").filter({ hasText: "Cambio confirmado" }).waitFor();
    assert.equal(await page.getByLabel("Nueva contraseña", { exact: false }).inputValue(), "");
    await page.getByRole("button", { name: "Pagos SaaS", exact: true }).click();
    await page.getByRole("spinbutton", { name: product === "onlycars" ? "Importe recibido" : product === "onlyfood" ? "Importe" : "Importe en pesos argentinos", exact:true }).fill("123.45"); await page.getByRole("textbox", { name: "Método de pago" }).fill("Transferencia"); await page.getByRole("textbox", { name: "Referencia única" }).fill("UI-REF-" + product + device.name); if(product==="onlyerp")await page.getByLabel("Vencimiento del período",{exact:true}).fill("2027-01-10T12:00"); await page.getByRole("button", { name: "Registrar pago SaaS" }).click();
    if (product === "onlygym") { await page.getByRole("button", { name: "Reintentar la misma solicitud" }).waitFor(); await page.getByRole("button", { name: "Reintentar la misma solicitud" }).click(); }
    await page.getByRole("status").filter({ hasText: "Cambio confirmado" }).waitFor(); assert.equal(tenants[product][0].payments.length, 1);
    if(product==="onlyfood"){const updateForm=page.locator("form").filter({has:page.getByRole("button",{name:"Actualizar estado del pago"})});await updateForm.getByRole("combobox",{name:"Estado del pago"}).selectOption("PAID");await updateForm.getByRole("button",{name:"Actualizar estado del pago"}).click();await page.getByRole("status").filter({hasText:"Cambio confirmado"}).waitFor();assert.equal(tenants.onlyfood[0].payments[0].status,"PAID");}
    await capture(product + "-payments");
    await page.getByRole("button", { name: "Planes", exact: true }).click();
    await page.getByRole("combobox", { name: "Plan a administrar" }).selectOption("plan-" + product);
    if(product==="onlycars")await page.getByRole("spinbutton",{name:"Precio mensual en USD"}).waitFor();
    await page.getByRole("textbox", { name: "Nombre", exact: true }).fill("Plan actualizado QA"); await page.getByRole("button", { name: "Actualizar plan", exact: true }).click(); await page.getByRole("status").filter({ hasText: "Cambio confirmado" }).waitFor();
    await capture(product + "-plans");
    await page.getByRole("button", { name: "Auditoría", exact: true }).click(); await page.getByText("hub.management", { exact: true }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); assertions += 8;
  }
  assert.equal(errors.length, 0, errors.join("\n"));
  assert.ok(commands.every(c => !JSON.stringify(c).includes("HUB_MANAGEMENT_TOKEN")));
  console.log(JSON.stringify({ device: device.name, commands: commands.length, result: "MANAGEMENT_UI_SMOKE_PASS" }));
  await context.close();
}
await browser.close();
console.log(JSON.stringify({ assertions, screenshotDirectory: out }));

