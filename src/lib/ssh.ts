import { exec, execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
const execAsync = promisify(exec), execFileAsync = promisify(execFile);
export interface ExecResult { stdout: string; stderr: string; code: number }
export async function executeRemoteCommand(cmd: string): Promise<ExecResult> {
  try {
    const options = { timeout: 30000, maxBuffer: 10 * 1024 * 1024 };
    let result;
    if (process.env.DOCKER_HOST_MODE === "internal") result = await execAsync(cmd, options);
    else {
      const host = process.env.SERVER_HOST, user = process.env.SERVER_USER;
      const port = process.env.SERVER_PORT || "2207", key = process.env.SERVER_SSH_KEY_PATH;
      if (!host || !user || !/^[a-zA-Z0-9_.-]+$/.test(host) || !/^[a-zA-Z0-9_-]+$/.test(user) || !/^\d{1,5}$/.test(port)) throw Error("Conexión SSH no configurada");
      if (key && !fs.existsSync(key)) throw Error("Clave SSH configurada no disponible");
      const args = ["-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes", "-o", "ConnectTimeout=8", "-p", port, ...(key ? ["-i", key] : []), user + "@" + host, cmd];
      result = await execFileAsync("ssh", args, options);
    }
    return { stdout: result.stdout.trim(), stderr: result.stderr.trim(), code: 0 };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string; code?: number };
    // Never retry a command through another transport: an uncertain write may have completed.
    return { stdout: String(err.stdout || "").trim(), stderr: String(err.stderr || err.message || "Error de ejecución").trim(), code: typeof err.code === "number" ? err.code : 1 };
  }
}
