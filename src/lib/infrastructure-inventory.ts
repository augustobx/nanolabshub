import { KNOWN_APPS } from "./apps-registry";
import { getOperationsSnapshot } from "./operations";
import type { AppInfo, ContainerInfo } from "./types";

export type ComponentKind = "core" | "database" | "service" | "worker" | "unassigned";
export interface InfrastructureComponent {
  name: string;
  owner: string | null;
  appName: string | null;
  kind: ComponentKind;
  state: ContainerInfo["state"];
  health: ContainerInfo["health"];
  expectedStopped: boolean;
  image: string;
  ports: string;
}
function hasWord(value: string, word: string) {
  return new RegExp("(^|[-_])" + word + "($|[-_])", "i").test(value);
}
export function classifyContainer(name: string, owner: AppInfo | undefined): ComponentKind {
  if (!owner) return "unassigned";
  if (owner.type === "infrastructure" || owner.slug === "nanolabshub") return "core";
  const definition = KNOWN_APPS.find(app => app.slug === owner.slug);
  if (name === definition?.dbContainer || ["db", "mysql", "postgres", "postgresql", "mariadb", "redis"].some(part=>hasWord(name,part))) return "database";
  if (["worker", "collector", "detector", "cron", "scheduler", "queue"].some(part=>hasWord(name,part))) return "worker";
  return "service";
}
export async function getInfrastructureInventory() {
  const snapshot = await getOperationsSnapshot();
  const apps = snapshot.apps;
  const containers: InfrastructureComponent[] = snapshot.containers.map(container => {
    const owner = apps.find(app => app.containers.some(item => item.name === container.name));
    const state = owner?.lifecycle?.state || "active";
    return {
      name: container.name, owner: owner?.slug || null,
      appName: owner?.name || null,
      kind: classifyContainer(container.name, owner),
      state: container.state, health: container.health,
      expectedStopped: state === "archived" || state === "suspended",
      image: container.image, ports: container.ports,
    };
  });
  const domains = apps
    .filter(app => app.url?.startsWith("https://"))
    .map(app => ({
      slug:app.slug, appName:app.name, url:app.url!, lifecycle:app.lifecycle?.state||"active",
      status:app.web?.status||"unknown", httpStatus:app.web?.httpStatus||null,
      checkedAt:app.web?.checkedAt||null, source:"registry_probe" as const,
    }));
  return {
    timestamp:snapshot.timestamp, host:snapshot.telemetry,
    groups:{
      core:containers.filter(c=>c.kind==="core"),
      database:containers.filter(c=>c.kind==="database"),
      service:containers.filter(c=>c.kind==="service"),
      worker:containers.filter(c=>c.kind==="worker"),
      unassigned:containers.filter(c=>c.kind==="unassigned"),
    },
    containers, domains,
    totals:{
      running:containers.filter(c=>c.state==="running").length,
      unhealthy:containers.filter(c=>!c.expectedStopped && (c.health==="unhealthy" || c.state==="exited")).length,
      unassigned:containers.filter(c=>c.kind==="unassigned").length,
      databases:containers.filter(c=>c.kind==="database").length,
      domains:domains.length,
    }
  };
}
