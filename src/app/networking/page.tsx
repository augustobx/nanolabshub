"use client";

import { Header } from "@/components/Header";
import {
  Network,
  ShieldCheck,
  ExternalLink,
  Lock,
  Globe,
  Radio,
  CheckCircle2,
  AlertCircle,
  Layers,
} from "lucide-react";

const PROXY_ROUTES = [
  {
    domain: "hub.nanoapps.ar",
    forwardTarget: "nanolabshub:3000",
    ssl: "Let's Encrypt (*.nanoapps.ar)",
    status: "active",
    type: "governance",
  },
  {
    domain: "proxy.nanoapps.site",
    forwardTarget: "nginx-proxy-manager:81",
    ssl: "Let's Encrypt",
    status: "active",
    type: "infrastructure",
  },
  {
    domain: "portainer.nanoapps.site",
    forwardTarget: "portainer:9000",
    ssl: "Let's Encrypt",
    status: "active",
    type: "infrastructure",
  },
  {
    domain: "onlyfood.nanoapps.ar",
    forwardTarget: "onlyfood-app-1:3000",
    ssl: "Let's Encrypt",
    status: "active",
    type: "saas",
  },
  {
    domain: "onlypadel.nanoapps.ar",
    forwardTarget: "onlypadel-web:3000",
    ssl: "Let's Encrypt",
    status: "active",
    type: "saas",
  },
  {
    domain: "onlycars.nanoapps.ar",
    forwardTarget: "onlycars-app-1:3000",
    ssl: "Let's Encrypt",
    status: "active",
    type: "saas",
  },
  {
    domain: "onlygym.nanoapps.ar",
    forwardTarget: "onlygym-web:3000",
    ssl: "Let's Encrypt",
    status: "active",
    type: "saas",
  },
  {
    domain: "onlymob.nanoapps.ar",
    forwardTarget: "onlymob-web:3000",
    ssl: "Let's Encrypt",
    status: "active",
    type: "saas",
  },
  {
    domain: "onlyturn.nanoapps.ar",
    forwardTarget: "onlyturn-web:3000",
    ssl: "Let's Encrypt",
    status: "active",
    type: "saas",
  },
  {
    domain: "onlyerp.nanoapps.ar",
    forwardTarget: "onlyerp-web:3000",
    ssl: "Let's Encrypt",
    status: "active",
    type: "client",
  },
  {
    domain: "sanpedropadel.nanoapps.ar",
    forwardTarget: "sanpedropadel-web:3000",
    ssl: "Let's Encrypt",
    status: "active",
    type: "client",
  },
  {
    domain: "gastos.nanoapps.ar",
    forwardTarget: "gastosapp-web:3000",
    ssl: "Let's Encrypt",
    status: "active",
    type: "internal",
  },
  {
    domain: "keys.nanolabs.online",
    forwardTarget: "nanokeys-web:3000",
    ssl: "Let's Encrypt",
    status: "active",
    type: "internal",
  },
  {
    domain: "nanolabs.com.ar",
    forwardTarget: "nanolabs-web-1:3000",
    ssl: "Let's Encrypt",
    status: "active",
    type: "internal",
  },
];

export default function NetworkingPage() {
  return (
    <div className="flex-1 flex flex-col pb-12">
      <Header />

      <div className="hub-content space-y-7">
        <section className="hub-hero space-y-3">
          <p className="hub-eyebrow">Operación / Conectividad</p>
          <h1 className="hub-hero-title">Dominios, red y certificados.</h1>
          <p className="hub-description">
            Mapa de configuración de accesos públicos, proxy y certificados.
            Los valores de esta sección son declarativos y no reemplazan una comprobación en vivo.
          </p>
        </section>

        {/* Network Infrastructure Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="hub-card p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-gray-400">
              <span className="flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-brand-cyan" />
                Rutas en inventario
              </span>
            </div>
            <div className="text-2xl font-bold font-mono text-white">
              {PROXY_ROUTES.length}{" "}
              <span className="text-xs font-normal text-gray-400">hosts</span>
            </div>
            <div className="text-[11px] text-gray-500 font-mono">
              Enrutados hacia la red Docker `proxy`
            </div>
          </div>

          <div className="hub-card p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-gray-400">
              <span className="flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-emerald-400" />
                Certificados declarados
              </span>
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6" />
              <span>HTTPS configurado</span>
            </div>
            <div className="text-[11px] text-gray-500 font-mono">
              Según la configuración registrada
            </div>
          </div>

          <div className="hub-card p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-gray-400">
              <span className="flex items-center gap-1.5">
                <Radio className="w-4 h-4 text-purple-400" />
                Puertos documentados
              </span>
            </div>
            <div className="text-2xl font-bold font-mono text-white">
              80 / 443 / 2207
            </div>
            <div className="text-[11px] text-gray-500 font-mono">
              HTTP, HTTPS y SSH seguro
            </div>
          </div>
        </div>

        {/* NPM Hosts Table */}
        <div className="hub-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Tabla de Proxy Hosts Registrados</span>
              </h2>
              <p className="text-xs text-gray-500 font-mono">
                Gestionado centralmente por Nginx Proxy Manager en el servidor
              </p>
            </div>
            <a
              href="https://proxy.nanoapps.site"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-mono text-brand-cyan hover:underline flex items-center gap-1"
            >
              Abrir panel NPM <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-surface-100/60 text-gray-400 uppercase text-[10px] tracking-wider border-b border-white/5">
                <tr>
                  <th className="py-2.5 px-3">Dominio Público</th>
                  <th className="py-2.5 px-3">Destino Interno (Docker)</th>
                  <th className="py-2.5 px-3">Certificado SSL</th>
                  <th className="py-2.5 px-3">Categoría</th>
                  <th className="py-2.5 px-3 text-right">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-gray-300">
                {PROXY_ROUTES.map((route) => (
                  <tr key={route.domain} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-white">
                      <a
                        href={`https://${route.domain}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-white hover:text-brand-cyan transition-colors flex items-center gap-1.5"
                      >
                        <Lock className="w-3 h-3 text-emerald-400" />
                        <span>{route.domain}</span>
                        <ExternalLink className="w-2.5 h-2.5 text-gray-500" />
                      </a>
                    </td>
                    <td className="py-2.5 px-3 text-brand-cyan">{route.forwardTarget}</td>
                    <td className="py-2.5 px-3 text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>{route.ssl}</span>
                    </td>
                    <td className="py-2.5 px-3 text-gray-400 uppercase text-[10px]">
                      {route.type}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        ROUTED
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
