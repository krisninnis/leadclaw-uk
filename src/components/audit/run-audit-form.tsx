"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  defaultUrl?: string;
  compact?: boolean;
};

export default function RunAuditForm({ defaultUrl = "", compact = false }: Props) {
  const router = useRouter();
  const [url, setUrl] = useState(defaultUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/audit/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message || friendlyError(data.error));
        return;
      }
      // Server components re-read the latest audit on refresh.
      router.refresh();
      if (data.audit?.id) {
        router.push(`/portal/audit/${data.audit.id}`);
      }
    } catch {
      setError("Something went wrong running the audit. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={compact ? "flex flex-col gap-3 sm:flex-row" : "space-y-3"}>
      <input
        type="text"
        inputMode="url"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="yourclinic.co.uk"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        required
        className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-foreground outline-none focus:border-brand"
      />
      <button type="submit" disabled={loading || url.trim().length < 3} className="button-primary whitespace-nowrap">
        {loading ? "Auditing…" : "Run audit"}
      </button>
      {error ? (
        <p className="text-sm text-rose-600 sm:basis-full">{error}</p>
      ) : null}
    </form>
  );
}

function friendlyError(code?: string) {
  switch (code) {
    case "rate_limited":
      return "You're running audits too quickly. Please wait a minute and try again.";
    case "invalid_url":
    case "invalid_request":
      return "That doesn't look like a valid website URL.";
    case "no_previous_audit":
      return "Run an audit first before refreshing.";
    default:
      return "We couldn't complete the audit. Please try again.";
  }
}
