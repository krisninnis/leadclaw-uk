"use client";

import { useState } from "react";

type PlanSlug = "basic" | "growth" | "pro";

export default function PortalPlanUpgrade({
  email,
}: {
  email?: string | null;
}) {
  const [plan, setPlan] = useState<PlanSlug>("growth");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function activatePlan() {
    if (plan === "basic") {
      setStatus(
        "Basic is free and does not require checkout. We will wire this option into your post-trial downgrade flow.",
      );
      return;
    }

    setLoading(true);
    setStatus("Opening secure checkout…");

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, email: email || "" }),
      });

      const data = await res.json();

      if (!res.ok || !data?.url) {
        setStatus(data?.error || "Checkout unavailable right now.");
        return;
      }

      window.location.assign(data.url);
    } catch {
      setStatus("Checkout unavailable right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border bg-white p-6 space-y-4">
      <h2 className="text-lg font-semibold">Choose your package</h2>

      <p className="text-sm text-slate-600">
        Stay on Growth for full automation, upgrade to Pro for advanced support,
        or move to Basic if you only want the free widget.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <select
          className="rounded border px-3 py-2 text-sm"
          value={plan}
          onChange={(e) => setPlan(e.target.value as PlanSlug)}
        >
          <option value="basic">Basic — Free</option>
          <option value="growth">Growth — Paid</option>
          <option value="pro">Pro — Paid</option>
        </select>

        <button
          onClick={activatePlan}
          disabled={loading}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          {loading
            ? "Opening…"
            : plan === "basic"
              ? "Choose free Basic"
              : "Activate monthly subscription"}
        </button>
      </div>

      <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
        {plan === "basic" ? (
          <p>
            Basic gives you the free AI receptionist widget with limited
            functionality and no manual support.
          </p>
        ) : plan === "growth" ? (
          <p>
            Growth is the best option for most clinics and includes your core
            automation and follow-up tools.
          </p>
        ) : (
          <p>
            Pro is for clinics that want advanced automation, premium support,
            and stronger growth tooling.
          </p>
        )}
      </div>

      {status && <p className="text-xs text-slate-600">{status}</p>}
    </div>
  );
}
