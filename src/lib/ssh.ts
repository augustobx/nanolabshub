import { exec } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";

const execAsync = promisify(exec);

const SERVER_HOST = process.env.SERVER_HOST || "149.50.159.163";
const SERVER_PORT = Number(process.env.SERVER_PORT || 2207);
const SERVER_USER = process.env.SERVER_USER || "augusto";
const SERVER_SSH_KEY_PATH = process.env.SERVER_SSH_KEY_PATH || "C:/Users/abasq/.ssh/id_ed25519_nanolabs";
const SERVER_PASS = process.env.ADMIN_PASS || "Qap.1029Qap.1029";

export interface ExecResult {
  stdout: string;
  stderr: string;
  code: number;
}

/**
 * Executes a command on the target server.
 * Uses native ssh CLI with automatic key detection or child process execution.
 */
export async function executeRemoteCommand(cmd: string): Promise<ExecResult> {
  // If running directly on the production host inside docker or host OS:
  if (process.env.DOCKER_HOST_MODE === "internal") {
    try {
      const { stdout, stderr } = await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024 });
      return { stdout: stdout.trim(), stderr: stderr.trim(), code: 0 };
    } catch (err: any) {
      return {
        stdout: err.stdout ? String(err.stdout).trim() : "",
        stderr: err.stderr ? String(err.stderr).trim() : err.message,
        code: err.code || 1,
      };
    }
  }

  // Remote execution via OpenSSH CLI
  try {
    let sshCmd = "";
    if (fs.existsSync(SERVER_SSH_KEY_PATH)) {
      sshCmd = `ssh -i "${SERVER_SSH_KEY_PATH}" -o StrictHostKeyChecking=no -p ${SERVER_PORT} ${SERVER_USER}@${SERVER_HOST} "${cmd.replace(/"/g, '\\"')}"`;
    } else {
      sshCmd = `ssh -o StrictHostKeyChecking=no -p ${SERVER_PORT} ${SERVER_USER}@${SERVER_HOST} "${cmd.replace(/"/g, '\\"')}"`;
    }

    const { stdout, stderr } = await execAsync(sshCmd, {
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { stdout: stdout.trim(), stderr: stderr.trim(), code: 0 };
  } catch (err: any) {
    // Attempt fallback with ssh2 client dynamically if CLI fails
    return await executeViaSsh2(cmd).catch(() => ({
      stdout: err.stdout ? String(err.stdout).trim() : "",
      stderr: err.stderr ? String(err.stderr).trim() : err.message,
      code: err.code || 1,
    }));
  }
}

/**
 * Fallback execution using pure node-ssh2 client with dynamic import
 */
async function executeViaSsh2(cmd: string): Promise<ExecResult> {
  const { Client } = await import("ssh2");
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let stdout = "";
    let stderr = "";

    conn
      .on("ready", () => {
        conn.exec(cmd, (err, stream) => {
          if (err) {
            conn.end();
            return reject(err);
          }
          stream
            .on("close", (code: number) => {
              conn.end();
              resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code: code || 0 });
            })
            .on("data", (data: Buffer) => {
              stdout += data.toString();
            })
            .stderr.on("data", (data: Buffer) => {
              stderr += data.toString();
            });
        });
      })
      .on("error", (err) => {
        reject(err);
      });

    const connectConfig: any = {
      host: SERVER_HOST,
      port: SERVER_PORT,
      username: SERVER_USER,
      readyTimeout: 15000,
    };

    if (fs.existsSync(SERVER_SSH_KEY_PATH)) {
      try {
        connectConfig.privateKey = fs.readFileSync(SERVER_SSH_KEY_PATH);
      } catch {
        connectConfig.password = SERVER_PASS;
      }
    } else {
      connectConfig.password = SERVER_PASS;
    }

    conn.connect(connectConfig);
  });
}
