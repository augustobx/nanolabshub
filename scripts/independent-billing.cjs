"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const VALID_STATUSES = new Set(["ACTIVE", "TRIAL", "PAST_DUE", "SUSPENDED", "CANCELED"]);
const VALID_PAYMENT_STATUSES = new Set(["PENDING", "PAID", "OVERDUE", "REFUNDED", "VOID"]);
const VALID_CYCLES = new Set(["MONTHLY", "QUARTERLY", "ANNUAL", "CUSTOM"]);

const DEFAULT_APPS = [
  {
    slug: "acevedocontrol",
    appName: "Acevedo Control",
    clientName: "Acevedo Control",
    domain: "acevedocontrol.nanoapps.ar",
    planName: "Plan Dedicado Mensual",
    billingCycle: "MONTHLY",
    priceCents: 0,
    currency: "ARS",
  },
  {
    slug: "liga-padel",
    appName: "Liga Pádel",
    clientName: "Liga Pádel ASP",
    domain: "asp.nanoapps.ar",
    planName: "Plan Liga Mensual",
    billingCycle: "MONTHLY",
    priceCents: 0,
    currency: "ARS",
  },
];

const MANAGED_INDEPENDENT_SLUGS = new Set(DEFAULT_APPS.map((a) => a.slug));

function dbPath(dataDir = process.env.DATA_DIR || "/app/data") {
  fs.mkdirSync(dataDir, { recursive: true });
  return path.join(dataDir, "hub.sqlite");
}

