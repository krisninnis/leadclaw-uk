"use client";

import { useEffect, useState } from "react";
import { WEBSITE_PRIVACY_ACK_LABEL } from "@/lib/legal-consent";

// Part 4: informational customer privacy acknowledgement on the install/setup
// flow. It records an affirmative acknowledgement (timestamp + version) but does
// NOT block product usage — the widget and the rest of the page work regardless.
export default function InstallPrivacyAcknowledgement() {
  const [acked, setAcked] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/account/consent")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d?.ok && d.consent?.websitePrivacyAckAt) {
          setAcked(true);
          setSavedAt(d.consent.websitePrivacyAckAt);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleChange(checked: boolean) {
    setAcked(checked);
    // Only an affirmative acknowledgement is recorded; this is informational and
    // never blocks usage, so failures are swallowed silently.
    if (!checked) return;
    setSaving(true);
    try {
      const res = await fetch("/api/account/consent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ websitePrivacyAck: true }),
      });
      const data = await res.json();
      if (data?.ok && data.consent?.websitePrivacyAckAt) {
        setSavedAt(data.consent.websitePrivacyAckAt);
      }
    } catch {
      /* informational only */
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 rounded-[24px] border border-border bg-surface-2 p-5">
      <label className="flex items-start gap-3 text-sm leading-7 text-muted">
        <input
          type="checkbox"
          checked={acked}
          onChange={(e) => handleChange(e.target.checked)}
          className="mt-1 h-4 w-4 shrink-0"
        />
        <span>{WEBSITE_PRIVACY_ACK_LABEL}</span>
      </label>
      {savedAt && (
        <p className="mt-2 pl-7 text-xs text-emerald-700">
          Acknowledged on {new Date(savedAt).toLocaleString()}.
        </p>
      )}
      {saving && (
        <p className="mt-2 pl-7 text-xs text-muted-2">Saving…</p>
      )}
    </div>
  );
}
