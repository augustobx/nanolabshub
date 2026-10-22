import path from "node:path";
import fs from "node:fs";

let dbInstance: any = null;

export function getDatabase() {
  if (dbInstance) return dbInstance;

  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, "hub.sqlite");

  try {
    // Attempt to use Node 22 built-in SQLite
    const { DatabaseSync } = require("node:sqlite");
    const db = new DatabaseSync(dbPath);

    db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;

      CREATE TABLE IF NOT EXISTS metrics_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        cpu_usage REAL NOT NULL,
        load1 REAL NOT NULL,
        ram_used_bytes INTEGER NOT NULL,
        ram_total_bytes INTEGER NOT NULL,
        disk_used_percent REAL NOT NULL,
        containers_running INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        user TEXT NOT NULL,
        action TEXT NOT NULL,
        target TEXT NOT NULL,
        details TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        level TEXT NOT NULL CHECK(level IN ('critical', 'warning', 'info')),
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        resolved INTEGER NOT NULL DEFAULT 0
      );
    `);

    dbInstance = {
      type: "sqlite",
      insertMetric(metric: {
        timestamp: string;
        cpu_usage: number;
        load1: number;
        ram_used_bytes: number;
        ram_total_bytes: number;
        disk_used_percent: number;
        containers_running: number;
      }) {
        const stmt = db.prepare(`
          INSERT INTO metrics_history (timestamp, cpu_usage, load1, ram_used_bytes, ram_total_bytes, disk_used_percent, containers_running)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
          metric.timestamp,
          metric.cpu_usage,
          metric.load1,
          metric.ram_used_bytes,
          metric.ram_total_bytes,
          metric.disk_used_percent,
          metric.containers_running
        );
      },
      getMetricsHistory(limit = 60) {
        const stmt = db.prepare(`
          SELECT * FROM metrics_history ORDER BY id DESC LIMIT ?
        `);
        return stmt.all(limit).reverse();
      },
      logAudit(user: string, action: string, target: string, details: string) {
        const stmt = db.prepare(`
          INSERT INTO audit_log (timestamp, user, action, target, details)
          VALUES (?, ?, ?, ?, ?)
        `);
        stmt.run(new Date().toISOString(), user, action, target, details);
      },
      getAuditLogs(limit = 50) {
        const stmt = db.prepare(`
          SELECT * FROM audit_log ORDER BY id DESC LIMIT ?
        `);
        return stmt.all(limit);
      },
      addAlert(level: "critical" | "warning" | "info", title: string, message: string) {
        const stmt = db.prepare(`
          INSERT INTO alerts (timestamp, level, title, message)
          VALUES (?, ?, ?, ?)
        `);
        stmt.run(new Date().toISOString(), level, title, message);
      },
      getActiveAlerts() {
        const stmt = db.prepare(`
          SELECT * FROM alerts WHERE resolved = 0 ORDER BY id DESC LIMIT 20
        `);
        return stmt.all();
      },
      resolveAlert(id: number) {
        const stmt = db.prepare(`
          UPDATE alerts SET resolved = 1 WHERE id = ?
        `);
        stmt.run(id);
      },
    };

    return dbInstance;
  } catch (err) {
    // In-memory fallback if node:sqlite isn't available
    console.warn("node:sqlite not available, using in-memory store", err);
    const memoryHistory: any[] = [];
    const memoryAudit: any[] = [];
    const memoryAlerts: any[] = [];

    dbInstance = {
      type: "memory",
      insertMetric(metric: any) {
        memoryHistory.push(metric);
        if (memoryHistory.length > 300) memoryHistory.shift();
      },
      getMetricsHistory(limit = 60) {
        return memoryHistory.slice(-limit);
      },
      logAudit(user: string, action: string, target: string, details: string) {
        memoryAudit.unshift({ timestamp: new Date().toISOString(), user, action, target, details });
      },
      getAuditLogs(limit = 50) {
        return memoryAudit.slice(0, limit);
      },
      addAlert(level: any, title: string, message: string) {
        memoryAlerts.unshift({ id: Date.now(), timestamp: new Date().toISOString(), level, title, message, resolved: 0 });
      },
      getActiveAlerts() {
        return memoryAlerts.filter((a) => !a.resolved);
      },
      resolveAlert(id: number) {
        const a = memoryAlerts.find((al) => al.id === id);
        if (a) a.resolved = 1;
      },
    };

    return dbInstance;
  }
}
