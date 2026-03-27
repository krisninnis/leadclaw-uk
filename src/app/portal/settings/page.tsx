"use client";

import { useState, useEffect } from "react";

export default function PortalSettingsPage() {
  const [reviewUrl, setReviewUrl] = useState("");
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [reviewRequestsEnabled, setReviewRequestsEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/clinic-settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.google_review_url) setReviewUrl(d.google_review_url);
        if (typeof d.reminders_enabled === "boolean")
          setRemindersEnabled(d.reminders_enabled);
        if (typeof d.review_requests_enabled === "boolean")
          setReviewRequestsEnabled(d.review_requests_enabled);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);

    const res = await fetch("/api/clinic-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        google_review_url: reviewUrl || null,
        reminders_enabled: remindersEnabled,
        review_requests_enabled: reviewRequestsEnabled,
      }),
    });

    const data = await res.json();
    if (data.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      setError(data.error || "Failed to save.");
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <div className="card-premium p-6 md:p-8">
        <p className="text-xs font-medium uppercase tracking-widest text-muted">
          Settings
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          Clinic settings
        </h1>
        <p className="mt-2 text-sm leading-7 text-muted">
          Configure your clinic preferences and automation settings.
        </p>
      </div>

      {loading ? (
        <div className="card-premium p-6">
          <p className="text-sm text-muted">Loading settings...</p>
        </div>
      ) : (
        <>
          <div className="card-premium p-6 md:p-8">
            <h2 className="text-lg font-semibold text-foreground">
              Google review link
            </h2>
            <p className="mt-2 text-sm leading-7 text-muted">
              Paste your Google Business review link here. LeadClaw will
              automatically send a review request to patients 48 hours after
              their appointment. To find your link, go to your Google Business
              Profile, click "Ask for reviews" and copy the URL.
            </p>
            <div className="mt-6">
              <label className="block text-sm font-medium text-foreground">
                Review URL
              </label>
              <input
                type="url"
                value={reviewUrl}
                onChange={(e) => setReviewUrl(e.target.value)}
                placeholder="https://g.page/r/your-clinic/review"
                className="mt-1 w-full"
              />
              <p className="mt-2 text-xs text-muted">
                Leave blank to skip the review button in emails — the email will
                still be sent without a direct link.
              </p>
            </div>
          </div>

          <div className="card-premium p-6 md:p-8">
            <h2 className="text-lg font-semibold text-foreground">
              Automation settings
            </h2>
            <p className="mt-2 text-sm leading-7 text-muted">
              Control which automated emails LeadClaw sends on your behalf.
            </p>

            <div className="mt-6 space-y-4">
              <div className="flex items-start justify-between gap-4 rounded-[16px] border border-border bg-white p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Appointment reminders
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Send patients a reminder email 48 hours before and 2 hours
                    before their appointment.
                  </p>
                </div>
                <button
                  onClick={() => setRemindersEnabled((v) => !v)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${remindersEnabled ? "bg-emerald-500" : "bg-gray-200"}`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${remindersEnabled ? "translate-x-5" : "translate-x-0"}`}
                  />
                </button>
              </div>

              <div className="flex items-start justify-between gap-4 rounded-[16px] border border-border bg-white p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Review requests
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Send patients a Google review request 48 hours after their
                    appointment.
                  </p>
                </div>
                <button
                  onClick={() => setReviewRequestsEnabled((v) => !v)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${reviewRequestsEnabled ? "bg-emerald-500" : "bg-gray-200"}`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${reviewRequestsEnabled ? "translate-x-5" : "translate-x-0"}`}
                  />
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-[16px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {saved && (
            <div className="rounded-[16px] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
              Settings saved successfully.
            </div>
          )}

          <div className="flex">
            <button
              onClick={handleSave}
              disabled={saving}
              className="button-primary"
            >
              {saving ? "Saving..." : "Save settings"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
