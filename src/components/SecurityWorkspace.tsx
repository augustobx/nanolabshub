"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, ScrollText, Search, ShieldCheck } from "lucide-react";
import {
  Cargando,
  Encabezado,
  NanoLabsAlert,
  NanoLabsButton,
  NanoLabsChip,
  NanoLabsTabs,
  useToast,
} from "./nanolabs";

type Account = {
  userId: string;
  username: string;
  role: string;
  enrollmentRequired: boolean;
  mfaReady: boolean;
  authenticatedAt: number;
  sessions: Array<{
    id: string;
    createdAt: number;
    lastSeen: number;
    expiresAt: number;
    revokedAt: number | null;
    current: boolean;
  }>;
};

type User = {
  id: string;
  username: string;
  role: string;
  scopes: string[];
  active: boolean;
  mfaReady: boolean;
};

type AuditItem = {
  id: number;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  details: string;
  source: string;
};

type SecurityData = {
  access: {
    adminCredentialsConfigured: boolean;
    multiFactorAvailable: boolean;
    roleBasedPermissionsAvailable: boolean;
    localAudit: boolean;
  };
  switches: { backups: boolean; lifecycle: boolean; saasConnectors: boolean };
  connectors: Array<{
    slug: string;
    name: string;
    enabled: boolean;
    credentialConfigured: boolean;
    safeWriteContract: boolean;
  }>;
  offsite: { providerConfigured: boolean; lastVerifiedAt: string | null };
};

function UserOptions({ user }: { user?: User }) {
  return (
    <>
      <label className="space-y-1 text-xs">
        <span className="text-slate-500">Rol</span>
        <select className="bh-select" name="role" defaultValue={user?.role || "viewer"}>
          <option value="owner">Propietario</option>
          <option value="operator">Operador</option>
          <option value="viewer">Consulta</option>
        </select>
      </label>
      <label className="bh-check-label">
        <input type="checkbox" name="active" className="bh-check" defaultChecked={user?.active ?? true} />
        Cuenta activa
      </label>
      <div className="flex flex-wrap gap-3 text-xs sm:col-span-2">
        {["nanolabshub", "onlyfood", "onlygym", "onlyturn", "onlycars", "onlyerp", "onlyshop"].map((slug) => (
          <label key={slug} className="bh-check-label text-xs">
            <input
              type="checkbox"
              name="scopes"
              value={slug}
              className="bh-check"
              defaultChecked={user?.scopes.includes(slug)}
            />
            {slug}
          </label>
        ))}
      </div>
    </>
  );
}

