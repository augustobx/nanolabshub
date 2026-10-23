"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Command, Lock, User, ShieldAlert, ArrowRight } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (data.success) {
        router.push(from);
        router.refresh();
      } else {
        setError(data.error || "Credenciales incorrectas");
      }
    } catch (err: any) {
      setError(err.message || "Error al conectar con el servidor de autenticación");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="hub-card p-7 shadow-2xl space-y-6">
      <div className="flex items-center justify-between text-xs font-mono border-b border-white/5 pb-3">
        <span className="text-gray-400 flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-brand-cyan" />
          Ingreso seguro
        </span>
        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
          Acceso privado
        </span>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-mono flex items-center gap-2 animate-in fade-in">
          <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5 font-mono text-xs">
          <label className="text-gray-400 text-[11px] uppercase tracking-wider">
            Usuario
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ingresá tu usuario"
              autoComplete="username"
              className="w-full bg-surface-100/90 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-brand-cyan/50 focus:ring-1 focus:ring-brand-cyan/30 transition-all font-mono"
            />
          </div>
        </div>

        <div className="space-y-1.5 font-mono text-xs">
          <label className="text-gray-400 text-[11px] uppercase tracking-wider">
            Contraseña
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tu contraseña"
              autoComplete="current-password"
              className="w-full bg-surface-100/90 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-brand-cyan/50 focus:ring-1 focus:ring-brand-cyan/30 transition-all font-mono"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 rounded-lg bg-brand-cyan hover:bg-[#bbcdff] text-black font-bold text-xs font-mono transition-all shadow-glow flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <span>{isLoading ? "Ingresando..." : "Ingresar al Hub"}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>


    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#0b1220] px-5 py-14 font-sans">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[650px] -translate-x-1/2 rounded-full bg-[#627ecd]/[0.13] blur-[120px]" />
      <div className="relative z-10 w-full max-w-[410px] space-y-8">
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#91abff] text-[#101827] shadow-lg">
            <Command className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-[27px] font-bold tracking-[-0.05em] text-white">
              nano<span className="text-[#a7bbff]">labs</span> <span className="font-normal text-slate-400">hub</span>
            </h1>
            <p className="mt-2 text-xs text-slate-400">Tu espacio central de administración</p>
          </div>
        </div>
        <Suspense fallback={<div className="hub-card p-8 text-center text-xs text-slate-400">Cargando acceso…</div>}>
          <LoginForm />
        </Suspense>
        <p className="text-center text-[11px] text-slate-500">Acceso reservado a administradores de NanoLabs.</p>
      </div>
    </div>
  );
}
