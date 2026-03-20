"use client";

import { useState } from "react";

export default function ManageBillingButton() {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    try {
      setLoading(true);

      const res = await fetch("/api/stripe/portal", {
        method: "POST",
      });

      const data = await res.json();

      if (!data.ok || !data.url) {
        alert("Unable to open billing portal");
        return;
      }

      window.location.href = data.url;
    } catch (e) {
      alert("Something went wrong opening billing");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      className="button-secondary"
      disabled={loading}
    >
      {loading ? "Opening..." : "Manage billing"}
    </button>
  );
}
