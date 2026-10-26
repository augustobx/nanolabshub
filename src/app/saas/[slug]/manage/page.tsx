"use client";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Header } from "@/components/Header";
import { SaaSManagementPanel } from "@/components/SaaSManagementPanel";
function ManagementPage() {
  const params = useParams(), search = useSearchParams(), slug = params.slug;
  if (slug !== "onlygym" && slug !== "onlyturn" && slug !== "onlyfood" && slug !== "onlycars") return <div className="hub-content"><p>La gestión central no está habilitada para este producto.</p><Link href="/saas">Volver a productos</Link></div>;
  const section = search.get("section");
  return <div className="min-w-0 flex-1 pb-12"><Header/><div className="hub-content space-y-5"><Link className="hub-text-link" href={"/saas/" + slug}>Volver a la ficha del producto</Link><SaaSManagementPanel product={slug} initialTenantId={search.get("tenantId") || undefined} initialSection={section==="plans"||section==="audit"?section:"tenants"}/></div></div>;
}
export default function Page() { return <Suspense fallback={<p className="p-6 text-slate-400">Cargando administración…</p>}><ManagementPage/></Suspense>; }

