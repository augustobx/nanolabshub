export interface ServerMetrics {
  hostname: string;
  uptime: string;
  osInfo: string;
  cpu: {
    cores: number;
    model?: string | null;
    usagePercent: number;
    loadAvg: [number, number, number];
  };
  memory: {
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    usedPercent: number;
    swapTotalBytes: number;
    swapUsedBytes: number;
    swapUsedPercent: number;
  };
  disks: Array<{
    filesystem: string;
    mount: string;
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    usedPercent: number;
  }>;
  docker: {
    version: string;
    containersTotal: number;
    containersRunning: number;
    containersPaused: number;
    containersStopped: number;
  };
  timestamp: string;
}

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: string;
  state: "running" | "exited" | "restarting" | "paused" | "unknown";
  health: "healthy" | "unhealthy" | "starting" | "none";
  ports: string;
  created: string;
  cpuPercent?: string;
  memoryUsage?: string;
  deployedRevision?: string | null;
  imageId?: string | null;
  exitCode?: number | null;
  isJob?: boolean;
}

export interface AppInfo {
  slug: string;
  name: string;
  path: string;
  type: "saas" | "infrastructure" | "internal" | "client";
  url?: string;
  git: {
    isRepo: boolean;
    branch: string;
    commitHash: string;
    commitMessage: string;
    commitDate: string;
    commitAuthor: string;
    dirtyFilesCount: number;
    remoteCommit?: string | null;
    remoteStatus?: "synced" | "different" | "unavailable" | "not_repo";
    remoteCheckedAt?: string | null;
    remoteRef?: string | null;
    remoteError?: string | null;
    localError?: string | null;
    remoteAhead?: number;
    remoteBehind?: number;
  };
  containers: ContainerInfo[];
  lifecycle?: {
    state: "active" | "suspended" | "pending_retirement" | "archived";
    updatedAt: string | null;
    updatedBy: string | null;
    note: string;
  };
  database?: {
    type: "postgres" | "mysql" | "mariadb" | "sqlite" | "none";
    host?: string;
    port?: number;
    lastBackup?: string;
    backupSize?: string;
    backupStatus?: "success" | "warning" | "error";
  };
  deployment?: { revision: string | null; imageId: string | null; imageTag?: string | null; status: "identified" | "unidentified" | "not_running" };
  web?: { status: "online" | "restricted" | "http_error" | "offline" | "unknown"; httpStatus: number | null; latencyMs: number | null; checkedAt: string | null };
  hasDockerCompose: boolean;
  status: "operational" | "degraded" | "down" | "deploying" | "not_deployed";
}

export interface BackupRecord {
  id: string;
  appSlug: string;
  appName: string;
  dbType: string;
  filename: string;
  path: string;
  sizeBytes: number;
  sizeFormatted: string;
  createdAt: string;
  status: "verified" | "unverified" | "failed";
  storageLocation: "local" | "cloud_synced";
  checksum?: string | null;
  integrityStatus?: "running" | "integrity_ok" | "failed";
  error?: string | null;
  trigger?: "manual" | "scheduled";
  restoreTested?: boolean;
}

export type SaaSSlug = "onlyfood" | "onlypadel" | "onlycars" | "onlygym" | "onlyturn" | "onlyerp";

export interface UniversalTenant {
  id: string;
  saas: SaaSSlug;
  saasName: string;
  slug: string;
  name: string;
  status: "ACTIVE" | "TRIAL" | "SUSPENDED" | "CANCELED";
  rawStatus: string;
  plan: string;
  planExpiresAt?: string | null;
  createdAt: string;
  domain: string;
  adminEmail?: string;
  metrics: {
    totalRecords: number;
    recordLabel: string;
    secondaryMetric?: {
      label: string;
      value: number;
    };
  };
  modules: Record<string, boolean>;
}

export interface GovernanceOverview {
  totalTenants: number;
  activeTenants: number;
  trialTenants: number;
  suspendedTenants: number;
  saasCount: number;
  totalRecordsManaged: number;
  tenants: UniversalTenant[];
  legacyPanels: Array<{
    saas: string;
    legacyAdminUrl: string;
    sunsetStatus: "redirected_to_hub" | "active_deprecated" | "planned";
    replacementUrl: string;
    notes: string;
  }>;
}

