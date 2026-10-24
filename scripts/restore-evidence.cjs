"use strict";
// Shared schema: a successful check belongs to exact archive bytes, never just an ID.
function ensureRestoreSchema(db) {
  db.exec("CREATE TABLE IF NOT EXISTS backup_restore_checks (id TEXT PRIMARY KEY,backup_id TEXT NOT NULL,slug TEXT NOT NULL,checked_at TEXT NOT NULL,actor TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('passed','failed')),details TEXT NOT NULL)");
  const columns = new Set(db.prepare("PRAGMA table_info(backup_restore_checks)").all().map(c => c.name));
  for (const [name, type] of [["checksum", "TEXT"], ["manifest", "TEXT"], ["job_id", "TEXT"]]) {
    if (!columns.has(name)) db.exec(`ALTER TABLE backup_restore_checks ADD COLUMN ${name} ${type}`);
  }
  db.exec("CREATE INDEX IF NOT EXISTS restore_checks_archive ON backup_restore_checks(backup_id,checked_at)");
}
function latestEvidence(db, archive) {
  const check = db.prepare("SELECT status,checked_at,checksum FROM backup_restore_checks WHERE backup_id=? ORDER BY checked_at DESC,rowid DESC LIMIT 1").get(archive.id);
  const matches = !!check?.checksum && check.checksum === archive.checksum;
  return {
    restoreTested: matches && check.status === "passed",
    restoreStatus: matches ? check.status : "untested",
    restoreCheckedAt: matches ? check.checked_at : null,
  };
}
module.exports = { ensureRestoreSchema, latestEvidence };
