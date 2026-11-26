"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { InfraWorkspace } from "@/components/InfraWorkspace";
import { Cargando } from "@/components/nanolabs";
import type { PortfolioSegment } from "@/lib/product-taxonomy";

function InfraContent() {
  const search = useSearchParams();
  const tabParam = search.get("tab");
  const tab = tabParam === "host" ? "host" : tabParam === "dominios" ? "dominios" : "apps";
  const seg = search.get("segment");
  const segment: PortfolioSegment | "all" | "attention" =
    seg === "saas" || seg === "internal" || seg === "dedicated" || seg === "infrastructure" || seg === "attention"
      ? seg
      : "all";
  const archived = search.get("archived") === "1";

  return <InfraWorkspace initialTab={tab} initialSegment={segment} initialArchived={archived} />;
}

export default function InfraestructuraPage() {
  return (
    <Suspense fallback={<Cargando texto="Cargando infraestructura…" />}>
      <InfraContent />
    </Suspense>
  );
}
