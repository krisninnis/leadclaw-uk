"use client";
import { useState } from "react";

export default function PortalPlanUpgrade({
  email,
}: {
  email?: string | null;
}) {
  const earlyAccessMode =
    process.env["NEXT_PUBLIC_EARLY_ACCESS_MODE"] === "true";
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );

  async function handleEarlyAccess() {
    if (!email) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/early-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          plan: "growth",
          source: "portal_upgrade",
        }),
      });
      setStatus(res.ok ? "done" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (earlyAccessMode) {
    return (
      <div className="space-y-3">
        {status === "done" ? (
          <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <p className="font-semibold">You are on the early access list</p>
            <p className="mt-1">We will email you within 24 hours.</p>
          </div>
        ) : (
          <button
            onClick={handleEarlyAccess}
            disabled={status === "loading"}
            className="button-primary"
          >
            {status === "loading" ? "Saving..." : "Join early access — Growth"}
          </button>
        )}
        <p className="text-xs text-muted">
          Paid plans launch soon. Founding clinics get priority access and
          locked-in pricing.
        </p>
      </div>
    );
  }

  // Normal Stripe flow when not in early access
  return (
    <a href="/portal/billing" className="button-primary">
      View plans and upgrade
    </a>
  );
}
