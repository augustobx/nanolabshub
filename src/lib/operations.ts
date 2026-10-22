import { executeRemoteCommand } from "./ssh";
import { KNOWN_APPS } from "./apps-registry";
import { getAppsStatus, getContainers, getServerTelemetry } from "./server-api";
import type { AppInfo, ContainerInfo, ServerMetrics } from "./types";

interface VersionProbe {
  remoteCommit: string | null;
  checkedAt: string | null;
}
interface ImageProbe {
  revision: string | null;
  imageId: string | null;
}
const shellQuote = (value: string) => "'" + value.replace(/'/g, "'\\''") + "'";
const validCommit = (value: string | undefined): value is string =>
  Boolean(value && /^[0-9a-f]{40}$/i.test(value));
const isSafeBranch = (value: string): boolean =>
  /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,180}$/.test(value) && !value.includes("..");

let versionsCache: { expires: number; data: Map<string, VersionProbe> } | null = null;
let versionsPending: Promise<Map<string, VersionProbe>> | null = null;

async function probeGitRemote(apps: AppInfo[]): Promise<Map<string, VersionProbe>> {
  const now = Date.now();
  if (versionsCache && versionsCache.expires > now) return versionsCache.data;
  if (versionsPending) return versionsPending;
  versionsPending = (async () => {
    const map = new Map<string, VersionProbe>();
    const candidates = apps.filter((app) => app.git.isRepo && isSafeBranch(app.git.branch));
    // Limit network concurrency and each remote lookup to 3 seconds.
    for (let i = 0; i < candidates.length; i += 5) {
      await Promise.all(candidates.slice(i, i + 5).map(async (app) => {
        const cmd = `timeout 3 git -C ${shellQuote(app.path)} ls-remote --heads origin ${shellQuote("refs/heads/" + app.git.branch)}`;
        const result = await executeRemoteCommand(cmd);
        const commit = result.code === 0 ? result.stdout.split(/\s/)[0] : "";
        map.set(app.slug, {
          remoteCommit: validCommit(commit) ? commit : null,
          checkedAt: new Date().toISOString(),
        });
      }));
    }
    versionsCache = { expires: Date.now() + 180_000, data: map };
    return map;
  })();
  try {
    return await versionsPending;
  } finally {
    versionsPending = null;
  }
}

async function readDeployedRevisions(containers: ContainerInfo[]): Promise<Map<string, ImageProbe>> {
  const map = new Map<string, ImageProbe>();
  const ids = containers.map((container) => container.id).filter((id) => /^[a-f0-9]{12,64}$/i.test(id));
  if (!ids.length) return map;
  const cmd = `docker inspect --type container --format '{{.Name}}|||{{.Image}}|||{{index .Config.Labels "org.opencontainers.image.revision"}}' ${ids.join(" ")}`;
  const result = await executeRemoteCommand(cmd);
  if (result.code !== 0) return map;
  for (const line of result.stdout.split("\n").filter(Boolean)) {
    const [rawName, imageId, label] = line.split("|||");
    const name = rawName?.replace(/^\//, "");
    if (name) {
      map.set(name, {
        imageId: imageId || null,
        revision: validCommit(label) ? label : null,
      });
    }
  }
  return map;
}

async function probeWebsite(url: string | undefined): Promise<AppInfo["web"]> {
  const checkedAt = new Date().toISOString();
  // Only configured public HTTPS URLs; loopback addresses cannot represent a public check.
  if (!url || !url.startsWith("https://")) {
    return { status: "unknown", httpStatus: null, latencyMs: null, checkedAt };
  }
  const started = Date.now();
  try {
    let response = await fetch(url, {
      method: "HEAD", signal: AbortSignal.timeout(4500),
      cache: "no-store", redirect: "follow",
    });
    if (response.status === 405 || response.status === 501) {
      response = await fetch(url, {
        method: "GET", signal: AbortSignal.timeout(4500),
        cache: "no-store", redirect: "follow",
      });
      void response.body?.cancel();
    }
    return {
      status: response.status === 401 || response.status === 403 ? "restricted"
        : response.ok ? "online" : "offline",
      httpStatus: response.status,
      latencyMs: Date.now() - started,
      checkedAt,
    };
  } catch {
    return { status: "offline", httpStatus: null, latencyMs: null, checkedAt };
  }
}

export async function getOperationalApps(containersInput?: ContainerInfo[]): Promise<AppInfo[]> {
  const containers = containersInput ?? await getContainers();
  const apps = await getAppsStatus(containers);
  const [remotes, images, sites] = await Promise.all([
    probeGitRemote(apps),
    readDeployedRevisions(containers),
    Promise.all(apps.map((app) => probeWebsite(app.url))),
  ]);
  return apps.map((app, index) => {
    const source = remotes.get(app.slug);
    const localCommit = app.git.commitHash;
    const remoteCommit = source?.remoteCommit ?? null;
    const mainContainerName = KNOWN_APPS.find((item) => item.slug === app.slug)?.containerNames[0];
    const firstRunning = app.containers.find((container) =>
      container.state === "running" && mainContainerName &&
      (container.name === mainContainerName || container.name.startsWith(`${mainContainerName}-`))
    ) ?? app.containers.find((container) => container.state === "running");
    const image = firstRunning ? images.get(firstRunning.name) : undefined;
    return {
      ...app,
      git: {
        ...app.git, remoteCommit, remoteCheckedAt: source?.checkedAt ?? null,
        remoteStatus: !app.git.isRepo ? "not_repo"
          : !remoteCommit ? "unavailable"
          : validCommit(localCommit) && remoteCommit === localCommit ? "synced" : "different",
      },
      deployment: {
        revision: image?.revision ?? null, imageId: image?.imageId ?? null,
        status: !firstRunning ? "not_running" : image?.revision ? "identified" : "unidentified",
      },
      web: sites[index],
    };
  });
}

export interface OperationsSnapshot {
  timestamp: string;
  telemetry: ServerMetrics;
  containers: ContainerInfo[];
  apps: AppInfo[];
}

export async function getOperationsSnapshot(): Promise<OperationsSnapshot> {
  const [telemetry, containers] = await Promise.all([getServerTelemetry(), getContainers()]);
  const apps = await getOperationalApps(containers);
  return { timestamp: new Date().toISOString(), telemetry, containers, apps };
}
