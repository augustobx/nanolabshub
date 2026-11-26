"use client";

import { useEffect, useRef, useState } from "react";
import { Icono } from "./Icono";
import { INTRO_DEFAULT, type ConfigIntro } from "./config";
import { NanoLabsMark } from "./NanoLabsMark";
import type { PropsIngreso } from "./tipos";
import { crearCielo } from "./escena/cielo";
import { crearEscena } from "./escena/particulas";
import type { Escena, Fase } from "./escena/particulas";

const FASES: Fase[] = ["caos", "isotipo", "producto"];

const quietoDelSistema = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function Login({
  modo,
  ingreso,
  config,
}: {
  modo: "verificando" | "ingreso" | "saliendo";
  ingreso?: PropsIngreso;
  config?: Partial<ConfigIntro>;
}) {
  const conf: ConfigIntro = {
    producto: config?.producto || INTRO_DEFAULT.producto,
    area: config?.area || INTRO_DEFAULT.area,
    bajada: config?.bajada || INTRO_DEFAULT.bajada,
  };

  const lienzo = useRef<HTMLCanvasElement>(null);
  const cielo = useRef<HTMLCanvasElement>(null);
  const escena = useRef<Escena | null>(null);
  const [fase, setFase] = useState<Fase>("caos");
  const [tarjeta, setTarjeta] = useState(false);
  const [quieto] = useState(quietoDelSistema);

  useEffect(() => {
    if (!lienzo.current) return;
    const pedida = new URLSearchParams(window.location.search).get("escena") as Fase | null;
    const faseFija = pedida && FASES.includes(pedida) ? pedida : undefined;
    escena.current = crearEscena(lienzo.current, {
      logoUrl: "/nanolabs/logo-nanolabs.svg",
      quieto,
      faseFija,
      onFase: setFase,
    });
    return () => escena.current?.destruir();
  }, [quieto]);

  useEffect(() => {
    if (!cielo.current) return;
    const c = crearCielo(cielo.current, quieto);
    return () => c.destruir();
  }, [quieto]);

  useEffect(() => {
    if (modo !== "ingreso") return;
    const t = setTimeout(() => setTarjeta(true), quieto ? 0 : 650);
    return () => clearTimeout(t);
  }, [modo, quieto]);

  return (
    <div className={`bhi bh2 bh3${modo === "saliendo" ? " bh2--sale" : ""}`} aria-busy={modo === "verificando"}>
      <div className="bh2-fondo" aria-hidden="true" />
      <canvas ref={cielo} className="bh2-lienzo" aria-hidden="true" />
      <canvas ref={lienzo} className="bh2-lienzo" aria-hidden="true" />
      <div className="bh2-vineta" aria-hidden="true" />

      <header className="bh2-arriba">
        <span className="bh2-marca__area">{conf.area}</span>
      </header>

      {fase === "producto" && (
        <div className="bh3-nombre">
          <h2 className="bh3-nombre__titulo">{conf.producto}</h2>
          <p className="bh3-nombre__bajada">{conf.bajada}</p>
        </div>
      )}

      <div className="bh2-relato" aria-live="polite">
        <p className="bh2-nanolabs">
          <NanoLabsMark size={22} />
          <span>
            Powered by <strong>NanoLabs</strong>
          </span>
        </p>
        {modo === "verificando" && (
          <p className="bh2-estado" role="status">
            <span className="bh2-estado__barra" aria-hidden="true" />
            Verificando tu sesión…
          </p>
        )}
      </div>

      {modo !== "verificando" && ingreso && (
        <Tarjeta visible={tarjeta || modo === "saliendo"} producto={conf.producto} {...ingreso} />
      )}

      <p className="bh2-pie">NanoLabs · Governance & Infrastructure Control · Multi-Tenant Ecosystem</p>
    </div>
  );
}

