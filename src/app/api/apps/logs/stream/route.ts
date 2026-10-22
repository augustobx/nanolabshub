import { spawn } from "node:child_process";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const container = searchParams.get("container");
  const lines = searchParams.get("lines") || "100";

  if (!container) {
    return new Response("container parameter is required", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let isClosed = false;
      const child = spawn("docker", ["logs", "--tail", lines, "-f", container]);

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

      child.on("close", () => {
        if (!isClosed) {
          isClosed = true;
          try {
            controller.close();
          } catch {}
        }
      });

      child.on("error", (err) => {
        if (!isClosed) {
          isClosed = true;
          try {
            controller.enqueue(encoder.encode(`\n[STREAM ERROR]: ${err.message}\n`));
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
