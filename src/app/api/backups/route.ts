import { getBackupsList } from "@/lib/server-api";
import { executeRemoteCommand } from "@/lib/ssh";
import { KNOWN_APPS } from "@/lib/apps-registry";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const backups = await getBackupsList();
    return Response.json({
      success: true,
      data: backups,
    });
  } catch (error: any) {
    console.error("Backups error:", error);
    return Response.json(
      {
        success: false,
        error: error.message || "Failed to fetch backups",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { slug } = body;

    const app = KNOWN_APPS.find((a) => a.slug === slug);
    if (!app) {
      return Response.json({ success: false, error: `App ${slug} no encontrada` }, { status: 400 });
    }

    if (app.dbType === "none") {
      return Response.json({ success: false, error: `${app.name} no posee base de datos configurable` }, { status: 400 });
    }

    // Trigger backup via docker or nanocontrol automated runner
    const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
    const backupTargetDir = `/opt/backups/${app.slug}`;
    let backupCmd = "";

    if (app.dbType === "mariadb" || app.dbType === "mysql") {
      backupCmd = `
        echo Qap.1029Qap.1029 | sudo -S mkdir -p "${backupTargetDir}" && \\
        echo Qap.1029Qap.1029 | sudo -S docker exec ${app.dbContainer} sh -c "mariadb-dump -u root -p\\$MYSQL_ROOT_PASSWORD --all-databases 2>/dev/null || mysqldump -u root -p\\$MYSQL_ROOT_PASSWORD --all-databases 2>/dev/null" | gzip > "${backupTargetDir}/manual_dump_${timestamp}.sql.gz" && \\
        ls -lh "${backupTargetDir}/manual_dump_${timestamp}.sql.gz"
      `;
    } else if (app.dbType === "postgres") {
      backupCmd = `
        echo Qap.1029Qap.1029 | sudo -S mkdir -p "${backupTargetDir}" && \\
        echo Qap.1029Qap.1029 | sudo -S docker exec ${app.dbContainer} sh -c "pg_dumpall -U postgres 2>/dev/null || pg_dumpall -U \\$POSTGRES_USER 2>/dev/null" | gzip > "${backupTargetDir}/manual_dump_${timestamp}.sql.gz" && \\
        ls -lh "${backupTargetDir}/manual_dump_${timestamp}.sql.gz"
      `;
    } else if (app.dbType === "sqlite" && app.sqlitePath) {
      backupCmd = `
        echo Qap.1029Qap.1029 | sudo -S mkdir -p "${backupTargetDir}" && \\
        echo Qap.1029Qap.1029 | sudo -S cp "${app.sqlitePath}" "${backupTargetDir}/identity_${timestamp}.sqlite" && \\
        gzip "${backupTargetDir}/identity_${timestamp}.sqlite" && \\
        ls -lh "${backupTargetDir}/identity_${timestamp}.sqlite.gz"
      `;
    }

    const { stdout, stderr, code } = await executeRemoteCommand(backupCmd);
    if (code !== 0) {
      throw new Error(`Error generando backup: ${stderr || stdout}`);
    }

    return Response.json({
      success: true,
      data: {
        appSlug: app.slug,
        output: stdout,
        timestamp,
      },
    });
  } catch (error: any) {
    console.error("Backup trigger error:", error);
    return Response.json(
      {
        success: false,
        error: error.message || "Failed to trigger backup",
      },
      { status: 500 }
    );
  }
}
