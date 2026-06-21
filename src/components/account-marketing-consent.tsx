"use client";

import { useEffect, useState } from "react";
import { MARKETING_CONSENT_LABEL } from "@/lib/legal-consent";

// Part 2: marketing-consent toggle for portal settings. Read/write via
// /api/account/consent. Stored separately from legal acceptance; unticked by
// default; toggling here is the "changeable later in settings" requirement.
export default function AccountMarketingConsent() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/account/consent")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d?.ok) setEnabled(d.consent?.marketingConsent === true);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle() {
    const next = !enabled;
    setEnabled(next);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/account/consent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ marketingConsent: next }),
      });
      const data = await res.json();
      if (!data?.ok) {
        setEnabled(!next); // revert on failure
        setError(data?.error || "Could not update your preference.");
      }
    } catch {
      setEnabled(!next);
      setError("Could not update your preference.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card-premium p-6 md:p-8">
      <h2 className="text-lg font-semibold text-foreground">
        Marketing emails
      </h2>
      <p className="mt-2 text-sm leading-7 text-muted">
        This is separate from your Terms and Privacy acceptance. You can change it
        at any time.
      </p>

      <div className="mt-6 flex items-start justify-between gap-4 rounded-[16px] border border-border bg-white p-4">
        <div>
          <p className="text-sm font-medium text-foreground">
            {MARKETING_CONSENT_LABEL}
          </p>
          <p className="mt-1 text-xs text-muted">
            Optional. We only send product updates and announcements when this is
            on.
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={loading || saving}
          aria-pressed={enabled}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors disabled:opacity-60 ${
            enabled ? "bg-emerald-500" : "bg-gray-200"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
