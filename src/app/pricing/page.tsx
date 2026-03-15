"use client";

import { useRef, useState } from "react";

const tiers = [
  {
    key: "starter",
    name: "Starter",
    price: "£39/mo",
    points: ["Bot hosting", "Lead capture", "Email support"],
  },
  {
    key: "growth",
    name: "Growth",
    price: "£99/mo",
    points: [
      "Everything in Starter",
      "Follow-up automations",
      "Monthly optimization",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    price: "£249/mo",
    points: ["Everything in Growth", "Multi-channel setup", "Priority support"],
  },
];

export default function PricingPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [emailError, setEmailError] = useState("");
  const emailInputRef = useRef<HTMLInputElement | null>(null);

  async function startCheckout(plan: string) {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setEmailError("Please enter your email before starting the free trial.");
      setStatus("");
      emailInputRef.current?.focus();
      return;
    }

    setEmailError("");
    setStatus("Creating secure checkout...");

    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, email: trimmedEmail }),
    });

    const data = await res.json();

    if (!res.ok || !data.url) {
      setStatus(data.error || "Stripe not fully configured yet.");
      return;
    }

    window.location.assign(data.url);
  }

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold">Pricing</h1>
      <p className="mb-4 text-slate-600">
        7-day free trial. No automatic rollover — client must explicitly
        continue after trial.
      </p>

      <div className="mb-8 max-w-md">
        <label className="mb-1 block text-sm font-medium">
          Email (for checkout)
        </label>
        <input
          ref={emailInputRef}
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (emailError) setEmailError("");
          }}
          placeholder="you@clinic.com"
          className={`w-full rounded-lg border p-2 ${
            emailError ? "border-red-500" : "border-slate-300"
          }`}
          aria-invalid={emailError ? "true" : "false"}
        />
        {emailError && (
          <p className="mt-2 text-sm text-red-600">{emailError}</p>
        )}
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
