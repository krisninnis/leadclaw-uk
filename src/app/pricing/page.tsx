"use client";

import { useState } from "react";

const tiers = [
  {
    key: "starter",
    name: "Starter",
    price: "£99/mo",
    points: ["Bot hosting", "Lead capture", "Email support"],
  },
  {
    key: "growth",
    name: "Growth",
    price: "£249/mo",
    points: [
      "Everything in Starter",
      "Follow-up automations",
      "Monthly optimization",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    price: "£499/mo",
    points: ["Everything in Growth", "Multi-channel setup", "Priority support"],
  },
];

export default function PricingPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");

  async function startCheckout(plan: string) {
    setStatus("Creating secure checkout...");

    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, email }),
    });

    const data = await res.json();

    if (!res.ok || !data.url) {
      setStatus(data.error || "Stripe is not fully configured yet.");
      return;
    }

    window.location.assign(data.url);
  }

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold">Pricing</h1>
      <p className="mb-4 text-slate-600">
        Start with a 7-day free trial. If no payment method is added before the
        trial ends, the subscription will not continue.
      </p>

      <div className="mb-8 max-w-md">
        <label className="mb-1 block text-sm font-medium">
          Email (used for checkout if you are not logged in)
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@clinic.com"
          className="w-full rounded-lg border border-slate-300 p-2"
        />
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className="rounded-xl border border-slate-200 bg-white p-6"
          >
            <h2 className="text-xl font-semibold">{tier.name}</h2>
            <p className="my-3 text-2xl font-bold">{tier.price}</p>
            <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
              {tier.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <button
              onClick={() => startCheckout(tier.key)}
              className="mt-5 w-full rounded-lg bg-slate-900 px-4 py-2 text-white"
            >
              Start 7-day trial
            </button>
          </div>
        ))}
      </div>

      {status && <p className="mt-4 text-sm text-slate-700">{status}</p>}
    </div>
  );
}
