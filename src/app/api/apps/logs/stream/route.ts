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
      // Spawn docker logs with follow
      const child = spawn("docker", ["logs", "--tail", lines, "-f", container]);

      child.stdout.on("data", (chunk: Buffer) => {
        controller.enqueue(encoder.encode(chunk.toString()));
      });

      child.stderr.on("data", (chunk: Buffer) => {
        controller.enqueue(encoder.encode(chunk.toString()));
      });

      child.on("close", () => {
        controller.close();
      });

      child.on("error", (err) => {
        controller.enqueue(encoder.encode(`\n[STREAM ERROR]: ${err.message}\n`));
        controller.close();
      });

      // Cleanup when request aborted
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
