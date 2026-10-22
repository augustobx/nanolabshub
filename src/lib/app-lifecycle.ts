import { KNOWN_APPS } from "./apps-registry";
import { getDatabase } from "./db";
import { executeRemoteCommand } from "./ssh";

export type LifecycleState = "active" | "suspended" | "pending_retirement" | "archived";
export type LifecycleAction = "suspend" | "resume" | "pending_retirement" | "archive";

interface LifecycleRecord {
  slug: string; state: LifecycleState; updatedAt: string;
  updatedBy: string; note: string; restorePlan: string | null;
}
interface DockerContainer {
  Name: string;
  State: { Running: boolean; Status: string };
  HostConfig: { RestartPolicy: { Name: string; MaximumRetryCount: number } };
}
interface RestoreItem { name: string; restart: string; wasRunning: boolean }

const held = new Set<string>();
const quote = (s: string) => "'" + s.replace(/'/g, "'\\''") + "'";
const protectedSlugs = new Set(["nanolabshub"]);
const stateLabels: Record<LifecycleState, string> = {
  active: "Activa", suspended: "Suspendida",
  pending_retirement: "Baja pendiente", archived: "Archivada",
};

function database() {
  const db = getDatabase();
  if (db.type !== "sqlite" || typeof db.getLifecycleStates !== "function" ||
      typeof db.saveLifecycleState !== "function") {
    throw new Error("Acciones bloqueadas: SQLite persistente no disponible.");
  }
  return db;
}

export function getLifecycleRecords(): Map<string, LifecycleRecord> {
  return new Map((database().getLifecycleStates() as LifecycleRecord[]).map((r) => [r.slug, r]));
}

export function getLifecycleHistory(slug: string) {
  if (!KNOWN_APPS.some((app) => app.slug === slug)) throw new Error("Aplicación no registrada");
  return database().getLifecycleHistory(slug, 40);
}

export function appLifecycle(slug: string, records: Map<string, LifecycleRecord>) {
  const record = records.get(slug);
  return {
    state: record?.state || "active" as LifecycleState,
    updatedAt: record?.updatedAt || null,
    updatedBy: record?.updatedBy || null,
    note: record?.note || "",
  };
}

function ensureManaged(slug: string) {
  const app = KNOWN_APPS.find((a) => a.slug === slug);
  if (!app) throw new Error("Aplicación fuera del registro permitido");
  if (app.type === "infrastructure" || protectedSlugs.has(slug)) {
    throw new Error("Esta aplicación es infraestructura crítica y no puede desactivarse desde el Hub");
  }
  if (!app.containerNames.length || app.containerNames.some((name) => !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(name))) {
    throw new Error("Inventario de contenedores incompleto");
  }
  if (app.containerNames.some((name) => KNOWN_APPS.some((other) =>
    other.slug !== slug && other.containerNames.includes(name)))) {
    throw new Error("Contenedor compartido: la desactivación automática no es segura");
  }
  return app;
}

async function docker(command: string) {
  const { stdout, stderr, code } = await executeRemoteCommand(command);
  if (code !== 0) throw new Error("Docker rechazó la acción: " + (stderr || stdout || "error desconocido").slice(0, 350));
  return stdout;
}

async function inspect(names: string[]) {
  // Missing containers are NOT silently interpreted as successfully stopped.
  const available = (await docker("docker ps -a --format '{{.Names}}'")).split("\n");
  const targets = names.filter((name) => available.includes(name));
  if (!targets.length) return [] as DockerContainer[];
  const raw = await docker("docker inspect --type container " + targets.map(quote).join(" "));
  const data = JSON.parse(raw) as DockerContainer[];
  if (!Array.isArray(data)) throw new Error("Docker inspect devolvió información inválida");
  return data;
}

function restartName(item: DockerContainer) {
  const policy = item.HostConfig?.RestartPolicy;
  const name = policy?.Name || "no";
  if (!["no", "always", "unless-stopped", "on-failure"].includes(name)) {
    throw new Error("Política de reinicio Docker no reconocida");
  }
  return name === "on-failure" && policy.MaximumRetryCount > 0
    ? name + ":" + policy.MaximumRetryCount : name;
}

function validatePlan(raw: string | null): RestoreItem[] | null {
  if (!raw) return null;
  const plan = JSON.parse(raw) as RestoreItem[];
  if (!Array.isArray(plan) || plan.some((item) =>
    typeof item.name !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(item.name) ||
    typeof item.wasRunning !== "boolean" || !/^(no|always|unless-stopped|on-failure(?::\d+)?)$/.test(item.restart)
  )) throw new Error("Plan de restauración guardado inválido");
  return plan;
}

async function stopApp(slug: string, names: string[], actor: string, oldState: LifecycleState, saved: string | null) {
  const inspected = await inspect(names);
  const savedPlan = validatePlan(saved);
  // Do not overwrite the original restart policy during a second stop attempt.
  const plan = savedPlan || inspected.map((c) => ({
    name: c.Name.replace(/^\//, ""), restart: restartName(c), wasRunning: c.State.Running,
  }));
  if (plan.some((item) => !names.includes(item.name))) throw new Error("Plan contiene contenedores no autorizados");
  database().stageLifecycleRestorePlan(slug, oldState, actor, JSON.stringify(plan));

  // Prevent automatic restart after a host reboot (restart=always / unless-stopped).
  for (const c of inspected) {
    await docker("docker update --restart=no " + quote(c.Name.replace(/^\//, "")));
  }
  for (const name of names) {
    if (inspected.some((c) => c.Name.replace(/^\//, "") === name && c.State.Running)) {
      await docker("docker stop --time 25 " + quote(name));
    }
  }
  const after = await inspect(names);
  if (after.some((c) => c.State.Running)) throw new Error("No se pudieron detener todos los contenedores");
  return { plan: JSON.stringify(plan), stopped: inspected.filter((c) => c.State.Running).length, existing: inspected.length };
}

async function startApp(names: string[], rawPlan: string | null) {
  const plan = validatePlan(rawPlan);
  if (!plan) throw new Error("No hay plan de recuperación: la app no fue suspendida por el Hub");
  const current = await inspect(names);
  const available = new Set(current.map((c) => c.Name.replace(/^\//, "")));
  if (plan.some((item) => !available.has(item.name))) {
    throw new Error("Faltan contenedores; el Hub no puede recrearlos automáticamente");
  }
  // Start databases and caches before application processes.
  const ordered = [...plan].sort((a, b) => {
    const rank = (name: string) => /(?:^|[-_])(db|postgres|mariadb|mysql|redis)(?:$|[-_])/.test(name) ? 0 : 1;
    return rank(a.name) - rank(b.name);
  });
  for (const item of ordered) {
    if (item.wasRunning) {
      await docker("docker start " + quote(item.name));
      // Wait for DB health where an explicit Docker healthcheck exists.
      if (/(?:^|[-_])(db|postgres|mariadb|mysql|redis)(?:$|[-_])/.test(item.name)) {
        const cmd = "for n in $(seq 1 20); do h=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' " + quote(item.name) + "); case \"$h\" in healthy|none) exit 0;; unhealthy) exit 1;; esac; sleep 2; done; exit 1";
        await docker(cmd);
      }
    }
  }
  for (const item of plan) {
    await docker("docker update --restart=" + quote(item.restart) + " " + quote(item.name));
  }
  return { started: plan.filter((item) => item.wasRunning).length, restoredPolicies: plan.length };
}

export async function changeLifecycle(input: {
  slug: string; action: LifecycleAction; actor: string;
  confirmation?: string; acknowledgeBackup?: boolean; note?: string;
}) {
  const app = ensureManaged(input.slug);
  if (held.has(app.slug)) throw new Error("Ya existe una operación en curso para esta aplicación");
  if (input.confirmation !== app.slug) throw new Error("Escribí el identificador exacto de la aplicación para confirmar");
  if (input.action === "archive" && input.acknowledgeBackup !== true) {
    throw new Error("Confirmá que los backups todavía no fueron verificados automáticamente");
  }
  if ((input.note || "").length > 250) throw new Error("Motivo demasiado largo");

  held.add(app.slug);
  try {
    const db = database();
    const record = getLifecycleRecords().get(app.slug);
    const previous: LifecycleState = record?.state || "active";
    if (previous === "archived" && input.action !== "resume") throw new Error("Ya se encuentra archivada");
    if (previous === "suspended" && input.action === "suspend") throw new Error("Ya está suspendida");
    if (previous === "active" && input.action === "resume") throw new Error("Ya está activa");
    if (previous === "pending_retirement" && input.action === "pending_retirement") {
      throw new Error("Ya está marcada como baja pendiente");
    }

    let next: LifecycleState = previous;
    let restorePlan = record?.restorePlan || null;
    let details = "";
    if (input.action === "pending_retirement") {
      next = "pending_retirement";
      details = "Baja pendiente: sin modificar Docker; se excluye de alertas web.";
    } else if (input.action === "suspend" || input.action === "archive") {
      const result = await stopApp(app.slug, app.containerNames, input.actor, previous, restorePlan);
      restorePlan = result.plan;
      next = input.action === "archive" ? "archived" : "suspended";
      details = "Docker: " + result.stopped + " detenidos de " + result.existing +
        " existentes. Políticas de reinicio desactivadas. Volúmenes, imágenes, carpetas, backups y proxy conservados.";
    } else if (input.action === "resume") {
      if (restorePlan) {
        const result = await startApp(app.containerNames, restorePlan);
        details = "Docker: " + result.started + " reactivados, " + result.restoredPolicies + " políticas restauradas.";
      } else if (previous === "pending_retirement") {
        details = "Cancelada baja pendiente: Docker no se modificó.";
      } else {
        throw new Error("No hay plan de restauración para reactivar esta app");
      }
      restorePlan = null;
      next = "active";
    } else {
      throw new Error("Acción no permitida");
    }
    db.saveLifecycleState({
      slug: app.slug, state: next, actor: input.actor, action: input.action,
      oldState: previous, note: input.note?.trim() || "",
      details, restorePlan,
    });
    return { slug: app.slug, from: previous, to: next, label: stateLabels[next], details };
  } finally {
    held.delete(app.slug);
  }
}
