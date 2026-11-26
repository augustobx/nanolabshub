"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { InfraWorkspace } from "@/components/InfraWorkspace";
import { Cargando } from "@/components/nanolabs";
import type { PortfolioSegment } from "@/lib/product-taxonomy";

function SoftwareCompat() {
  const search = useSearchParams();
  const seg = search.get("segment");
  const segment: PortfolioSegment | "all" =
    seg === "saas" || seg === "internal" || seg === "dedicated" || seg === "infrastructure" ? seg : "all";
  const archived = search.get("archived") === "1";
  return <InfraWorkspace initialTab="apps" initialSegment={segment} initialArchived={archived} />;
}

export default function SoftwarePage() {
  return (
    <Suspense fallback={<Cargando texto="Cargando aplicaciones…" />}>
      <SoftwareCompat />
    </Suspense>
  );
}
