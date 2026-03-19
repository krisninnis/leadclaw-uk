"use client";

import { useState } from "react";

export default function PortalTrialCta() {
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function startTrial() {
    setLoading(true);
    setStatus("Starting your no-card trial...");

    try {
      const res = await fetch("/api/trial/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan: "growth" }),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        setStatus(data?.error || "Could not start trial right now.");
        return;
      }

      setStatus("Trial started. Refreshing portal...");
      window.location.assign("/portal?trial=started&plan=growth");
    } catch {
      setStatus("Could not start trial right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold">Start your free trial</p>
          <p className="text-xs text-slate-600">
            7-day trial on the Growth plan. No auto-renew at trial end.
          </p>
        </div>

        <button
          onClick={startTrial}
          disabled={loading}
          className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? "Starting..." : "Start 7-day free trial"}
        </button>
      </div>

      {status && <p className="mt-2 text-xs text-slate-600">{status}</p>}
    </div>
  );
}
