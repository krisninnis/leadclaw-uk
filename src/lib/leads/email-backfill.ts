import { spawn } from "node:child_process";
import path from "node:path";

export type EmailBackfillInputLead = {
  id: string;
  company_name: string | null;
  website: string | null;
  notes: string | null;
};

export type EmailBackfillDiscoveryResult = {
  id: string;
  contact_email: string;
  notes: string | null;
  status: string;
  reason?: string | null;
  confidence?: string | null;
  source_url?: string | null;
  candidates_count?: number;
  pages_checked?: number;
  error?: string;
};

type BridgePayload = {
  ok?: boolean;
  error?: string;
  results?: EmailBackfillDiscoveryResult[];
};

function pythonCommand() {
  if (process.env.EMAIL_DISCOVERY_PYTHON?.trim()) {
    return process.env.EMAIL_DISCOVERY_PYTHON.trim();
  }

  return process.platform === "win32" ? "py" : "python3";
}

function bridgePath() {
  return path.join(
    process.cwd(),
    "leadclaw-lead-scraper",
    "email_backfill_bridge.py",
  );
}

function bridgeTimeoutMs() {
  const parsed = Number(process.env.EMAIL_BACKFILL_PYTHON_TIMEOUT_MS);
  if (!Number.isFinite(parsed)) return 55_000;
  return Math.max(1_000, Math.min(Math.floor(parsed), 55_000));
}

export function discoverEmailsForLeads(
  leads: EmailBackfillInputLead[],
): Promise<EmailBackfillDiscoveryResult[]> {
  if (leads.length === 0) return Promise.resolve([]);

  return new Promise((resolve, reject) => {
    const child = spawn(pythonCommand(), [bridgePath()], {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(new Error("email_discovery_timeout"));
    }, bridgeTimeoutMs());

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);

      if (code !== 0) {
        reject(new Error(stderr.trim() || `email_discovery_exited_${code}`));
        return;
      }

      try {
        const payload = JSON.parse(stdout || "{}") as BridgePayload;
        if (!payload.ok) {
          reject(new Error(payload.error || "email_discovery_failed"));
          return;
        }

        resolve(payload.results || []);
      } catch (error) {
        reject(
          error instanceof Error
            ? error
            : new Error("email_discovery_invalid_json"),
        );
      }
    });

    child.stdin.end(
      JSON.stringify({
        leads,
        config: {
          max_pages: 3,
          timeout_seconds: 5,
          delay_seconds: 0.5,
        },
      }),
    );
  });
}
