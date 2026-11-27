import type { IndependentContract, IndependentPayment } from "./types";

export type IndependentDetail = {
  contract: IndependentContract;
  payments: IndependentPayment[];
  audit: Array<{
    id: string;
    slug: string;
    actor: string;
    action: string;
    details: string;
    created_at: string;
  }>;
};

const billingEngine = require("../../scripts/independent-billing.cjs") as {
  listContracts(dataDir?: string): IndependentContract[];
  getContractDetail(slug: string, dataDir?: string): IndependentDetail;
  updateContract(requestId: string, input: Record<string, unknown>, actor: string, dataDir?: string): { slug: string; status: string };
  renewContract(requestId: string, input: Record<string, unknown>, actor: string, dataDir?: string): { slug: string; periodEnd: string };
  recordPayment(requestId: string, input: Record<string, unknown>, actor: string, dataDir?: string): { paymentId: string; slug: string; status: string };
  updatePaymentStatus(requestId: string, input: Record<string, unknown>, actor: string, dataDir?: string): { paymentId: string; status: string };
};

export const independentBilling = billingEngine;
