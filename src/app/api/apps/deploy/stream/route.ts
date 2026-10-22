import { spawn } from "node:child_process";
import { KNOWN_APPS } from "@/lib/apps-registry";
import { getDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return new Response("slug is required", { status: 400 });
  }

  const app = KNOWN_APPS.find((a) => a.slug === slug);
  if (!app) {
    return new Response(`App ${slug} no encontrada`, { status: 404 });
  }

  const encoder = new TextEncoder();

  // Audit log start
  try {
    getDatabase().logAudit("augusto", "DEPLOY_STARTED", app.slug, `Iniciado despliegue en ${app.path}`);
  } catch {}

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          `=== [NANOLABSHUB] INICIANDO DESPLIEGUE CONTROLADO: ${app.name.toUpperCase()} ===\n` +
          `Ruta: ${app.path}\n` +
          `Fecha: ${new Date().toISOString()}\n` +
          `------------------------------------------------------------\n`
        )
      );

      const deployScript = `
        cd "${app.path}"
        echo "[1/4] Comprobando rama y cambios locales..."
        BRANCH=$(git branch --show-current 2>/dev/null || echo "main")
        echo "Rama activa: $BRANCH"
        git status -s

        echo "\n[2/4] Descargando ultimas modificaciones desde GitHub (git pull origin $BRANCH)..."
        git pull origin "$BRANCH"

        echo "\n[3/4] Reconstruyendo y levantando contenedores (docker compose up -d --build)..."
        docker compose up -d --build

        echo "\n[4/4] Verificando estado final de servicios..."
        docker compose ps
        echo "\n=== [DESPLIEGUE COMPLETADO EXITOSAMENTE] ==="
      `;

      const child = spawn("bash", ["-c", deployScript]);

      child.stdout.on("data", (chunk: Buffer) => {
        controller.enqueue(encoder.encode(chunk.toString()));
      });

      child.stderr.on("data", (chunk: Buffer) => {
        controller.enqueue(encoder.encode(chunk.toString()));
      });

      child.on("close", (code) => {
        try {
          getDatabase().logAudit(
            "augusto",
            code === 0 ? "DEPLOY_SUCCESS" : "DEPLOY_FAILED",
            app.slug,
            `Despliegue finalizado con código ${code}`
          );
        } catch {}

        if (code !== 0) {
          controller.enqueue(encoder.encode(`\n[ERROR]: El proceso finalizo con codigo ${code}\n`));
        }
        controller.close();
      });

      child.on("error", (err) => {
        controller.enqueue(encoder.encode(`\n[FALLO CRITICO]: ${err.message}\n`));
        controller.close();
      });

      req.signal.addEventListener("abort", () => {
        child.kill();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
