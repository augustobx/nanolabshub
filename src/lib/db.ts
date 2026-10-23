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
      PRAGMA busy_timeout = 5000;

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
      CREATE INDEX IF NOT EXISTS metrics_history_timestamp ON metrics_history(timestamp);

      CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        level TEXT NOT NULL CHECK(level IN ('critical', 'warning', 'info')),
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        resolved INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS app_lifecycle (
        slug TEXT PRIMARY KEY,
        state TEXT NOT NULL CHECK(state IN ('active', 'suspended', 'pending_retirement', 'archived')),
        updated_at TEXT NOT NULL,
        updated_by TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        restore_plan TEXT
      );
      CREATE TABLE IF NOT EXISTS app_lifecycle_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        slug TEXT NOT NULL,
        actor TEXT NOT NULL,
        action TEXT NOT NULL,
        old_state TEXT NOT NULL,
        new_state TEXT NOT NULL,
        details TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS login_attempts (
        bucket TEXT PRIMARY KEY, window_start INTEGER NOT NULL, attempts INTEGER NOT NULL
      );
    `);

    dbInstance = {
      type: "sqlite",
      persistentReady() { return db.prepare("SELECT 1 AS ok").get().ok === 1; },
      allowLoginAttempt(bucket: string) {
        const now = Date.now(), window = 15 * 60000;
        const result = db.prepare(`INSERT INTO login_attempts(bucket,window_start,attempts) VALUES(?,?,1)
          ON CONFLICT(bucket) DO UPDATE SET
          attempts=CASE WHEN window_start<? THEN 1 ELSE attempts+1 END,
          window_start=CASE WHEN window_start<? THEN excluded.window_start ELSE window_start END
          RETURNING attempts`).get(bucket, now, now-window, now-window);
        return result.attempts <= 10;
      },
      resetLoginAttempts(bucket: string) {
        db.prepare("UPDATE login_attempts SET attempts=0 WHERE bucket=?").run(bucket);
      },
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
          SELECT ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS
          (SELECT 1 FROM metrics_history WHERE timestamp >= ?)
        `);
        stmt.run(
          metric.timestamp,
          metric.cpu_usage,
          metric.load1,
          metric.ram_used_bytes,
          metric.ram_total_bytes,
          metric.disk_used_percent,
          metric.containers_running,
          new Date(Date.parse(metric.timestamp) - 30000).toISOString()
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
      getLifecycleStates() {
        return db.prepare("SELECT slug, state, updated_at AS updatedAt, updated_by AS updatedBy, note, restore_plan AS restorePlan FROM app_lifecycle").all();
      },
      getLifecycleHistory(slug: string, limit = 30) {
        return db.prepare("SELECT id, timestamp, slug, actor, action, old_state AS oldState, new_state AS newState, details FROM app_lifecycle_events WHERE slug = ? ORDER BY id DESC LIMIT ?").all(slug, Math.max(1, Math.min(100, limit)));
      },
      // The restore plan is saved BEFORE Docker's restart policies are modified.
      stageLifecycleRestorePlan(slug: string, currentState: string, actor: string, plan: string) {
        db.prepare(`INSERT INTO app_lifecycle (slug, state, updated_at, updated_by, note, restore_plan)
          VALUES (?, ?, ?, ?, '', ?)
          ON CONFLICT(slug) DO UPDATE SET restore_plan = excluded.restore_plan`)
          .run(slug, currentState, new Date().toISOString(), actor, plan);
      },
      saveLifecycleState(input: {
        slug: string; state: string; actor: string; action: string;
        oldState: string; details: string; note: string; restorePlan: string | null;
      }) {
        db.exec("BEGIN IMMEDIATE");
        try {
          const now = new Date().toISOString();
          db.prepare(`INSERT INTO app_lifecycle (slug, state, updated_at, updated_by, note, restore_plan)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(slug) DO UPDATE SET
              state = excluded.state, updated_at = excluded.updated_at,
              updated_by = excluded.updated_by, note = excluded.note,
              restore_plan = excluded.restore_plan`).run(
                input.slug, input.state, now, input.actor, input.note, input.restorePlan
              );
          db.prepare(`INSERT INTO app_lifecycle_events
            (timestamp, slug, actor, action, old_state, new_state, details)
            VALUES (?, ?, ?, ?, ?, ?, ?)`).run(now, input.slug, input.actor, input.action, input.oldState, input.state, input.details);
          db.prepare(`INSERT INTO audit_log (timestamp, user, action, target, details)
            VALUES (?, ?, ?, ?, ?)`).run(now, input.actor, "APP_LIFECYCLE_" + input.action.toUpperCase(), input.slug, input.details);
          db.exec("COMMIT");
        } catch (error) {
          db.exec("ROLLBACK");
          throw error;
        }
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
    console.error("Persistencia SQLite no disponible");
    throw new Error("Persistencia del Hub no disponible; operación bloqueada.");
  }
}
