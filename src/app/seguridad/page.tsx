"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SecurityWorkspace } from "@/components/SecurityWorkspace";
import { Cargando } from "@/components/nanolabs";

function SeguridadContent() {
  const search = useSearchParams();
  const tabParam = search.get("tab");
  const tab = tabParam === "auditoria" ? "auditoria" : tabParam === "conectores" ? "conectores" : "cuenta";
  return <SecurityWorkspace initialTab={tab} />;
}

export default function SeguridadPage() {
  return (
    <Suspense fallback={<Cargando texto="Cargando seguridad…" />}>
      <SeguridadContent />
    </Suspense>
  );
}
