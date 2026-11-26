"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { MembershipsWorkspace, type MembershipQuickFilter } from "@/components/MembershipsWorkspace";
import { Cargando } from "@/components/nanolabs";

function ClientesContent() {
  const search = useSearchParams();
  const saas = search.get("saas") || "all";
  const tabParam = search.get("tab") || search.get("section");
  const tab = tabParam === "planes" || tabParam === "plans" ? "planes" : tabParam === "conectores" ? "conectores" : "membresias";
  const venc = search.get("vencimiento");
  const filter: MembershipQuickFilter =
    venc === "atencion" || venc === "attention"
      ? "attention"
      : venc === "expired" || venc === "expiring" || venc === "active" || venc === "paused"
      ? venc
      : "all";
  const tenantId = search.get("tenantId") || "";

  return (
    <MembershipsWorkspace
      initialSaas={saas}
      initialTab={tab}
      initialFilter={filter}
      initialTenantId={tenantId}
    />
  );
}

export default function ClientesPage() {
  return (
    <Suspense fallback={<Cargando texto="Cargando membresías…" />}>
      <ClientesContent />
    </Suspense>
  );
}