export function SecurityWorkspace({
  initialTab = "cuenta",
}: {
  initialTab?: "cuenta" | "auditoria" | "conectores";
}) {
  const toast = useToast();
  const [tab, setTab] = useState<"cuenta" | "auditoria" | "conectores">(initialTab);

  // Account & MFA
  const [account, setAccount] = useState<Account | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Audit
  const [auditItems, setAuditItems] = useState<AuditItem[]>([]);
  const [auditQuery, setAuditQuery] = useState("");
  const [auditLoading, setAuditLoading] = useState(false);

  // Summary
  const [summary, setSummary] = useState<SecurityData | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const loadAccount = useCallback(async () => {
    const r = await fetch("/api/auth/account", { cache: "no-store" });
    const j = await r.json();
    if (!r.ok || !j.success) throw new Error(j.error || "Cuenta no disponible");
    setAccount(j.data);
    if (j.data.role === "owner" && j.data.mfaReady) {
      const u = await fetch("/api/auth/users", { cache: "no-store" });
      const v = await u.json();
      if (u.ok && v.success) setUsers(v.data);
    } else {
      setUsers([]);
    }
  }, []);

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    try {
      const r = await fetch("/api/audit", { cache: "no-store" });
      const j = await r.json();
      if (r.ok && j.success) setAuditItems(j.data || []);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const r = await fetch("/api/security/summary", { cache: "no-store" });
      const j = await r.json();
      if (r.ok && j.success) setSummary(j.data);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccount().catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, [loadAccount]);

  useEffect(() => {
    if (tab === "auditoria") void loadAudit();
    if (tab === "conectores") void loadSummary();
  }, [tab, loadAudit, loadSummary]);

  const send = async (operation: string, fields: Record<string, unknown> = {}) => {
    setBusy(true);
    setError("");
    try {
      const url = operation === "user.save" ? "/api/auth/users" : "/api/auth/account";
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(operation === "user.save" ? fields : { operation, ...fields }),
      });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j.error || "No se pudo completar la operación");
      if (operation === "mfa.begin") setSetup(j.data);
      if (operation === "mfa.confirm") {
        setSetup(null);
        setCodes(j.data.recoveryCodes);
      }
      if (
        j.data?.signInRequired ||
        (operation === "user.save" && fields.id === account?.userId) ||
        (operation === "session.revoke" &&
          (fields.all || fields.sessionId === account?.sessions.find((s) => s.current)?.id))
      ) {
        window.location.replace("/login");
        return;
      }
      await loadAccount();
      toast("Operación completada.", "ok");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error de cuenta";
      setError(msg);
      toast(msg, "error");
    } finally {
      setBusy(false);
    }
  };

  const submitForm =
    (operation: string, convert: (f: FormData) => Record<string, unknown>) =>
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = e.currentTarget;
      const fields = convert(new FormData(form));
      void send(operation, fields).then(() => {
        for (const control of Array.from(form.querySelectorAll<HTMLInputElement>('input[type="password"]'))) {
          control.value = "";
        }
      });
    };

  const userFields = (f: FormData) => ({
    username: f.get("username"),
    role: f.get("role"),
    scopes: f.getAll("scopes"),
    active: f.get("active") === "on",
    resetMfa: f.get("resetMfa") === "on",
    ...(f.get("password") ? { password: f.get("password") } : {}),
  });

  const filteredAudit = useMemo(
    () =>
      auditItems.filter((x) =>
        `${x.action} ${x.actor} ${x.target} ${x.details}`
          .toLocaleLowerCase("es")
          .includes(auditQuery.toLocaleLowerCase("es"))
      ),
    [auditItems, auditQuery]
  );

  return (
    <div className="ot-pagina">
      <Encabezado
        icono={ShieldCheck}
        antetitulo="Gobierno · Seguridad y Cuenta"
        titulo="Seguridad, MFA y Auditoría"
        bajada="Gestión de tu acceso al Hub, usuarios por rol, historial local de auditoría y estado de conectores."
        accion={
          <NanoLabsButton
            variant="secondary"
            size="small"
            icon={<RefreshCw size={14} />}
            onClick={() => {
              void loadAccount();
              if (tab === "auditoria") void loadAudit();
              if (tab === "conectores") void loadSummary();
            }}
          >
            Actualizar
          </NanoLabsButton>
        }
      />

      {error && <NanoLabsAlert severity="error" title="Atención" description={error} />}

      <NanoLabsTabs
        idBase="security-workspace"
        activa={tab}
        onCambiar={setTab}
        tabs={[
          { id: "cuenta", label: "Mi Cuenta y Usuarios" },
          { id: "auditoria", label: "Auditoría del Hub" },
          { id: "conectores", label: "Conectores y Controles" },
        ]}
      >
        {tab === "cuenta" && (
          <fieldset disabled={busy} className="space-y-5 disabled:opacity-70">
            {(account?.enrollmentRequired || setup) && (
              <section className="bh-card space-y-4">
                <h2 className="hub-section-heading">Configurar segundo factor</h2>
                <p className="text-xs text-slate-500">
                  Agregá esta cuenta a tu aplicación autenticadora. La clave se muestra solo durante la configuración.
                </p>
                {!setup ? (
                  <NanoLabsButton onClick={() => void send("mfa.begin")}>Comenzar configuración MFA</NanoLabsButton>
                ) : (
                  <div className="space-y-3">
                    <code className="block break-all rounded-xl bg-slate-950 p-4 text-sm text-white">
                      {setup.secret}
                    </code>
                    <form
                      className="flex max-w-sm flex-col gap-3"
                      onSubmit={submitForm("mfa.confirm", (f) => ({ code: f.get("code") }))}
                    >
                      <label className="space-y-1 text-xs">
                        <span className="text-slate-500">Código de seis dígitos</span>
                        <input name="code" required className="bh-input" />
                      </label>
                      <NanoLabsButton type="submit">Confirmar segundo factor</NanoLabsButton>
                    </form>
                  </div>
                )}
              </section>
            )}

            {codes.length > 0 && (
              <section className="bh-card space-y-4">
                <h2 className="hub-section-heading">Guardá tus códigos de recuperación</h2>
                <p className="text-xs text-slate-500">
                  Cada código sirve una sola vez. Guardalos en un lugar seguro fuera del navegador.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {codes.map((c) => (
                    <code key={c} className="rounded-lg bg-slate-950 p-2.5 text-xs text-white">
                      {c}
                    </code>
                  ))}
                </div>
                <NanoLabsButton onClick={() => window.location.assign("/")}>Ya guardé mis códigos</NanoLabsButton>
              </section>
            )}

            {account?.mfaReady && (
              <div className="grid gap-5 lg:grid-cols-2">
                <section className="bh-card space-y-3">
                  <h3 className="hub-section-heading">Verificación para acciones sensibles</h3>
                  <p className="text-xs text-slate-500">
                    Última verificación: {new Date(account.authenticatedAt).toLocaleString("es-AR")}.
                  </p>
                  <form
                    className="space-y-3"
                    onSubmit={submitForm("session.verify", (f) => ({
                      password: f.get("password"),
                      code: f.get("code"),
                    }))}
                  >
                    <label className="block space-y-1 text-xs">
                      <span className="text-slate-500">Contraseña actual</span>
                      <input name="password" type="password" required className="bh-input" />
                    </label>
                    <label className="block space-y-1 text-xs">
                      <span className="text-slate-500">Código TOTP o recuperación</span>
                      <input name="code" required className="bh-input" />
                    </label>
                    <NanoLabsButton type="submit" size="small">
                      Verificar identidad
                    </NanoLabsButton>
                  </form>
                </section>

                <section className="bh-card space-y-3">
                  <h3 className="hub-section-heading">Cambiar contraseña</h3>
                  <p className="text-xs text-slate-500">Mínimo 16 caracteres. Cierra las sesiones abiertas.</p>
                  <form
                    className="space-y-3"
                    onSubmit={submitForm("password.change", (f) => ({
                      currentPassword: f.get("currentPassword"),
                      newPassword: f.get("newPassword"),
                    }))}
                  >
                    <label className="block space-y-1 text-xs">
                      <span className="text-slate-500">Contraseña actual</span>
                      <input name="currentPassword" type="password" required className="bh-input" />
                    </label>
                    <label className="block space-y-1 text-xs">
                      <span className="text-slate-500">Contraseña nueva</span>
                      <input name="newPassword" type="password" required className="bh-input" />
                    </label>
                    <NanoLabsButton type="submit" size="small">
                      Guardar contraseña
                    </NanoLabsButton>
                  </form>
                </section>

                <section className="bh-card space-y-3 lg:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="hub-section-heading">Sesiones activas</h3>
                    <NanoLabsButton
                      type="button"
                      variant="secondary"
                      size="small"
                      onClick={() => void send("session.revoke", { all: true })}
                    >
                      Cerrar todas mis sesiones
                    </NanoLabsButton>
                  </div>
                  <div className="divide-y divide-slate-200 dark:divide-slate-800">
                    {account.sessions
                      .filter((s) => !s.revokedAt && s.expiresAt > Date.now())
                      .map((s) => (
                        <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs">
                          <span>
                            {s.current ? "Sesión actual" : "Otra sesión"} · Último uso{" "}
                            {new Date(s.lastSeen).toLocaleString("es-AR")}
                          </span>
                          <NanoLabsButton
                            type="button"
                            variant="tertiary"
                            size="small"
                            onClick={() => void send("session.revoke", { sessionId: s.id })}
                          >
                            Revocar
                          </NanoLabsButton>
                        </div>
                      ))}
                  </div>
                </section>
              </div>
            )}

            {account?.mfaReady && account.role === "owner" && (
              <section className="bh-card space-y-4">
                <h3 className="hub-section-heading">Usuarios del Hub</h3>
                <form className="grid gap-3 sm:grid-cols-2" onSubmit={submitForm("user.save", userFields)}>
                  <label className="space-y-1 text-xs">
                    <span className="text-slate-500">Usuario nuevo</span>
                    <input name="username" required className="bh-input" />
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="text-slate-500">Contraseña inicial (mín. 16 caracteres)</span>
                    <input name="password" type="password" required className="bh-input" />
                  </label>
                  <UserOptions />
                  <div className="sm:col-span-2">
                    <NanoLabsButton type="submit" size="small">
                      Crear usuario
                    </NanoLabsButton>
                  </div>
                </form>

                {users.map((u) => (
                  <form
                    key={u.id + JSON.stringify(u)}
                    className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2 dark:border-slate-800"
                    onSubmit={submitForm("user.save", (f) => ({ ...userFields(f), id: u.id }))}
                  >
                    <div className="text-sm font-bold sm:col-span-2">
                      {u.username} · MFA {u.mfaReady ? "Configurado" : "Pendiente"}
                    </div>
                    <label className="space-y-1 text-xs">
                      <span className="text-slate-500">Nueva contraseña (opcional)</span>
                      <input name="password" type="password" className="bh-input" />
                    </label>
                    <UserOptions user={u} />
                    {u.username !== account.username && (
                      <label className="bh-check-label text-xs sm:col-span-2">
                        <input type="checkbox" name="resetMfa" className="bh-check" />
                        Exigir nuevo enrolamiento MFA
                      </label>
                    )}
                    <div className="sm:col-span-2">
                      <NanoLabsButton type="submit" variant="secondary" size="small">
                        Guardar permisos
                      </NanoLabsButton>
                    </div>
                  </form>
                ))}
              </section>
            )}
          </fieldset>
        )}

        {tab === "auditoria" && (
          <div className="space-y-4">
            <div className="bh-toolbar">
              <div className="bh-field bh-search-field">
                <label className="bh-label" htmlFor="buscar-auditoria">
                  Buscar evento
                </label>
                <span className="bh-search-field__icon">
                  <Search size={16} />
                </span>
                <input
                  id="buscar-auditoria"
                  type="search"
                  className="bh-input"
                  placeholder="Acción, operador o destino…"
                  value={auditQuery}
                  onChange={(e) => setAuditQuery(e.target.value)}
                />
              </div>
            </div>

            {auditLoading ? (
              <Cargando texto="Cargando eventos de auditoría…" />
            ) : (
              <div className="ot-tabla">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="bh-table ot-fija min-w-[780px]">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Operador</th>
                        <th>Acción</th>
                        <th>Destino</th>
                        <th>Detalle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAudit.map((item) => (
                        <tr key={item.id}>
                          <td className="text-xs">{new Date(item.timestamp).toLocaleString("es-AR")}</td>
                          <td className="text-xs font-semibold">{item.actor}</td>
                          <td>
                            <span className="inline-flex items-center gap-1.5 ot-mono text-xs">
                              <ScrollText size={13} /> {item.action}
                            </span>
                          </td>
                          <td>
                            <NanoLabsChip severity="neutral">{item.target}</NanoLabsChip>
                          </td>
                          <td className="text-xs text-slate-500">{item.details || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "conectores" && (
          <div className="space-y-4">
            {summaryLoading && !summary ? (
              <Cargando texto="Consultando controles de seguridad…" />
            ) : summary ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: "Credenciales admin", ready: summary.access.adminCredentialsConfigured },
                    { label: "MFA y roles", ready: summary.access.multiFactorAvailable && summary.access.roleBasedPermissionsAvailable },
                    { label: "Backups automáticos", ready: summary.switches.backups },
                    { label: "Réplica externa", ready: summary.offsite.providerConfigured },
                  ].map((item) => (
                    <div key={item.label} className="bh-card flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold">{item.label}</span>
                      <NanoLabsChip severity={item.ready ? "success" : "neutral"}>
                        {item.ready ? "Activo" : "Pendiente"}
                      </NanoLabsChip>
                    </div>
                  ))}
                </div>

                <div className="ot-tabla">
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="bh-table ot-fija min-w-[640px]">
                      <thead>
                        <tr>
                          <th>Plataforma</th>
                          <th>Lectura habilitada</th>
                          <th>Credencial configurada</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.connectors.map((c) => (
                          <tr key={c.slug}>
                            <td className="font-semibold">{c.name}</td>
                            <td>
                              <NanoLabsChip severity={c.enabled ? "success" : "neutral"}>
                                {c.enabled ? "Habilitada" : "Desactivada"}
                              </NanoLabsChip>
                            </td>
                            <td>
                              <NanoLabsChip severity={c.enabled && c.credentialConfigured ? "success" : "neutral"}>
                                {c.enabled && c.credentialConfigured ? "Configurada" : "Pendiente"}
                              </NanoLabsChip>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}
      </NanoLabsTabs>
    </div>
  );
}
