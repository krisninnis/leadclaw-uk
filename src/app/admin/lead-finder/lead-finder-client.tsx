"use client";

import { useMemo, useState } from "react";
import type { LeadFinderRunListItem } from "./page";

type NicheMode = "clinic" | "local-service" | "custom";

type InitialConfig = {
  name: string;
  niche_mode: NicheMode;
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

type FormState = {
  name: string;
  niche_mode: NicheMode;
  niches: string;
  locations: string;
  limit: number;
  discover_emails: boolean;
  email_discovery_max_pages: number;
  dry_run: boolean;
  schedule_enabled: boolean;
  run_time_local: string;
  timezone: string;
};

type RunResponse = {
  ok: boolean;
  runId?: string;
  status?: string;
  exitCode?: number | null;
  summary?: LeadFinderRunListItem["summary"];
  error?: string;
};

type ConfigResponse = {
  ok: boolean;
  error?: string;
};

function initialForm(config: InitialConfig): FormState {
  return {
    ...config,
    niches: config.niches.join(" "),
    locations: config.locations.join(" "),
  };
}

function formatNumber(value: number | null | undefined) {
  return typeof value === "number" ? value.toLocaleString("en-GB") : "-";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusClass(status: string | null | undefined) {
  if (status === "completed") return "bg-emerald-100 text-emerald-700";
  if (status === "failed") return "bg-rose-100 text-rose-700";
  if (status === "running") return "bg-sky-100 text-sky-700";
  return "bg-slate-100 text-slate-700";
}

export default function LeadFinderClient({
  initialConfig,
  initialRuns,
}: {
  initialConfig: InitialConfig;
  initialRuns: LeadFinderRunListItem[];
}) {
  const [form, setForm] = useState<FormState>(() => initialForm(initialConfig));
  const [runs, setRuns] = useState(initialRuns);
  const [latestResult, setLatestResult] = useState<RunResponse | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const payload = useMemo(
    () => ({
      name: form.name,
      niche_mode: form.niche_mode,
      niches: form.niches,
      locations: form.locations,
      limit: form.limit,
      discover_emails: form.discover_emails,
      email_discovery_max_pages: form.email_discovery_max_pages,
      dry_run: form.dry_run,
      schedule_enabled: form.schedule_enabled,
      run_time_local: form.run_time_local,
      timezone: form.timezone,
    }),
    [form],
  );

  async function saveConfig() {
    setIsSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/lead-finder/configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json()) as ConfigResponse;
      if (!res.ok || !body.ok) throw new Error(body.error || "Save failed");
      setMessage("Lead Finder configuration saved.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  }

  async function runNow() {
    setIsRunning(true);
    setMessage(null);
    setLatestResult(null);

    try {
      const res = await fetch("/api/admin/lead-finder/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json()) as RunResponse;
      setLatestResult(body);
      if (!res.ok || !body.ok) throw new Error(body.error || "Run failed");

      if (body.runId) {
        setRuns((current) => [
          {
            id: body.runId || "current-run",
            status: body.status || "completed",
            dry_run: form.dry_run,
            summary: body.summary || null,
            exit_code: body.exitCode ?? null,
            error: null,
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          },
          ...current.slice(0, 9),
        ]);
      }
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Run failed");
    } finally {
      setIsRunning(false);
    }
  }

  const latestSummary = latestResult?.summary;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
      <section className="rounded-[24px] border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 border-b pb-5">
          <h2 className="text-2xl font-semibold text-foreground">
            Finder configuration
          </h2>
          <p className="text-sm leading-6 text-muted">
            Run small Google Places discovery batches through the existing
            scraper CLI. This tool never triggers the outreach sender.
          </p>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-foreground">
              Niche mode
            </span>
            <select
              className="w-full rounded-xl border px-3 py-2 text-sm"
              value={form.niche_mode}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  niche_mode: event.target.value as NicheMode,
                }))
              }
            >
              <option value="clinic">Clinic</option>
              <option value="local-service">Local service</option>
              <option value="custom">Custom</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-foreground">
              Limit
            </span>
            <input
              className="w-full rounded-xl border px-3 py-2 text-sm"
              min={1}
              max={200}
              type="number"
              value={form.limit}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  limit: Number(event.target.value),
                }))
              }
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-foreground">
              Custom niches
            </span>
            <input
              className="w-full rounded-xl border px-3 py-2 text-sm"
              placeholder="plumber electrician heating"
              value={form.niches}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  niches: event.target.value,
                }))
              }
            />
            <span className="block text-xs text-muted">
              Used only when custom mode is selected.
            </span>
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-foreground">
              Locations
            </span>
            <input
              className="w-full rounded-xl border px-3 py-2 text-sm"
              value={form.locations}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  locations: event.target.value,
                }))
              }
            />
          </label>

          <label className="flex items-center gap-3 rounded-xl border p-4">
            <input
              checked={form.discover_emails}
              className="h-4 w-4"
              type="checkbox"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  discover_emails: event.target.checked,
                }))
              }
            />
            <span>
              <span className="block text-sm font-medium text-foreground">
                Discover public emails
              </span>
              <span className="block text-xs text-muted">
                Uses the same-domain safe discovery path.
              </span>
            </span>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-foreground">
              Email discovery pages
            </span>
            <input
              className="w-full rounded-xl border px-3 py-2 text-sm"
              min={1}
              max={7}
              type="number"
              value={form.email_discovery_max_pages}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  email_discovery_max_pages: Number(event.target.value),
                }))
              }
            />
          </label>

          <label className="flex items-center gap-3 rounded-xl border p-4">
            <input
              checked={form.dry_run}
              className="h-4 w-4"
              type="checkbox"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  dry_run: event.target.checked,
                }))
              }
            />
            <span>
              <span className="block text-sm font-medium text-foreground">
                Dry run
              </span>
              <span className="block text-xs text-muted">
                Preview only; no leads are imported.
              </span>
            </span>
          </label>

          <label className="flex items-center gap-3 rounded-xl border p-4">
            <input
              checked={form.schedule_enabled}
              className="h-4 w-4"
              type="checkbox"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  schedule_enabled: event.target.checked,
                }))
              }
            />
            <span>
              <span className="block text-sm font-medium text-foreground">
                Save as scheduled config
              </span>
              <span className="block text-xs text-muted">
                Stored for the future scheduler; no scheduler is created yet.
              </span>
            </span>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-foreground">
              Run time
            </span>
            <input
              className="w-full rounded-xl border px-3 py-2 text-sm"
              type="time"
              value={form.run_time_local}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  run_time_local: event.target.value,
                }))
              }
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-foreground">
              Timezone
            </span>
            <input
              className="w-full rounded-xl border px-3 py-2 text-sm"
              value={form.timezone}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  timezone: event.target.value,
                }))
              }
            />
          </label>
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t pt-5 sm:flex-row">
          <button
            className="button-primary"
            disabled={isRunning}
            type="button"
            onClick={runNow}
          >
            {isRunning ? "Running..." : "Run now"}
          </button>
          <button
            className="button-secondary"
            disabled={isSaving}
            type="button"
            onClick={saveConfig}
          >
            {isSaving ? "Saving..." : "Save schedule"}
          </button>
        </div>

        {message ? (
          <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-muted">
            {message}
          </p>
        ) : null}
      </section>

      <aside className="space-y-6">
        <section className="rounded-[24px] border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-foreground">Latest run</h2>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl border bg-slate-50 p-4">
              <p className="text-xs text-muted">Discovered</p>
              <p className="mt-1 text-2xl font-semibold">
                {formatNumber(latestSummary?.discovered)}
              </p>
            </div>
            <div className="rounded-xl border bg-slate-50 p-4">
              <p className="text-xs text-muted">
                {form.dry_run ? "Would import" : "Imported"}
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {formatNumber(
                  form.dry_run
                    ? latestSummary?.would_import
                    : latestSummary?.imported,
                )}
              </p>
            </div>
            <div className="rounded-xl border bg-slate-50 p-4">
              <p className="text-xs text-muted">Skipped</p>
              <p className="mt-1 text-2xl font-semibold">
                {formatNumber(latestSummary?.skipped)}
              </p>
            </div>
            <div className="rounded-xl border bg-slate-50 p-4">
              <p className="text-xs text-muted">Emails found</p>
              <p className="mt-1 text-2xl font-semibold">
                {formatNumber(latestSummary?.emails_found)}
              </p>
            </div>
          </div>

          {latestSummary?.errors?.length ? (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {latestSummary.errors.join("; ")}
            </div>
          ) : null}
        </section>

        <section className="rounded-[24px] border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-foreground">Run history</h2>
          <div className="mt-4 space-y-3">
            {runs.length === 0 ? (
              <p className="text-sm text-muted">No Lead Finder runs yet.</p>
            ) : (
              runs.map((run) => (
                <div key={run.id} className="rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {formatDate(run.completed_at || run.created_at)}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {run.dry_run ? "Dry run" : "Live import"} · exit{" "}
                        {run.exit_code ?? "-"}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(
                        run.status,
                      )}`}
                    >
                      {run.status || "unknown"}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2 text-xs text-muted">
                    <span>D {formatNumber(run.summary?.discovered)}</span>
                    <span>I {formatNumber(run.summary?.imported)}</span>
                    <span>W {formatNumber(run.summary?.would_import)}</span>
                    <span>E {formatNumber(run.summary?.emails_found)}</span>
                  </div>
                  {run.error ? (
                    <p className="mt-3 text-xs text-rose-700">{run.error}</p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}
