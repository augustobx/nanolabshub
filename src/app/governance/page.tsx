"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { MembershipsWorkspace } from "@/components/MembershipsWorkspace";
import { Cargando } from "@/components/nanolabs";

function GovernanceCompat() {
  const search = useSearchParams();
  const saas = search.get("saas") || "all";
  return <MembershipsWorkspace initialSaas={saas} initialTab="membresias" />;
}

export default function GovernancePage() {
  return (
    <Suspense fallback={<Cargando texto="Cargando membresías…" />}>
      <GovernanceCompat />
    </Suspense>
  );
}
