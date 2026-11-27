"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");

const billing = require("./independent-billing.cjs");

test("independent billing seeds 2 billed apps (excluding nanolabs web) and supports full payment lifecycle", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hub-ind-billing-"));
  try {
    const list = billing.listContracts(dir);
    assert.deepEqual(
      list.map((c) => c.slug).sort(),
      ["acevedocontrol", "liga-padel"]
    );
    assert.equal(list.some((c) => c.slug === "nanolabs"), false);

    // Record OVERDUE payment -> contract moves to PAST_DUE
    const p1 = billing.recordPayment(
      crypto.randomUUID(),
      {
        slug: "acevedocontrol",
        amountCents: 1500000,
        currency: "ARS",
        status: "OVERDUE",
        method: "Transferencia",
        reference: "FAC-001",
        start: "2026-11-01T00:00:00.000Z",
        end: "2026-12-31T23:59:59.000Z",
      },
      "owner",
      dir
    );
    assert.equal(billing.getContractDetail("acevedocontrol", dir).contract.status, "PAST_DUE");

    // Transition payment to PAID -> contract reactivates cleanly
    billing.updatePaymentStatus(
      crypto.randomUUID(),
      { slug: "acevedocontrol", paymentId: p1.paymentId, status: "PAID" },
      "owner",
      dir
    );
    const detail = billing.getContractDetail("acevedocontrol", dir);
    assert.equal(detail.contract.status, "ACTIVE");
    assert.equal(detail.payments[0].status, "PAID");
    assert.ok(detail.audit.length >= 2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
