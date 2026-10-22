import { executeRemoteCommand } from "./ssh";
import { KNOWN_APPS, AppDefinition } from "./apps-registry";
import { ServerMetrics, ContainerInfo, AppInfo, BackupRecord } from "./types";

/**
 * Parses and returns live server hardware and system telemetry
 */
export async function getServerTelemetry(): Promise<ServerMetrics> {
  // A real host sample: never turn a failed read into a healthy-looking example value.
  // /host/proc is bind-mounted read-only from the dedicated Linux host.
  const script = String.raw`python3 - <<'PY'
import json, os, shutil, socket, subprocess, time

proc = '/host/proc' if os.path.exists('/host/proc/stat') else '/proc'

def cpu_sample():
    with open(proc + '/stat') as f:
        values = [int(x) for x in f.readline().split()[1:]]
    return sum(values), values[3] + values[4]

try:
    with open(proc + '/cpuinfo') as cpu_file:
        cpu_model = next((line.split(':', 1)[1].strip()
                          for line in cpu_file if line.lower().startswith('model name')), None)
except OSError:
    cpu_model = None

total1, idle1 = cpu_sample()
time.sleep(0.25)
total2, idle2 = cpu_sample()
delta = total2 - total1
cpu_pct = round(100 * (1 - (idle2 - idle1) / delta), 1) if delta > 0 else 0

with open(proc + '/meminfo') as f:
    mem = {key.strip(): int(value.split()[0]) * 1024
           for line in f if ':' in line
           for key, value in [line.split(':', 1)]}
total = mem['MemTotal']
available = mem['MemAvailable']
swap_total = mem.get('SwapTotal', 0)
swap_used = swap_total - mem.get('SwapFree', 0)

with open(proc + '/uptime') as f:
    up_seconds = int(float(f.read().split()[0]))
days, rem = divmod(up_seconds, 86400)
hours, rem = divmod(rem, 3600)
minutes = rem // 60

# /opt/apps is the actual host filesystem mounted in the Hub container.
disk_path = '/opt/apps' if os.path.ismount('/opt/apps') else '/'
disk = shutil.disk_usage(disk_path)

info = subprocess.check_output(
    ['docker', 'info', '--format',
     '{{.Name}}|||{{.ServerVersion}}|||{{.Containers}}|||{{.ContainersRunning}}|||{{.ContainersPaused}}|||{{.ContainersStopped}}'],
    text=True, timeout=8).strip().split('|||')
if len(info) != 6:
    raise RuntimeError('Docker returned incomplete server information')

data = {
    'hostname': info[0],
    'uptime': f'{days}d {hours}h {minutes}m',
    'osInfo': os.uname().sysname + ' ' + os.uname().release,
    'cpu': {'cores': os.cpu_count(), 'model': cpu_model, 'usagePercent': cpu_pct,
            'loadAvg': [round(n, 2) for n in os.getloadavg()]},
    'memory': {
        'totalBytes': total, 'usedBytes': total - available, 'freeBytes': available,
        'usedPercent': round(100 * (total - available) / total, 1),
        'swapTotalBytes': swap_total, 'swapUsedBytes': swap_used,
        'swapUsedPercent': round(100 * swap_used / swap_total, 1) if swap_total else 0
    },
    'disks': [{
        'filesystem': 'Host filesystem', 'mount': disk_path,
        'totalBytes': disk.total, 'usedBytes': disk.used,
        'freeBytes': disk.free, 'usedPercent': round(100 * disk.used / disk.total, 1)
    }],
    'docker': {
        'version': info[1], 'containersTotal': int(info[2]),
        'containersRunning': int(info[3]), 'containersPaused': int(info[4]),
        'containersStopped': int(info[5])
    },
    'timestamp': __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat()
}
print(json.dumps(data))
PY`;
  const { stdout, stderr, code } = await executeRemoteCommand(script);
  if (code !== 0 || !stdout) throw new Error(`No se pudo leer el estado real del servidor: ${stderr || 'sin datos'}`);
  try {
    return JSON.parse(stdout) as ServerMetrics;
  } catch {
    throw new Error("La telemetría real devolvió un formato incorrecto");
  }
}

/**
 * Fetches all live Docker containers on the server
 */
