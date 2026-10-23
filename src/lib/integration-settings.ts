import type { SaaSSlug } from "./types";

// The global switch is a kill switch. Each product also needs explicit opt-in.
export function isSaaSIntegrationEnabled(saas: SaaSSlug): boolean {
  return process.env.HUB_SAAS_INTEGRATION_ENABLED === "true" &&
    (process.env.HUB_SAAS_INTEGRATION_PRODUCTS || "")
      .split(",").map(value => value.trim()).includes(saas);
}
