"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Crown, Lock, User, ShieldAlert, ArrowRight } from "lucide-react";

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
    <div className="hub-card p-6 border-brand-cyan/20 shadow-2xl space-y-5">
      <div className="flex items-center justify-between text-xs font-mono border-b border-white/5 pb-3">
        <span className="text-gray-400 flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-brand-cyan" />
          IDENTIFICACIÓN SUPREMA
        </span>
        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
          SESIÓN CIFRADA
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
            Operador / Administrador
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ej: augusto"
              className="w-full bg-surface-100/90 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-brand-cyan/50 focus:ring-1 focus:ring-brand-cyan/30 transition-all font-mono"
            />
          </div>
        </div>

        <div className="space-y-1.5 font-mono text-xs">
          <label className="text-gray-400 text-[11px] uppercase tracking-wider">
            Contraseña Maestra
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-surface-100/90 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-brand-cyan/50 focus:ring-1 focus:ring-brand-cyan/30 transition-all font-mono"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 rounded-lg bg-gradient-to-r from-brand-cyan to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black font-bold text-xs font-mono transition-all shadow-glow flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <span>{isLoading ? "AUTENTICANDO..." : "INGRESAR AL GOBIERNO"}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      <div className="pt-2 border-t border-white/5 text-[10px] font-mono text-gray-500 text-center flex items-center justify-center gap-1.5">
        <span>Servidor Dedicado Debian 13</span>
        <span>·</span>
        <span>IP: 149.50.159.163</span>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#070a10] relative overflow-hidden select-none font-sans">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-brand-cyan/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Cyber Grid Lines */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Card */}
        <div className="text-center space-y-3">
          <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-brand-cyan/20 via-blue-600/20 to-purple-600/20 border border-brand-cyan/30 shadow-glow">
            <Crown className="w-8 h-8 text-brand-cyan animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white font-mono">
              NANOLABS<span className="text-brand-cyan">HUB</span>
            </h1>
            <p className="text-xs text-gray-400 font-mono tracking-wider uppercase mt-1">
              SUPREME GOVERNANCE · ACCESO AUTORIZADO
            </p>
          </div>
        </div>

        <Suspense fallback={<div className="hub-card p-8 text-center text-xs font-mono text-gray-500">Cargando acceso...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
