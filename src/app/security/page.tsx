"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {Header} from "@/components/Header";
import {ShieldCheck,LockKeyhole,DatabaseBackup,Layers3,CloudOff,AlertTriangle,ArrowUpRight,RefreshCw,KeyRound} from "lucide-react";
type Data={
 access:{adminCredentialsConfigured:boolean;multiFactorAvailable:boolean;roleBasedPermissionsAvailable:boolean;localAudit:boolean};
 switches:{backups:boolean;lifecycle:boolean;saasConnectors:boolean};
 connectors:Array<{slug:string;name:string;enabled:boolean;credentialConfigured:boolean;safeWriteContract:boolean}>;
 offsite:{providerConfigured:boolean;lastVerifiedAt:string|null};
 legacy:{dbCredentialsRotation:string;superadminMigration:string};
};
function State({ready}: {ready:boolean}){return <span className={ready?"hub-state hub-state-good":"hub-state hub-state-neutral"}>{ready?"Configurado":"Pendiente"}</span>;}
export default function SecurityPage(){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState<string|null>(null),[loading,setLoading]=useState(true);
 const load=async()=>{setLoading(true);try{const r=await fetch("/api/security/summary",{cache:"no-store"}),j=await r.json();if(!r.ok||!j.success)throw Error(j.error||"Seguridad no disponible");setData(j.data);setError(null);}catch(e){setData(null);setError(e instanceof Error?e.message:"Error de consulta");}finally{setLoading(false);}};
 useEffect(()=>{void load();},[]);
 return <div className="min-w-0 flex-1 pb-14"><Header onRefresh={()=>void load()} isRefreshing={loading}/>
  <div className="hub-content space-y-6">
    <section className="hub-hero space-y-3"><p className="hub-eyebrow">Gobierno / Seguridad</p><h1 className="hub-hero-title">Seguridad visible, sin falsas garantías.</h1>
      <p className="hub-description">Estado de autenticación, conectores y protección de datos. El Hub no revela claves ni contraseñas y no equipara una opción configurada con una auditoría de seguridad completa.</p>
    </section>
    {error&&<div role="alert" className="rounded-xl border border-amber-300/25 p-4 text-xs text-amber-200">{error}</div>}
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {[
        {label:"Credenciales administrativas",description:"Claves no predeterminadas y longitud mínima",value:data?.access.adminCredentialsConfigured,icon:LockKeyhole},
        {label:"Backups habilitados",description:"Motor de respaldos; scheduler se diagnostica aparte",value:data?.switches.backups,icon:DatabaseBackup},
        {label:"Ciclo de vida",description:"Control de suspensión y archivado",value:data?.switches.lifecycle,icon:ShieldCheck},
        {label:"Conexiones SaaS",description:"Interruptor de lectura de tenants",value:data?.switches.saasConnectors,icon:Layers3},
      ].map(x=>{const Icon=x.icon;return <div key={x.label} className="hub-card space-y-3 p-5"><Icon className="h-5 w-5 text-[#afc8fa]"/>
        <h2 className="text-sm font-semibold text-white">{x.label}</h2><State ready={!!x.value}/><p className="text-xs leading-5 text-slate-400">{x.description}</p></div>})}
    </section>
    <section className="hub-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 p-5"><div><h2 className="hub-section-heading">Integración por SaaS</h2><p className="mt-1 text-xs text-slate-400">Una clave distinta por producto. Nunca mostrada ni descargable.</p></div><button className="hub-secondary-action" onClick={()=>void load()} disabled={loading}><RefreshCw className="h-4 w-4"/> Actualizar</button></div>
      <div className="grid gap-2 p-4 sm:grid-cols-2 sm:p-5">
        {data?.connectors.map(item=><div key={item.slug} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 p-4"><div><p className="text-sm font-semibold text-white">{item.name}</p><p className="mt-1 text-xs text-slate-400">{item.enabled?"Lectura habilitada en Hub":"Lectura desactivada por configuración"}</p></div><State ready={item.enabled&&item.credentialConfigured}/></div>)}
        {!data&&<p className="p-5 text-xs text-slate-400">Sin estado disponible.</p>}
      </div>
    </section>
    <section className="grid gap-4 md:grid-cols-3">
      {[
       {title:"Permisos por rol",desc:"Propietario, operador y consulta, con autorización de servidor por operación y aplicación.",state:data?.access.roleBasedPermissionsAvailable,icon:KeyRound},
       {title:"Segundo factor",desc:"TOTP obligatorio, códigos de recuperación de un solo uso y sesiones revocables. Configuración desde Mi cuenta.",state:data?.access.multiFactorAvailable,icon:LockKeyhole},
       {title:"Respaldo externo",desc:"Pendiente: no existe réplica automática fuera del servidor verificada.",state:data?.offsite.providerConfigured,icon:CloudOff},
      ].map(x=>{const Icon=x.icon;return <div key={x.title} className="hub-card p-5"><Icon className="h-5 w-5 text-[#b8cbfb]"/><h3 className="mt-3 text-sm font-semibold text-white">{x.title}</h3><p className="mt-2 text-xs leading-6 text-slate-400">{x.desc}</p><div className="mt-4"><State ready={!!x.state}/></div></div>})}
    </section>
    <div className="flex flex-wrap items-start gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.04] p-5"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300"/><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-white">Protección y recuperación</p><p className="mt-2 text-xs leading-6 text-slate-400">Consultá el estado real del respaldo externo y sus pruebas de recuperación. Las credenciales heredadas de cada SaaS conservan su estado de verificación independiente.</p></div><Link href="/account" className="hub-text-link">Mi cuenta <ArrowUpRight className="h-4 w-4"/></Link><Link href="/audit" className="hub-text-link">Ver auditoría <ArrowUpRight className="h-4 w-4"/></Link></div>
  </div>
 </div>;
}
