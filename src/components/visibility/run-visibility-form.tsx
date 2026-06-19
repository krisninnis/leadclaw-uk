"use client";

// Phase 3 — AI Visibility (Foundation)
// Generates a visibility scan from the user's latest audit. There is no URL to
// type: the scan reuses the most recent website audit, so this is a single
// action button (mirrors the audit run-form's submit behaviour).

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  label?: string;
  compact?: boolean;
};

export default function RunVisibilityForm({
  label = "Generate readiness report",
  compact = false,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/visibility/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message || friendlyError(data.error));
        return;
      }
      // Server component re-reads the latest scan on refresh.
      router.refresh();
    } catch {
      setError("Something went wrong generating your readiness report. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={compact ? "flex flex-col gap-2" : "space-y-2"}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="button-primary whitespace-nowrap"
      >
        {loading ? "Analysing…" : label}
      </button>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}

function friendlyError(code?: string) {
  switch (code) {
    case "rate_limited":
      return "You're generating reports too quickly. Please wait a minute and try again.";
    case "no_audit":
      return "Run a website audit first — your readiness report is built from it.";
    case "audit_failed":
      return "Your latest audit couldn't load the site, so we can't score readiness yet. Re-run the audit, then try again.";
    case "invalid_request":
      return "That request didn't look right. Please try again.";
    default:
      return "We couldn't generate your readiness report. Please try again.";
  }
}
