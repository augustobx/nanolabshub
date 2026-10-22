import { getServerTelemetry, getContainers } from "./server-api";
import { getDatabase } from "./db";

export interface SystemAlert {
  id: string;
  level: "critical" | "warning" | "info";
  title: string;
  message: string;
  source: string;
  timestamp: string;
}

/**
 * Scans production environment and evaluates potential risks
 */
export async function evaluateSystemAlerts(): Promise<SystemAlert[]> {
  const alerts: SystemAlert[] = [];
  const now = new Date().toISOString();

  try {
    const [telemetry, containers] = await Promise.all([
      getServerTelemetry().catch(() => null),
      getContainers().catch(() => []),
    ]);

    if (telemetry) {
      // 1. Disk usage evaluation
      const mainDisk = telemetry.disks[0];
      if (mainDisk && mainDisk.usedPercent > 85) {
        alerts.push({
          id: "alert-disk-critical",
          level: "critical",
          title: "Espacio en Disco Crítico",
          message: `El disco NVMe principal (${mainDisk.mount}) está al ${mainDisk.usedPercent}% de capacidad.`,
          source: "Infraestructura",
          timestamp: now,
        });
      } else if (mainDisk && mainDisk.usedPercent > 75) {
        alerts.push({
          id: "alert-disk-warning",
          level: "warning",
          title: "Espacio en Disco Elevado",
          message: `El disco principal (${mainDisk.mount}) ha alcanzado el ${mainDisk.usedPercent}%.`,
          source: "Infraestructura",
          timestamp: now,
        });
      }

      // 2. CPU Load evaluation
      if (telemetry.cpu.usagePercent > 90) {
        alerts.push({
          id: "alert-cpu-load",
          level: "warning",
          title: "Carga de CPU Elevada",
          message: `Uso de CPU al ${telemetry.cpu.usagePercent}% (Load: ${telemetry.cpu.loadAvg.join(" - ")})`,
          source: "Hardware",
          timestamp: now,
        });
      }

      // 3. RAM evaluation
      if (telemetry.memory.usedPercent > 92) {
        alerts.push({
          id: "alert-ram-high",
          level: "critical",
          title: "Memoria RAM al Límite",
          message: `Consumo de memoria al ${telemetry.memory.usedPercent}%.`,
          source: "Hardware",
          timestamp: now,
        });
      }
    }

    // 4. Docker container health check
    for (const c of containers) {
      if (c.health === "unhealthy") {
        alerts.push({
          id: `alert-container-${c.name}-unhealthy`,
          level: "critical",
          title: `Contenedor Degradado: ${c.name}`,
          message: `El healthcheck reporta fallo crítico en ${c.name}.`,
          source: "Docker Fleet",
          timestamp: now,
        });
      } else if (c.state === "restarting") {
        alerts.push({
          id: `alert-container-${c.name}-restarting`,
          level: "warning",
          title: `Ciclo de Reinicio: ${c.name}`,
          message: `El contenedor ${c.name} está en estado Restarting (posible crash).`,
          source: "Docker Fleet",
          timestamp: now,
        });
      }
    }

    // Record snapshot into SQLite for historical trends
    if (telemetry) {
      try {
        getDatabase().insertMetric({
          timestamp: now,
          cpu_usage: telemetry.cpu.usagePercent,
          load1: telemetry.cpu.loadAvg[0],
          ram_used_bytes: telemetry.memory.usedBytes,
          ram_total_bytes: telemetry.memory.totalBytes,
          disk_used_percent: telemetry.disks[0]?.usedPercent || 0,
          containers_running: telemetry.docker.containersRunning,
        });
      } catch {}
    }
  } catch (err: any) {
    alerts.push({
      id: "alert-audit-failure",
      level: "warning",
      title: "Diagnóstico Interrumpido",
      message: err.message,
      source: "Governance",
      timestamp: now,
    });
  }

  return alerts;
}
