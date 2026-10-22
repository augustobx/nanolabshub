export interface ServerMetrics {
  hostname: string;
  uptime: string;
  osInfo: string;
  cpu: {
    cores: number;
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
    remoteAhead?: number;
    remoteBehind?: number;
  };
  containers: ContainerInfo[];
  database?: {
    type: "postgres" | "mysql" | "mariadb" | "sqlite" | "none";
    host?: string;
    port?: number;
    lastBackup?: string;
    backupSize?: string;
    backupStatus?: "success" | "warning" | "error";
  };
  hasDockerCompose: boolean;
  status: "operational" | "degraded" | "down" | "deploying";
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

