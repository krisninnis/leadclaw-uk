"use client";

import { useState } from "react";

const tiers = [
  {
    key: "starter",
    name: "Starter",
    price: "£99/mo",
    description:
      "For clinics that want to capture website enquiries and stop missing leads.",
    points: [
      "Website enquiry widget",
      "Clinic lead inbox",
      "Portal dashboard",
      "Email notifications",
      "Email support",
    ],
  },
  {
    key: "growth",
    name: "Growth",
    price: "£249/mo",
    description:
      "For clinics that want better follow-up and more value from every enquiry.",
    points: [
      "Everything in Starter",
      "Follow-up automations",
      "Lead recovery tools",
      "Monthly optimisation support",
      "Growth-focused support",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    price: "£499/mo",
    description:
      "For clinics that want a more hands-on growth and optimisation setup.",
    points: [
      "Everything in Growth",
      "Multi-location or advanced setup",
      "Priority support",
      "Higher-touch onboarding",
      "Ongoing optimisation support",
    ],
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
    <div className="space-y-8">
      <div>
        <h1 className="mb-4 text-3xl font-bold">Pricing</h1>
        <p className="max-w-3xl text-slate-600">
          LeadClaw helps clinics capture missed website enquiries and see them
          instantly in a simple lead inbox. Start with a 7-day free trial. If no
          payment method is added before the trial ends, the subscription will
          not continue.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <h2 className="mb-2 text-lg font-semibold">
          What every plan helps you do
        </h2>
        <p className="text-sm text-slate-700">
          Capture website enquiries, stop missing leads when your team is busy
          or out of hours, and follow up faster from one simple portal.
        </p>
      </div>

      <div className="max-w-md">
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
            <p className="mb-4 text-sm text-slate-600">{tier.description}</p>

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

      {status && <p className="text-sm text-slate-700">{status}</p>}
    </div>
  );
}
