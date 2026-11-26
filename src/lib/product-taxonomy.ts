import type { AppInfo, SaaSSlug } from "./types";

// One presentation contract; capability states reflect the actual available connectors,
// not the presence of matching UI controls.
export const SAAS_PRODUCTS: ReadonlyArray<{
  slug: SaaSSlug;
  name: string;
  focus: string;
  domain: string;
  category: "saas";
  capabilities: {
    tenantRead: "connected";
    statusWrite: "pending";
    moduleWrite: "pending";
    impersonation: "pending";
    settings: "pending";
    activity: "pending";
  };
}> = [
  { slug: "onlyshop", name: "OnlyShop", focus: "Comercio y tienda digital", domain: "onlyshop.nanoapps.ar", category: "saas",
    capabilities: { tenantRead: "connected", statusWrite: "pending", moduleWrite: "pending", impersonation: "pending", settings: "pending", activity: "pending" } },
  { slug: "onlyfood", name: "OnlyFood", focus: "Gastronomía y pedidos", domain: "onlyfood.nanoapps.ar", category: "saas",
    capabilities: { tenantRead: "connected", statusWrite: "pending", moduleWrite: "pending", impersonation: "pending", settings: "pending", activity: "pending" } },
  { slug: "onlypadel", name: "OnlyPadel", focus: "Clubes y reservas", domain: "onlypadel.nanoapps.ar", category: "saas",
    capabilities: { tenantRead: "connected", statusWrite: "pending", moduleWrite: "pending", impersonation: "pending", settings: "pending", activity: "pending" } },
  { slug: "onlycars", name: "OnlyCars", focus: "Concesionarias", domain: "onlycars.nanoapps.ar", category: "saas",
    capabilities: { tenantRead: "connected", statusWrite: "pending", moduleWrite: "pending", impersonation: "pending", settings: "pending", activity: "pending" } },
  { slug: "onlygym", name: "OnlyGym", focus: "Gimnasios y membresías", domain: "onlygym.nanoapps.ar", category: "saas",
    capabilities: { tenantRead: "connected", statusWrite: "pending", moduleWrite: "pending", impersonation: "pending", settings: "pending", activity: "pending" } },
  { slug: "onlymob", name: "OnlyMob", focus: "Gestión inmobiliaria y alquileres", domain: "onlymob.nanoapps.ar", category: "saas",
    capabilities: { tenantRead: "connected", statusWrite: "pending", moduleWrite: "pending", impersonation: "pending", settings: "pending", activity: "pending" } },
  { slug: "onlyturn", name: "OnlyTurn", focus: "Turnos inteligentes", domain: "onlyturn.nanoapps.ar", category: "saas",
    capabilities: { tenantRead: "connected", statusWrite: "pending", moduleWrite: "pending", impersonation: "pending", settings: "pending", activity: "pending" } },
  { slug: "onlyerp", name: "OnlyERP", focus: "Gestión industrial y distribución", domain: "onlyerp.nanoapps.ar", category: "saas",
    capabilities: { tenantRead: "connected", statusWrite: "pending", moduleWrite: "pending", impersonation: "pending", settings: "pending", activity: "pending" } },
] as const;

const SAAS_SLUGS = new Set<string>(SAAS_PRODUCTS.map(p => p.slug));
export type PortfolioSegment = "saas" | "internal" | "dedicated" | "infrastructure";
export function portfolioSegment(app: Pick<AppInfo, "slug" | "type">): PortfolioSegment {
  if (SAAS_SLUGS.has(app.slug)) return "saas";
  if (app.type === "infrastructure") return "infrastructure";
  if (app.type === "client") return "dedicated";
  return "internal";
}
export const PORTFOLIO_SEGMENTS: ReadonlyArray<{id: PortfolioSegment; title: string; description: string}> = [
  { id: "saas", title: "Productos SaaS", description: "Plataformas multiempresa y sus tenants" },
  { id: "internal", title: "Aplicaciones internas", description: "Herramientas y servicios NanoLabs" },
  { id: "dedicated", title: "Clientes dedicados", description: "Implementaciones e instancias individuales" },
  { id: "infrastructure", title: "Infraestructura", description: "Componentes de la plataforma" },
];
