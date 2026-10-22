import { executeRemoteCommand } from "@/lib/ssh";
import { getDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    // Audit start
    try {
      getDatabase().logAudit("augusto", "DOCKER_PRUNE_INIT", "DOCKER", "Iniciando limpieza segura de imágenes huérfanas");
    } catch {}

    // Strictly prune dangling images and builder cache - NEVER touch volumes or containers
    const cmd = `
      echo "=== [1/2] LIMPIEZA SEGURA DE IMAGENES HUERFANAS (<none>) ==="
      docker image prune -f
      echo "\n=== [2/2] LIMPIEZA DE CACHE DE BUILD ANTERIOR ==="
      docker builder prune -f --keep-storage=1GB
      echo "\n=== [ESTADO FINAL DEL DISCO Y DOCKER] ==="
      docker system df
    `;

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
