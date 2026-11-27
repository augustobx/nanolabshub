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
  { slug: "onlymob", name: "OnlyMob", focus: "Gestión inmobiliaria y alquileres", domain: "onlymob.nanoapps.ar", category: "saas",
    capabilities: { tenantRead: "connected", statusWrite: "pending", moduleWrite: "pending", impersonation: "pending", settings: "pending", activity: "pending" } },
  { slug: "onlymarket", name: "OnlyMarket", focus: "Supermercados, mercados y sucursales", domain: "onlymarket.nanoapps.ar", category: "saas",
    capabilities: { tenantRead: "connected", statusWrite: "pending", moduleWrite: "pending", impersonation: "pending", settings: "pending", activity: "pending" } },
  { slug: "onlyerp", name: "OnlyERP", focus: "Gestión industrial y distribución", domain: "onlyerp.nanoapps.ar", category: "saas",
    capabilities: { tenantRead: "connected", statusWrite: "pending", moduleWrite: "pending", impersonation: "pending", settings: "pending", activity: "pending" } },
] as const;

export const INDEPENDENT_BILLED_APPS: ReadonlyArray<{
  slug: "acevedocontrol" | "nanolabs-ai-trading" | "liga-padel";
  name: string;
  focus: string;
  domain: string;
  billingEnabled: true;
}> = [
  { slug: "acevedocontrol", name: "Acevedo Control", focus: "Control operativo y gestión dedicada", domain: "acevedocontrol.nanoapps.ar", billingEnabled: true },
  { slug: "nanolabs-ai-trading", name: "NanoLabs AI Trading", focus: "Análisis algorítmico y trading", domain: "nanotrading.nanoapps.ar", billingEnabled: true },
  { slug: "liga-padel", name: "Liga Pádel", focus: "Torneos, ligas y agenda deportiva", domain: "asp.nanoapps.ar", billingEnabled: true },
] as const;

export const INSTITUTIONAL_APPS: ReadonlyArray<{
  slug: "nanolabs";
  name: string;
  focus: string;
  domain: string;
  billingEnabled: false;
}> = [
  { slug: "nanolabs", name: "NanoLabs Web", focus: "Sitio web institucional de NanoLabs", domain: "nanolabs.com.ar", billingEnabled: false },
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
