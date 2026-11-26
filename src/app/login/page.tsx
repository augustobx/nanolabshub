"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Login } from "@/intro/Login";
import "@/intro/base.css";
import "@/intro/login.css";

function LoginView() {
  const searchParams = useSearchParams();
  const requested = searchParams.get("from") || "/";
  const from =
    requested.startsWith("/") &&
    !requested.startsWith("//") &&
    !requested.includes("\\") &&
    !Array.from(requested).some((c) => c.charCodeAt(0) < 32)
      ? requested
      : "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [challenge, setChallenge] = useState("");
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exiting, setExiting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(challenge ? "/api/auth/mfa" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(challenge ? { challenge, code } : { username, password }),
      });

      const data = await res.json();
      if (data.success) {
        if (data.data?.mfaRequired) {
          setChallenge(data.data.challenge);
          setPassword("");
          return;
        }
        setExiting(true);
        window.location.assign(data.data?.enrollmentRequired ? "/account" : from);
      } else {
        setError(data.error || "Credenciales incorrectas");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al conectar con el servidor de autenticación");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Login
      modo={exiting ? "saliendo" : "ingreso"}
      config={{
        producto: "NanoLabs Hub",
        area: "NanoLabs · Central Operations",
        bajada: "Control unificado de SaaS, membresías, aplicaciones e infraestructura.",
      }}
      ingreso={{
        ambiente: "Producción",
        error,
        username,
        setUsername,
        password,
        setPassword,
        challenge,
        code,
        setCode,
        onCancelChallenge: () => {
          setChallenge("");
          setCode("");
          setError(null);
        },
        loading: isLoading,
        onSubmit: handleSubmit,
      }}
    />
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0D0501]" />}>
      <LoginView />
    </Suspense>
  );
}
