"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { MembershipsWorkspace } from "@/components/MembershipsWorkspace";
import { Cargando } from "@/components/nanolabs";

function ManageCompat() {
  const params = useParams();
  const search = useSearchParams();
  const slug = typeof params.slug === "string" ? params.slug : "all";
  const section = search.get("section");
  const tab = section === "plans" ? "planes" : section === "audit" ? "conectores" : "membresias";
  const tenantId = search.get("tenantId") || "";
  return <MembershipsWorkspace initialSaas={slug} initialTab={tab} initialTenantId={tenantId} />;
}

export default function Page() {
  return (
    <Suspense fallback={<Cargando texto="Cargando administración…" />}>
      <ManageCompat />
    </Suspense>
  );
}