export async function getContainers(): Promise<ContainerInfo[]> {
  const cmd = `docker ps -a --format '{{.ID}}|||{{.Names}}|||{{.Image}}|||{{.Status}}|||{{.Ports}}|||{{.CreatedAt}}'`;
  const { stdout, stderr, code } = await executeRemoteCommand(cmd);
  if (code !== 0) throw new Error(`No se pudo consultar Docker: ${stderr || "error desconocido"}`);
  if (!stdout) return [];

  const stats = new Map<string, { cpuPercent: string; memoryUsage: string }>();
  // Live Docker statistics, with no fabricated percentages on timeout or error.
  const sample = await executeRemoteCommand("timeout 8 docker stats --no-stream --format '{{.Name}}|||{{.CPUPerc}}|||{{.MemUsage}}'");
  if (sample.code === 0) {
    for (const line of sample.stdout.split("\n").filter(Boolean)) {
      const [name, cpuPercent, memoryUsage] = line.split("|||");
      if (name) stats.set(name, { cpuPercent, memoryUsage });
    }
  }

  const lines = stdout.split("\n").filter(Boolean);
  return lines.map((line) => {
    const [id, name, image, status, ports, created] = line.split("|||");
    let state: ContainerInfo["state"] = "unknown";
    if (status.toLowerCase().includes("up")) state = "running";
    else if (status.toLowerCase().includes("exited")) state = "exited";
    else if (status.toLowerCase().includes("restarting")) state = "restarting";
    else if (status.toLowerCase().includes("paused")) state = "paused";

    let health: ContainerInfo["health"] = "none";
    if (status.includes("(healthy)")) health = "healthy";
    else if (status.includes("(unhealthy)")) health = "unhealthy";
    else if (status.includes("(health: starting)")) health = "starting";

    return {
      id: id || "",
      name: name || "",
      image: image || "",
      status: status || "",
      state,
      health,
      ports: ports || "",
      created: created ? created.split(" ")[0] : "",
      ...stats.get(name || ""),
      isJob: /(?:^|[-_])(migrate|database-init)(?:[-_]\d+)?$/i.test(name || ""),
      exitCode: /Exited \((\d+)\)/i.test(status) ? Number(status.match(/Exited \((\d+)\)/i)?.[1]) : null,
    };
  });
}

/**
 * Fetches the complete software inventory across /opt/apps and /opt/infrastructure
 */
export async function getAppsStatus(containersInput?: ContainerInfo[]): Promise<AppInfo[]> {
  const containers = containersInput ?? await getContainers();

  // Read the checkout HEAD even when detached, preserving errors rather than faking "clean".
  const appPaths = Buffer.from(JSON.stringify(KNOWN_APPS.map(({ slug, path }) => ({ slug, path })))).toString("base64");
  const gitScript = `python3 - <<'PY'
import os, json, base64, subprocess
apps = json.loads(base64.b64decode("${appPaths}").decode())
def git(p, *args):
    try:
        r = subprocess.run(["git", "-C", p, *args], text=True, capture_output=True, timeout=4)
        return r.stdout.strip(), r.stderr.strip(), r.returncode
    except (OSError, subprocess.TimeoutExpired) as e:
        return "", str(e), 1
results = []
for app in apps:
    p = app["path"]
    has_compose = any(os.path.isfile(os.path.join(p, filename))
                      for filename in ("compose.yml", "docker-compose.yml", "docker-compose.yaml"))
    is_repo = os.path.exists(os.path.join(p, ".git"))
    record = {"slug": app["slug"], "isRepo": is_repo, "branch": "",
              "commitHash": "", "commitMessage": "", "commitAuthor": "",
              "commitDate": "", "dirtyFilesCount": 0, "hasCompose": has_compose,
              "localError": None}
    if is_repo:
        head, err, code = git(p, "rev-parse", "--verify", "HEAD")
        if code or len(head) != 40:
            record["localError"] = (err or "No se pudo leer HEAD")[:180]
        else:
            record["commitHash"] = head
            branch, _, branch_code = git(p, "symbolic-ref", "--quiet", "--short", "HEAD")
            record["branch"] = branch if branch_code == 0 and branch else "detached"
            details, _, detail_code = git(p, "log", "-1", "--format=%s%x1f%an%x1f%ad", "--date=short")
            if detail_code == 0:
                fields = details.split(chr(31))
                if len(fields) == 3:
                    record["commitMessage"], record["commitAuthor"], record["commitDate"] = fields
            dirty, stderr, status_code = git(p, "status", "--porcelain")
            if status_code:
                record["localError"] = (stderr or "No se pudo consultar Git status")[:180]
            else:
                record["dirtyFilesCount"] = len(dirty.splitlines()) if dirty else 0
    results.append(record)
print(json.dumps(results))
PY`;
  const { stdout: gitRaw, stderr: gitError, code: gitCode } = await executeRemoteCommand(gitScript);
  if (gitCode !== 0) throw new Error(`No se pudo consultar el inventario Git: ${gitError || "sin salida"}`);
  const gitRecords = JSON.parse(gitRaw) as Array<{
    slug: string; isRepo: boolean; branch: string; commitHash: string;
    commitMessage: string; commitAuthor: string; commitDate: string;
    dirtyFilesCount: number; hasCompose: boolean; localError: string | null;
  }>;
  const gitMap = new Map(gitRecords.map((record) => [record.slug, record]));

  return KNOWN_APPS.map((app) => {
    const gitData = gitMap.get(app.slug) || {
      isRepo: false,
      branch: "-",
      commitHash: "-",
      commitMessage: "-",
      commitAuthor: "-",
      commitDate: "-",
      dirtyFilesCount: 0,
      hasCompose: false,
      localError: null,
    };

    // Match associated containers
    const appContainers = containers.filter((c) =>
      app.containerNames.some((name) => c.name === name || c.name.startsWith(`${name}-`))
    );

    // Compute health
    let status: AppInfo["status"] = "operational";
    if (appContainers.length === 0) {
      status = "not_deployed";
    } else if (appContainers.some((c) => c.state !== "running" || c.health === "unhealthy")) {
      status = "degraded";
    }

    return {
      slug: app.slug,
      name: app.name,
      path: app.path,
      type: app.type,
      url: app.url,
      git: {
        isRepo: gitData.isRepo,
        branch: gitData.branch,
        commitHash: gitData.commitHash,
        commitMessage: gitData.commitMessage,
        commitDate: gitData.commitDate,
        commitAuthor: gitData.commitAuthor,
        dirtyFilesCount: gitData.dirtyFilesCount,
        localError: gitData.localError || null,
      },
      containers: appContainers,
      database: {
        type: app.dbType,
        host: app.dbContainer,
        port: app.dbPort,
      },
      hasDockerCompose: gitData.hasCompose,
      status,
    };
  });
}

