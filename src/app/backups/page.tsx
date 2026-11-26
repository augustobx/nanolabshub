"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { BackupsWorkspace } from "@/components/BackupsWorkspace";
import { Cargando } from "@/components/nanolabs";

function BackupsContent() {
  const search = useSearchParams();
  const tabParam = search.get("tab");
  const tab = tabParam === "historial" ? "historial" : tabParam === "retencion" ? "retencion" : "estado";
  return <BackupsWorkspace initialTab={tab} />;
}

export default function BackupsPage() {
  return (
    <Suspense fallback={<Cargando texto="Cargando backups…" />}>
      <BackupsContent />
    </Suspense>
  );
}
