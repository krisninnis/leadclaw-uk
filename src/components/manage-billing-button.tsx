"use client";

import { useState } from "react";

export default function ManageBillingButton({
  label = "Manage billing",
  className = "button-secondary",
}: {
  label?: string;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/stripe/portal", {
        method: "POST",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok || !data.url) {
        setError(
          data?.error === "no_billing_customer_found"
            ? "No Stripe billing profile was found. Please contact support."
            : "Unable to open Manage billing right now. Please try again.",
        );
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("Unable to open Manage billing right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        className={className}
        disabled={loading}
      >
        {loading ? "Opening Manage billing..." : label}
      </button>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
