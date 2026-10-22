import { executeRemoteCommand } from "@/lib/ssh";
import { getDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    try {
      getDatabase().logAudit("augusto", "DOCKER_PRUNE_INIT", "DOCKER", "Iniciando limpieza segura de imágenes huérfanas");
    } catch {}

    // Strictly prune dangling untagged images - safe and fast
    const cmd = `docker image prune -f && docker system df`;
    const { stdout, stderr, code } = await executeRemoteCommand(cmd);

    if (code !== 0) {
      throw new Error(stderr || stdout);
    }

    try {
      getDatabase().logAudit("augusto", "DOCKER_PRUNE_SUCCESS", "DOCKER", "Limpieza segura completada exitosamente");
    } catch {}

    return Response.json({
      success: true,
      data: {
        output: stdout,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    return Response.json(
      {
        success: false,
        error: error.message || "Error al ejecutar limpieza segura de Docker",
      },
      { status: 500 }
    );
  }
}
