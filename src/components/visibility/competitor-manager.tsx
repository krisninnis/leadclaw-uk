"use client";

// AI Readiness — Competitor Benchmarking V1
// Client controls for the benchmark: add a competitor URL, remove one, and run
// the benchmark. All mutations hit the /api/visibility/competitors* routes and
// then router.refresh() so the server component re-reads and recomputes the
// comparison. The read-only comparison table itself is server-rendered.

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/lib/analytics";
import { Trash2 } from "lucide-react";

export type ManagerCompetitor = {
  id: string;
  websiteUrl: string;
  label: string;
  state: "scored" | "failed" | "pending";
  lastCheckedAt: string | null;
};

type Props = {
  competitors: ManagerCompetitor[];
  max: number;
};

const STATE_LABEL: Record<ManagerCompetitor["state"], string> = {
  scored: "Checked",
  failed: "Couldn't check",
  pending: "Not checked yet",
};

const STATE_CLASS: Record<ManagerCompetitor["state"], string> = {
  scored: "border-emerald-200 bg-emerald-50 text-emerald-700",
  failed: "border-rose-200 bg-rose-50 text-rose-700",
  pending: "border-border bg-surface-2 text-muted",
};

export default function CompetitorManager({ competitors, max }: Props) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [running, setRunning] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const atMax = competitors.length >= max;
  const busy = adding || running || removingId !== null;

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!url.trim()) {
      setError("Enter a competitor website URL.");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/visibility/competitors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          label: label.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message || friendlyError(data.error, max));
        return;
      }
      setUrl("");
      setLabel("");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(id: string) {
    setError(null);
    setNotice(null);
    setRemovingId(id);
    try {
      const res = await fetch(`/api/visibility/competitors/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError("Couldn't remove that competitor. Please try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setRemovingId(null);
    }
  }

  async function handleRun() {
    setError(null);
    setNotice(null);
    setRunning(true);
    track("competitor_benchmark_started", { competitors: competitors.length });
    try {
      const res = await fetch("/api/visibility/competitors/benchmark", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message || friendlyError(data.error, max));
        return;
      }
      if (typeof data.failed === "number" && data.failed > 0) {
        setNotice(
          `Checked ${data.total} competitor${data.total === 1 ? "" : "s"} — ${data.failed} couldn't be reached. Verify those URLs and try again.`,
        );
      }
      track("competitor_benchmark_completed", {
        total: typeof data.total === "number" ? data.total : null,
        failed: typeof data.failed === "number" ? data.failed : null,
      });
      router.refresh();
    } catch {
      setError("Something went wrong running the benchmark. Please try again.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-[22px] border border-border bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium text-foreground">Your competitors</p>
          <p className="text-sm text-muted">
            {competitors.length} of {max} added
          </p>
        </div>
        <button
          type="button"
          onClick={handleRun}
          disabled={busy || competitors.length === 0}
          className="button-primary whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? "Benchmarking…" : "Run benchmark"}
        </button>
      </div>

      {competitors.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {competitors.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-[16px] border border-border bg-surface-2 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{c.label}</p>
                <p className="truncate text-xs text-muted-2">{c.websiteUrl}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATE_CLASS[c.state]}`}
                >
                  {STATE_LABEL[c.state]}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(c.id)}
                  disabled={busy}
                  aria-label={`Remove ${c.label}`}
                  className="rounded-full p-1.5 text-muted-2 transition hover:bg-white hover:text-rose-600 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm leading-7 text-muted">
          Add 1–5 competitor websites to benchmark your AI readiness against
          them.
        </p>
      )}

      {!atMax ? (
        <form
          onSubmit={handleAdd}
          className="mt-4 flex flex-col gap-2 sm:flex-row"
        >
          <input
            type="text"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="competitor.co.uk"
            disabled={adding}
            className="min-w-0 flex-1 rounded-[14px] border border-border bg-white px-4 py-2.5 text-sm text-foreground outline-none focus:border-brand-strong"
          />
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (optional)"
            disabled={adding}
            className="min-w-0 rounded-[14px] border border-border bg-white px-4 py-2.5 text-sm text-foreground outline-none focus:border-brand-strong sm:w-44"
          />
          <button
            type="submit"
            disabled={adding}
            className="button-secondary whitespace-nowrap disabled:opacity-50"
          >
            {adding ? "Adding…" : "Add competitor"}
          </button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-muted-2">
          You’ve reached the {max}-competitor limit. Remove one to add another.
        </p>
      )}

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      {notice ? <p className="mt-3 text-sm text-amber-700">{notice}</p> : null}
    </div>
  );
}

function friendlyError(code?: string, max = 5) {
  switch (code) {
    case "rate_limited":
      return "You're benchmarking too quickly. Please wait a minute and try again.";
    case "invalid_url":
      return "That doesn't look like a valid website URL.";
    case "duplicate":
      return "You're already tracking that competitor.";
    case "limit_reached":
      return `You can track up to ${max} competitors. Remove one to add another.`;
    case "no_competitors":
      return "Add at least one competitor before running a benchmark.";
    case "invalid_request":
      return "That request didn't look right. Please try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}
