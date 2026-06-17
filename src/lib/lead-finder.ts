import { spawn } from "child_process";
import path from "path";
import { z } from "zod";

const DEFAULT_LOCATIONS = "Coventry Birmingham Leicester Nottingham";
const DEFAULT_TIMEZONE = "Europe/London";
const DEFAULT_RUN_TIME_LOCAL = "09:00";
const MAX_STDIO_CHARS = 12000;

export type LeadFinderNicheMode = "clinic" | "local-service" | "custom";

export type LeadFinderConfigInput = {
  name: string;
  niche_mode: LeadFinderNicheMode;
  niches: string[];
  locations: string[];
  limit: number;
  discover_emails: boolean;
  email_discovery_max_pages: number;
  dry_run: boolean;
  schedule_enabled: boolean;
  run_time_local: string;
  timezone: string;
};

export type LeadFinderRunSummary = {
  discovered: number | null;
  imported: number | null;
  would_import: number | null;
  skipped: number | null;
  emails_found: number;
  errors: string[];
  message?: string;
  execution_mode?: string;
  external_url?: string;
};

export type LeadFinderProcessResult = {
  ok: boolean;
  command: string;
  args: string[];
  exitCode: number | null;
  stdout: string;
  stderr: string;
  summary: LeadFinderRunSummary;
};

export type LeadFinderExecutionMode = "local" | "github_actions";

export type LeadFinderWorkflowDispatchResult = {
  ok: true;
  executionMode: "github_actions";
  externalUrl: string;
  message: string;
};

const GITHUB_WORKFLOW_OWNER = "krisninnis";
const GITHUB_WORKFLOW_REPO = "leadclaw-uk";
const GITHUB_WORKFLOW_ID = "lead-scraper.yml";
const GITHUB_WORKFLOW_REF = "main";

const rawConfigSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  niche_mode: z.enum(["clinic", "local-service", "custom"]).default("clinic"),
  niches: z.union([z.string(), z.array(z.string())]).optional(),
  locations: z.union([z.string(), z.array(z.string())]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(25),
  discover_emails: stringBoolean().default(true),
  email_discovery_max_pages: z.coerce.number().int().min(1).max(7).default(7),
  dry_run: stringBoolean().default(true),
  schedule_enabled: stringBoolean().default(false),
  run_time_local: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}$/)
    .default(DEFAULT_RUN_TIME_LOCAL),
  timezone: z.string().trim().min(1).max(80).default(DEFAULT_TIMEZONE),
});

function stringBoolean() {
  return z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
    return value;
  }, z.boolean());
}

function splitValues(raw: string | string[] | undefined, fallback = "") {
  const source = Array.isArray(raw) ? raw.join(" ") : raw || fallback;

  return source
    .split(/[,\n\r\t ]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

export function defaultLeadFinderConfig(): LeadFinderConfigInput {
  return {
    name: "Default Lead Finder",
    niche_mode: "clinic",
    niches: [],
    locations: splitValues(DEFAULT_LOCATIONS),
    limit: 25,
    discover_emails: true,
    email_discovery_max_pages: 7,
    dry_run: true,
    schedule_enabled: false,
    run_time_local: DEFAULT_RUN_TIME_LOCAL,
    timezone: DEFAULT_TIMEZONE,
  };
}

export function parseLeadFinderConfig(raw: unknown): LeadFinderConfigInput {
  const parsed = rawConfigSchema.parse(raw || {});
  const niches = splitValues(parsed.niches);
  const locations = splitValues(parsed.locations, DEFAULT_LOCATIONS);

  if (parsed.niche_mode === "custom" && niches.length === 0) {
    throw new Error("Custom mode requires at least one niche.");
  }

  if (locations.length === 0) {
    throw new Error("At least one location is required.");
  }

  return {
    name: parsed.name || "Default Lead Finder",
    niche_mode: parsed.niche_mode,
    niches,
    locations,
    limit: parsed.limit,
    discover_emails: parsed.discover_emails,
    email_discovery_max_pages: parsed.email_discovery_max_pages,
    dry_run: parsed.dry_run,
    schedule_enabled: parsed.schedule_enabled,
    run_time_local: parsed.run_time_local,
    timezone: parsed.timezone,
  };
}

export function buildLeadFinderArgs(config: LeadFinderConfigInput) {
  const scriptPath = path.join(
    process.cwd(),
    "leadclaw-lead-scraper",
    "places_batch.py",
  );

  const args = [
    scriptPath,
    "--limit",
    String(config.limit),
    "--niche-mode",
    config.niche_mode,
    "--locations",
    ...config.locations,
  ];

  if (config.niche_mode === "custom") {
    args.push("--niches", ...config.niches);
  }

  if (config.discover_emails) {
    args.push(
      "--discover-emails",
      "--email-discovery-max-pages",
      String(config.email_discovery_max_pages),
    );
  }

  args.push(config.dry_run ? "--dry-run" : "--live");

  return args;
}

export function resolveLeadFinderExecutionMode(
  env: NodeJS.ProcessEnv = process.env,
): LeadFinderExecutionMode {
  const configured = env.LEAD_FINDER_EXECUTION_MODE?.trim().toLowerCase();

  if (configured === "local" || configured === "github_actions") {
    return configured;
  }

  return env.NODE_ENV === "production" ? "github_actions" : "local";
}

export function githubActionsWorkflowUrl() {
  return `https://github.com/${GITHUB_WORKFLOW_OWNER}/${GITHUB_WORKFLOW_REPO}/actions/workflows/${GITHUB_WORKFLOW_ID}`;
}

export function buildGitHubWorkflowDispatchPayload(
  config: LeadFinderConfigInput,
  leadFinderRunId = "",
) {
  return {
    ref: GITHUB_WORKFLOW_REF,
    inputs: {
      lead_finder_run_id: leadFinderRunId,
      dry_run: String(config.dry_run),
      limit: String(config.limit),
      niche_mode: config.niche_mode,
      niches: config.niches.join(" "),
      locations: config.locations.join(" "),
      discover_emails: String(config.discover_emails),
      email_discovery_max_pages: String(config.email_discovery_max_pages),
    },
  };
}

export function isGitHubDispatchConfigured(
  env: NodeJS.ProcessEnv = process.env,
) {
  return Boolean(env.GITHUB_ACTIONS_DISPATCH_TOKEN?.trim());
}

export async function dispatchLeadFinderWorkflow(
  config: LeadFinderConfigInput,
  leadFinderRunId = "",
): Promise<LeadFinderWorkflowDispatchResult> {
  const token = process.env.GITHUB_ACTIONS_DISPATCH_TOKEN?.trim();
  if (!token) {
    throw new Error("GitHub Actions dispatch token is not configured.");
  }

  const url = `https://api.github.com/repos/${GITHUB_WORKFLOW_OWNER}/${GITHUB_WORKFLOW_REPO}/actions/workflows/${GITHUB_WORKFLOW_ID}/dispatches`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify(
      buildGitHubWorkflowDispatchPayload(config, leadFinderRunId),
    ),
  });

  if (response.status !== 204) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `GitHub Actions dispatch failed with status ${response.status}${
        body ? `: ${body.slice(0, 300)}` : ""
      }`,
    );
  }

  return {
    ok: true,
    executionMode: "github_actions",
    externalUrl: githubActionsWorkflowUrl(),
    message: "GitHub Actions workflow dispatched.",
  };
}

function asNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function safeErrorMessage(event: Record<string, unknown>) {
  const message =
    typeof event.error === "string"
      ? event.error
      : typeof event.error_message === "string"
        ? event.error_message
        : null;

  return message?.slice(0, 500) || null;
}

export function parseLeadFinderStdout(stdout: string): LeadFinderRunSummary {
  const summary: LeadFinderRunSummary = {
    discovered: null,
    imported: null,
    would_import: null,
    skipped: null,
    emails_found: 0,
    errors: [],
  };

  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) continue;

    let event: Record<string, unknown>;
    try {
      event = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      continue;
    }

    if (event.event === "email_discovery_email_found") {
      summary.emails_found += 1;
    }

    if (event.event === "scraper_discovery_complete") {
      summary.discovered = asNumber(event.discovered);
      summary.skipped = asNumber(event.skipped);
    }

    if (event.event === "scraper_import_complete") {
      summary.discovered = asNumber(event.discovered) ?? summary.discovered;
      const discoverySkipped = asNumber(event.skipped) ?? 0;
      const result =
        event.result && typeof event.result === "object"
          ? (event.result as Record<string, unknown>)
          : {};

      summary.imported =
        asNumber(result.inserted) ??
        asNumber(result.imported) ??
        asNumber(result.insertedCount) ??
        summary.imported;
      summary.would_import =
        asNumber(result.would_import) ??
        asNumber(result.wouldImport) ??
        summary.would_import;

      const importSkipped =
        asNumber(result.skipped) ?? asNumber(result.skippedCount) ?? 0;
      summary.skipped = discoverySkipped + importSkipped;
    }

    if (
      typeof event.event === "string" &&
      (event.event.endsWith("_failed") || event.event.endsWith("_invalid"))
    ) {
      const message = safeErrorMessage(event);
      summary.errors.push(message || event.event);
    }
  }

  return summary;
}

function tail(value: string) {
  if (value.length <= MAX_STDIO_CHARS) return value;
  return value.slice(value.length - MAX_STDIO_CHARS);
}

function pythonCommand() {
  return (
    process.env.LEAD_FINDER_PYTHON?.trim() ||
    (process.platform === "win32" ? "py" : "python3")
  );
}

export async function runLeadFinderScraper(
  config: LeadFinderConfigInput,
): Promise<LeadFinderProcessResult> {
  const command = pythonCommand();
  const args = buildLeadFinderArgs(config);
  const timeoutMs = Number(process.env.LEAD_FINDER_TIMEOUT_MS || 180000);

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;

    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
      },
      windowsHide: true,
    });

    const timeout = setTimeout(() => {
      stderr += "\nLead Finder timed out before the scraper completed.";
      child.kill();
    }, timeoutMs);

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      stderr += `\n${error.message}`;
      resolve({
        ok: false,
        command,
        args,
        exitCode: null,
        stdout: tail(stdout),
        stderr: tail(stderr),
        summary: {
          ...parseLeadFinderStdout(stdout),
          errors: [error.message],
        },
      });
    });

    child.on("close", (exitCode) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      const summary = parseLeadFinderStdout(stdout);
      if (exitCode !== 0 && summary.errors.length === 0) {
        summary.errors.push(`scraper_exit_${exitCode ?? "unknown"}`);
      }

      resolve({
        ok: exitCode === 0,
        command,
        args,
        exitCode,
        stdout: tail(stdout),
        stderr: tail(stderr),
        summary,
      });
    });
  });
}