function Tarjeta({
  visible,
  producto,
  ambiente,
  error,
  aviso,
  username,
  setUsername,
  password,
  setPassword,
  challenge,
  code,
  setCode,
  onCancelChallenge,
  loading,
  onSubmit,
}: PropsIngreso & { visible: boolean; producto: string }) {
  return (
    <main className={`bh2-tarjeta${visible ? " bh2-tarjeta--visible" : ""}`} aria-hidden={!visible}>
      <div className="bh2-tarjeta__cuerpo">
        <div className="bh2-tarjeta__cabeza">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <NanoLabsMark size={38} />
            <div>
              <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#1E293B", lineHeight: "1.1" }}>{producto}</h1>
              <p style={{ fontSize: "11px", color: "#64748B", fontWeight: 600 }}>Control Central NanoLabs</p>
            </div>
          </div>
          {ambiente && <span className="bhi-chip bhi-chip--info">{ambiente}</span>}
        </div>

        <p className="bh2-tarjeta__bajada">
          {challenge
            ? "Ingresá el código de tu autenticador o un código de recuperación."
            : "Ingresá con tu usuario administrativo para operar el ecosistema."}
        </p>

        {error && (
          <div className="bhi-alerta bhi-alerta--danger" role="alert">
            <Icono nombre="error" tamano={20} />
            <div>
              <strong>Error de acceso</strong>
              <span>{error}</span>
            </div>
          </div>
        )}

        {aviso && (
          <div className="bhi-alerta bhi-alerta--warning">
            <Icono nombre="advertencia" tamano={20} />
            <div>{aviso}</div>
          </div>
        )}

        <form onSubmit={onSubmit}>
          {!challenge ? (
            <>
              <div className="bhi-campo">
                <label className="bhi-etiqueta" htmlFor="login-username">
                  Usuario
                </label>
                <div className="bhi-input-contenedor">
                  <span className="bhi-input-icono">
                    <Icono nombre="persona" tamano={18} />
                  </span>
                  <input
                    id="login-username"
                    type="text"
                    required
                    tabIndex={visible ? 0 : -1}
                    autoComplete="username"
                    placeholder="Ingresá tu usuario"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="bhi-input"
                  />
                </div>
              </div>

              <div className="bhi-campo">
                <label className="bhi-etiqueta" htmlFor="login-password">
                  Contraseña
                </label>
                <div className="bhi-input-contenedor">
                  <span className="bhi-input-icono">
                    <Icono nombre="candado" tamano={18} />
                  </span>
                  <input
                    id="login-password"
                    type="password"
                    required
                    tabIndex={visible ? 0 : -1}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bhi-input"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="bhi-campo">
              <label className="bhi-etiqueta" htmlFor="login-mfa-code">
                Código de segundo factor o recuperación
              </label>
              <div className="bhi-input-contenedor">
                <span className="bhi-input-icono">
                  <Icono nombre="candado" tamano={18} />
                </span>
                <input
                  id="login-mfa-code"
                  name="code"
                  type="text"
                  required
                  autoFocus
                  tabIndex={visible ? 0 : -1}
                  autoComplete="one-time-code"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.trim())}
                  className="bhi-input"
                />
              </div>
              <button
                type="button"
                onClick={onCancelChallenge}
                style={{
                  alignSelf: "flex-start",
                  marginTop: "6px",
                  background: "none",
                  border: "none",
                  padding: 0,
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--bhi-primario)",
                  cursor: "pointer",
                }}
              >
                Volver al ingreso
              </button>
            </div>
          )}

          <button type="submit" className="bhi-boton bhi-boton--primario" disabled={loading} tabIndex={visible ? 0 : -1}>
            {loading ? <span className="bhi-girando" aria-hidden="true" /> : <Icono nombre="ingresar" tamano={20} />}
            {loading ? "Verificando…" : challenge ? "Confirmar acceso" : "Ingresar al Hub"}
          </button>

          <p className="bh2-seguro">
            <Icono nombre="candado" tamano={15} />
            Acceso privado con sesión revocable y MFA obligatorio
          </p>
        </form>
      </div>

      <div className="bh2-tarjeta__pie">
        <span>Acceso reservado a operadores y propietarios de NanoLabs.</span>
      </div>
    </main>
  );
}
