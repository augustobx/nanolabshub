import { spawn } from "node:child_process";
import { KNOWN_APPS } from "@/lib/apps-registry";
import { getDatabase } from "@/lib/db";
import { requireMutatingSession } from "@/lib/action-security";
import { assertAppActive } from "@/lib/app-lifecycle";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let actor: string;
  try {
    actor = await requireMutatingSession(req);
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "No autorizado", { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return new Response("slug is required", { status: 400 });
  }

  const app = KNOWN_APPS.find((a) => a.slug === slug);
  if (!app) {
    return new Response(`App ${slug} no encontrada`, { status: 404 });
  }

  try {
    assertAppActive(app.slug);
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Operación bloqueada", { status: 409 });
  }

  const encoder = new TextEncoder();

  // Audit log start
  try {
    getDatabase().logAudit(actor, "DEPLOY_STARTED", app.slug, `Iniciado despliegue en ${app.path}`);
  } catch {}

  const stream = new ReadableStream({
    start(controller) {
      let isClosed = false;

      controller.enqueue(
        encoder.encode(
          `=== [NANOLABSHUB] INICIANDO DESPLIEGUE CONTROLADO: ${app.name.toUpperCase()} ===\n` +
          `Ruta: ${app.path}\n` +
          `Fecha: ${new Date().toISOString()}\n` +
          `------------------------------------------------------------\n`
        )
      );

      // A failed Git operation must never fall through to a Docker rebuild.
      // Scope safe.directory to this exact registered checkout.
      const deployScript = `
        set -euo pipefail
        APP_PATH=${JSON.stringify(app.path)}
        cd "$APP_PATH"
        echo "[1/4] Validando repositorio, rama y cambios locales..."
        GIT=(git -c "safe.directory=$APP_PATH" -C "$APP_PATH")
        "\${GIT[@]}" rev-parse --is-inside-work-tree | grep -qx true || { echo "No hay repositorio Git"; exit 2; }
        BRANCH=$("\${GIT[@]}" symbolic-ref --quiet --short HEAD) || {
          echo "Despliegue cancelado: checkout detached, no hay rama activa"; exit 2;
        }
        test -n "$BRANCH" || { echo "No hay rama seleccionada"; exit 2; }
        test -z "$("\${GIT[@]}" status --porcelain)" || {
          echo "Despliegue cancelado: hay cambios locales sin guardar"; exit 2;
        }
        docker compose config --services >/dev/null || {
          echo "Despliegue cancelado: Docker Compose no disponible"; exit 2;
        }

        echo "[2/4] Git pull --ff-only de origin/$BRANCH..."
        GIT_TERMINAL_PROMPT=0 "\${GIT[@]}" pull --ff-only origin "$BRANCH"

        echo "[3/4] Reconstruyendo y levantando servicios..."
        docker compose up -d --build

        echo "[4/4] Estado final..."
        docker compose ps
        echo "=== DESPLIEGUE COMPLETADO ==="
      `;

      const child = spawn("bash", ["-c", deployScript]);

      child.stdout.on("data", (chunk: Buffer) => {
        if (!isClosed) {
          try {
            controller.enqueue(encoder.encode(chunk.toString()));
          } catch {
            isClosed = true;
          }
        }
      });

      child.stderr.on("data", (chunk: Buffer) => {
        if (!isClosed) {
          try {
            controller.enqueue(encoder.encode(chunk.toString()));
          } catch {
            isClosed = true;
          }
        }
      });

      child.on("close", (code) => {
        try {
          getDatabase().logAudit(
            actor,
            code === 0 ? "DEPLOY_SUCCESS" : "DEPLOY_FAILED",
            app.slug,
            `Despliegue finalizado con código ${code}`
          );
        } catch {}

        if (!isClosed) {
          isClosed = true;
          if (code !== 0) {
            try {
              controller.enqueue(encoder.encode(`\n[ERROR]: El proceso finalizo con codigo ${code}\n`));
            } catch {}
          }
          try {
            controller.close();
          } catch {}
        }
      });

      child.on("error", (err) => {
        if (!isClosed) {
          isClosed = true;
          try {
            controller.enqueue(encoder.encode(`\n[FALLO CRITICO]: ${err.message}\n`));
            controller.close();
          } catch {}
        }
      });

      req.signal.addEventListener("abort", () => {
        isClosed = true;
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