function openDb(dataDir) {
  const db = new DatabaseSync(dbPath(dataDir));
  db.exec(`
    PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS independent_contracts(
      slug TEXT PRIMARY KEY,
      app_name TEXT NOT NULL,
      client_name TEXT NOT NULL,
      contact_email TEXT NOT NULL DEFAULT '',
      contact_phone TEXT NOT NULL DEFAULT '',
      domain TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      plan_name TEXT NOT NULL DEFAULT 'Plan Mensual',
      billing_cycle TEXT NOT NULL DEFAULT 'MONTHLY',
      price_cents INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'ARS',
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      trial_ends_at TEXT,
      notes TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL,
      updated_by TEXT NOT NULL DEFAULT 'system'
    );
    CREATE TABLE IF NOT EXISTS independent_payments(
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL REFERENCES independent_contracts(slug) ON DELETE CASCADE,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'ARS',
      status TEXT NOT NULL DEFAULT 'PAID',
      method TEXT NOT NULL DEFAULT 'Transferencia',
      reference TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      due_at TEXT,
      paid_at TEXT,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL DEFAULT 'system'
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_independent_payments_ref ON independent_payments(slug, reference);
    CREATE TABLE IF NOT EXISTS independent_audit(
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS independent_commands(
      request_id TEXT PRIMARY KEY,
      fingerprint TEXT NOT NULL,
      result TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  const now = new Date();
  const startIso = now.toISOString();
  const endIso = new Date(now.getTime() + 30 * 86400000).toISOString();
  const seedStmt = db.prepare(`
    INSERT OR IGNORE INTO independent_contracts(
      slug, app_name, client_name, contact_email, contact_phone, domain,
      status, plan_name, billing_cycle, price_cents, currency,
      period_start, period_end, trial_ends_at, notes, updated_at, updated_by
    ) VALUES(?, ?, ?, '', '', ?, 'ACTIVE', ?, ?, ?, ?, ?, ?, NULL, '', ?, 'system')
  `);
  for (const app of DEFAULT_APPS) {
    seedStmt.run(
      app.slug,
      app.appName,
      app.clientName,
      app.domain,
      app.planName,
      app.billingCycle,
      app.priceCents,
      app.currency,
      startIso,
      endIso,
      startIso
    );
  }
  return db;
}

function mapContract(row, counts = {}) {
  return {
    slug: row.slug,
    appName: row.app_name,
    clientName: row.client_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    domain: row.domain,
    status: row.status,
    planName: row.plan_name,
    billingCycle: row.billing_cycle,
    priceCents: row.price_cents,
    currency: row.currency,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    trialEndsAt: row.trial_ends_at || null,
    notes: row.notes || "",
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
    paymentsCount: counts.paymentsCount ?? 0,
    overdueCount: counts.overdueCount ?? 0,
  };
}

function mapPayment(row) {
  return {
    id: row.id,
    slug: row.slug,
    amountCents: row.amount_cents,
    currency: row.currency,
    status: row.status,
    method: row.method,
    reference: row.reference,
    notes: row.notes || "",
    periodStart: row.period_start,
    periodEnd: row.period_end,
    dueAt: row.due_at || null,
    paidAt: row.paid_at || null,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

function assertValidSlug(slug) {
  if (typeof slug !== "string" || !MANAGED_INDEPENDENT_SLUGS.has(slug)) {
    throw Error("Aplicación independiente no habilitada para cobro.");
  }
}

function assertIsoDate(value, fieldName) {
  const ts = Date.parse(String(value || ""));
  if (!Number.isFinite(ts)) throw Error(`Fecha inválida en ${fieldName}.`);
  return new Date(ts).toISOString();
}

function hashPayload(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function runIdempotent(db, requestId, operation, input, handler) {
  if (typeof requestId !== "string" || !/^[a-f0-9-]{36}$/i.test(requestId)) {
    throw Error("Identificador de solicitud inválido.");
  }
  const fp = hashPayload({ operation, input });
  const prior = db.prepare("SELECT fingerprint, result FROM independent_commands WHERE request_id=?").get(requestId);
  if (prior) {
    if (prior.fingerprint !== fp) throw Error("El identificador ya fue usado en otra operación.");
    return JSON.parse(prior.result);
  }
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = handler();
    db.prepare("INSERT INTO independent_commands(request_id, fingerprint, result, created_at) VALUES(?,?,?,?)")
      .run(requestId, fp, JSON.stringify(result), new Date().toISOString());
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

function listContracts(dataDir) {
  const db = openDb(dataDir);
  try {
    const rows = db.prepare("SELECT * FROM independent_contracts ORDER BY app_name ASC").all();
    const countRows = db.prepare(
      "SELECT slug, COUNT(*) AS total, SUM(CASE WHEN status='OVERDUE' THEN 1 ELSE 0 END) AS overdue FROM independent_payments GROUP BY slug"
    ).all();
    const countMap = Object.fromEntries(countRows.map((r) => [r.slug, { paymentsCount: r.total, overdueCount: r.overdue || 0 }]));
    return rows.map((row) => mapContract(row, countMap[row.slug]));
  } finally {
    db.close();
  }
}

function getContractDetail(slug, dataDir) {
  assertValidSlug(slug);
  const db = openDb(dataDir);
  try {
    const row = db.prepare("SELECT * FROM independent_contracts WHERE slug=?").get(slug);
    if (!row) throw Error("Contrato no encontrado.");
    const payments = db
      .prepare("SELECT * FROM independent_payments WHERE slug=? ORDER BY created_at DESC LIMIT 100")
      .all(slug)
      .map(mapPayment);
    const audit = db
      .prepare("SELECT * FROM independent_audit WHERE slug=? ORDER BY created_at DESC LIMIT 50")
      .all(slug);
    return {
      contract: mapContract(row, {
        paymentsCount: payments.length,
        overdueCount: payments.filter((p) => p.status === "OVERDUE").length,
      }),
      payments,
      audit,
    };
  } finally {
    db.close();
  }
}

function updateContract(requestId, input, actor, dataDir) {
  assertValidSlug(input?.slug);
  const db = openDb(dataDir);
  try {
    return runIdempotent(db, requestId, "contract.update", input, () => {
      const existing = db.prepare("SELECT * FROM independent_contracts WHERE slug=?").get(input.slug);
      if (!existing) throw Error("Contrato no encontrado.");
      const status = String(input.status || existing.status);
      if (!VALID_STATUSES.has(status)) throw Error("Estado inválido.");
      const billingCycle = String(input.billingCycle || existing.billing_cycle);
      if (!VALID_CYCLES.has(billingCycle)) throw Error("Ciclo de facturación inválido.");
      const periodStart = assertIsoDate(input.periodStart ?? existing.period_start, "inicio");
      const periodEnd = assertIsoDate(input.periodEnd ?? existing.period_end, "vencimiento");
      if (Date.parse(periodEnd) <= Date.parse(periodStart)) throw Error("El vencimiento debe ser posterior al inicio.");
      const trialEndsAt = input.trialEndsAt ? assertIsoDate(input.trialEndsAt, "prueba") : null;
      const priceCents = Number(input.priceCents ?? existing.price_cents);
      if (!Number.isInteger(priceCents) || priceCents < 0) throw Error("Importe inválido.");
      const currency = String(input.currency || existing.currency || "ARS").trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(currency)) throw Error("Moneda inválida.");
      const nowIso = new Date().toISOString();

      db.prepare(`
        UPDATE independent_contracts
        SET client_name=?, contact_email=?, contact_phone=?, status=?, plan_name=?, billing_cycle=?,
            price_cents=?, currency=?, period_start=?, period_end=?, trial_ends_at=?, notes=?,
            updated_at=?, updated_by=?
        WHERE slug=?
      `).run(
        String(input.clientName ?? existing.client_name).trim().slice(0, 140) || existing.client_name,
        String(input.contactEmail ?? existing.contact_email).trim().slice(0, 140),
        String(input.contactPhone ?? existing.contact_phone).trim().slice(0, 60),
        status,
        String(input.planName ?? existing.plan_name).trim().slice(0, 100) || existing.plan_name,
        billingCycle,
        priceCents,
        currency,
        periodStart,
        periodEnd,
        trialEndsAt,
        String(input.notes ?? existing.notes).trim().slice(0, 1000),
        nowIso,
        actor,
        input.slug
      );

      db.prepare("INSERT INTO independent_audit(id, slug, actor, action, details, created_at) VALUES(?,?,?,?,?,?)")
        .run(crypto.randomUUID(), input.slug, actor, "contract.update", JSON.stringify({ status, periodEnd, priceCents, currency }), nowIso);
      return { slug: input.slug, status };
    });
  } finally {
    db.close();
  }
}

function renewContract(requestId, input, actor, dataDir) {
  assertValidSlug(input?.slug);
  const days = Number(input?.days ?? 30);
  if (!Number.isInteger(days) || days < 1 || days > 3650) throw Error("Cantidad de días inválida.");
  const db = openDb(dataDir);
  try {
    return runIdempotent(db, requestId, "contract.renew", { slug: input.slug, days }, () => {
      const existing = db.prepare("SELECT * FROM independent_contracts WHERE slug=?").get(input.slug);
      if (!existing) throw Error("Contrato no encontrado.");
      const now = Date.now();
      const currentEnd = Date.parse(existing.period_end) || now;
      const newEnd = new Date(Math.max(now, currentEnd) + days * 86400000).toISOString();
      const newStart = Date.parse(existing.period_start) > now ? new Date(now).toISOString() : existing.period_start;
      const nowIso = new Date(now).toISOString();
      db.prepare("UPDATE independent_contracts SET status='ACTIVE', period_start=?, period_end=?, trial_ends_at=NULL, updated_at=?, updated_by=? WHERE slug=?")
        .run(newStart, newEnd, nowIso, actor, input.slug);
      db.prepare("INSERT INTO independent_audit(id, slug, actor, action, details, created_at) VALUES(?,?,?,?,?,?)")
        .run(crypto.randomUUID(), input.slug, actor, "contract.renew", JSON.stringify({ days, newEnd }), nowIso);
      return { slug: input.slug, periodEnd: newEnd };
    });
  } finally {
    db.close();
  }
}

function recordPayment(requestId, input, actor, dataDir) {
  assertValidSlug(input?.slug);
  const db = openDb(dataDir);
  try {
    return runIdempotent(db, requestId, "payment.record", input, () => {
      const existing = db.prepare("SELECT * FROM independent_contracts WHERE slug=?").get(input.slug);
      if (!existing) throw Error("Contrato no encontrado.");
      const amountCents = Number(input.amountCents);
      if (!Number.isInteger(amountCents) || amountCents <= 0) throw Error("El importe debe ser mayor a cero.");
      const currency = String(input.currency || existing.currency || "ARS").trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(currency)) throw Error("Moneda inválida.");
      const status = String(input.status || "PAID");
      if (!VALID_PAYMENT_STATUSES.has(status)) throw Error("Estado de pago inválido.");
      const method = String(input.method || "").trim().slice(0, 60);
      const reference = String(input.reference || "").trim().slice(0, 120);
      if (method.length < 2 || reference.length < 2) throw Error("Completá método y referencia única.");
      const start = assertIsoDate(input.start, "inicio");
      const end = assertIsoDate(input.end, "vencimiento");
      if (Date.parse(end) <= Date.parse(start)) throw Error("El fin del período debe ser posterior al inicio.");
      const dueAt = input.dueAt ? assertIsoDate(input.dueAt, "vencimiento de pago") : null;
      const nowIso = new Date().toISOString();
      const paidAt = input.paidAt ? assertIsoDate(input.paidAt, "cobro") : status === "PAID" ? nowIso : null;
      const paymentId = crypto.randomUUID();

      db.prepare(`
        INSERT INTO independent_payments(
          id, slug, amount_cents, currency, status, method, reference, notes,
          period_start, period_end, due_at, paid_at, created_at, created_by
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        paymentId,
        input.slug,
        amountCents,
        currency,
        status,
        method,
        reference,
        String(input.notes || "").trim().slice(0, 1000),
        start,
        end,
        dueAt,
        paidAt,
        nowIso,
        actor
      );

      if (status === "PAID" && Date.parse(end) > Date.now()) {
        db.prepare("UPDATE independent_contracts SET status='ACTIVE', period_start=?, period_end=?, trial_ends_at=NULL, updated_at=?, updated_by=? WHERE slug=?")
          .run(start, end, nowIso, actor, input.slug);
      } else if (status === "OVERDUE") {
        db.prepare("UPDATE independent_contracts SET status='PAST_DUE', updated_at=?, updated_by=? WHERE slug=?")
          .run(nowIso, actor, input.slug);
      }

      db.prepare("INSERT INTO independent_audit(id, slug, actor, action, details, created_at) VALUES(?,?,?,?,?,?)")
        .run(crypto.randomUUID(), input.slug, actor, "payment.record", JSON.stringify({ paymentId, amountCents, currency, status, reference }), nowIso);
      return { paymentId, slug: input.slug, status };
    });
  } finally {
    db.close();
  }
}