/**
 * Fetches all backups from /opt/backups
 */
export async function getBackupsList(): Promise<BackupRecord[]> {
  const script = `
    echo Qap.1029Qap.1029 | sudo -S find /opt/backups -type f \\( -name "*.sql.gz" -o -name "*.sql" -o -name "*.dump" -o -name "*.sqlite" \\) -printf "%p|||%s|||%T+ \\n" 2>/dev/null
  `;

  const { stdout } = await executeRemoteCommand(script);
  if (!stdout) return [];

  const lines = stdout.split("\n").filter((l) => l.includes("|||"));
  return lines.map((line, idx) => {
    const [fullPath, sizeStr, dateStr] = line.split("|||");
    const filename = fullPath.split("/").pop() || "";
    const sizeBytes = parseInt(sizeStr || "0", 10);

    // Determine app slug
    let appSlug = "system";
    for (const app of KNOWN_APPS) {
      if (fullPath.includes(`/${app.slug}/`) || filename.toLowerCase().includes(app.slug)) {
        appSlug = app.slug;
        break;
      }
    }
    const appDef = KNOWN_APPS.find((a) => a.slug === appSlug);

    // Format size
    const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
    const sizeFormatted = sizeBytes > 1024 * 1024 ? `${sizeMB} MB` : `${Math.round(sizeBytes / 1024)} KB`;

    return {
      id: `backup-${idx}-${filename}`,
      appSlug,
      appName: appDef ? appDef.name : appSlug,
      dbType: appDef ? appDef.dbType : "database",
      filename,
      path: fullPath,
      sizeBytes,
      sizeFormatted,
      createdAt: dateStr ? dateStr.split(".")[0].replace("T", " ") : "Desconocido",
      status: sizeBytes > 1024 ? "verified" : "failed",
      storageLocation: "local",
    };
  });
}

/**
 * Triggers a deployment for a specific app: git pull && docker compose up -d --build
 */
export async function deployApp(slug: string): Promise<string> {
  const app = KNOWN_APPS.find((a) => a.slug === slug);
  if (!app) throw new Error(`App ${slug} no encontrada en el registro`);

  const cmd = `
    cd "${app.path}" && \\
    echo "=== [1/4] GIT STATUS PRE-PULL ===" && \\
    git status -s && \\
    echo "=== [2/4] GIT PULL ===" && \\
    git pull origin $(git branch --show-current) && \\
    echo "=== [3/4] DOCKER COMPOSE REBUILD & UP ===" && \\
    docker compose up -d --build && \\
    echo "=== [4/4] DOCKER COMPOSE PS ===" && \\
    docker compose ps
  `;

  const { stdout, stderr, code } = await executeRemoteCommand(cmd);
  if (code !== 0) {
    throw new Error(`Error durante el despliegue de ${app.name}:\n${stderr || stdout}`);
  }

  return stdout;
}

/**
 * Restarts a docker container
 */
export async function restartContainer(containerName: string): Promise<string> {
  const cmd = `docker restart "${containerName}" && docker ps --filter "name=${containerName}"`;
  const { stdout, stderr, code } = await executeRemoteCommand(cmd);
  if (code !== 0) {
    throw new Error(`Error reiniciando contenedor ${containerName}: ${stderr}`);
  }
  return stdout;
}

/**
 * Streams tail logs of a container
 */
export async function getContainerLogs(containerName: string, lines = 100): Promise<string> {
  const cmd = `docker logs --tail=${lines} --timestamps "${containerName}" 2>&1`;
  const { stdout } = await executeRemoteCommand(cmd);
  return stdout || "No hay logs disponibles o el contenedor no ha generado salida.";
}