function updatePaymentStatus(requestId, input, actor, dataDir) {
  assertValidSlug(input?.slug);
  const db = openDb(dataDir);
  try {
    return runIdempotent(db, requestId, "payment.status", input, () => {
      const payment = db.prepare("SELECT * FROM independent_payments WHERE id=? AND slug=?").get(input.paymentId, input.slug);
      if (!payment) throw Error("Pago no encontrado.");
      const status = String(input.status || "");
      if (!VALID_PAYMENT_STATUSES.has(status)) throw Error("Estado de pago inválido.");
      const nowIso = new Date().toISOString();
      const paidAt = status === "PAID" ? (input.paidAt ? assertIsoDate(input.paidAt, "cobro") : payment.paid_at || nowIso) : null;

      db.prepare("UPDATE independent_payments SET status=?, paid_at=? WHERE id=?").run(status, paidAt, payment.id);
      if (status === "PAID" && Date.parse(payment.period_end) > Date.now()) {
        db.prepare("UPDATE independent_contracts SET status='ACTIVE', period_start=?, period_end=?, updated_at=?, updated_by=? WHERE slug=?")
          .run(payment.period_start, payment.period_end, nowIso, actor, input.slug);
      } else if (status === "OVERDUE") {
        db.prepare("UPDATE independent_contracts SET status='PAST_DUE', updated_at=?, updated_by=? WHERE slug=?")
          .run(nowIso, actor, input.slug);
      }

      db.prepare("INSERT INTO independent_audit(id, slug, actor, action, details, created_at) VALUES(?,?,?,?,?,?)")
        .run(crypto.randomUUID(), input.slug, actor, "payment.status", JSON.stringify({ paymentId: payment.id, status }), nowIso);
      return { paymentId: payment.id, status };
    });
  } finally {
    db.close();
  }
}

module.exports = {
  MANAGED_INDEPENDENT_SLUGS,
  listContracts,
  getContractDetail,
  updateContract,
  renewContract,
  recordPayment,
  updatePaymentStatus,
};
