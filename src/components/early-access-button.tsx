"use client";
import { useState } from "react";

export default function EarlyAccessButton({
  plan,
  label,
}: {
  plan: "growth" | "pro";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");

    try {
      const res = await fetch("/api/early-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, plan, source: "pricing" }),
      });

      if (res.ok) {
        setStatus("done");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="button-primary w-full">
        {label ?? "Join early access"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-[28px] bg-white p-8 shadow-xl">
            <h2 className="text-xl font-semibold text-foreground">
              Join early access
            </h2>
            <p className="mt-2 text-sm leading-7 text-muted">
              We are onboarding founding clinics free of charge. Enter your
              email and we will be in touch within 24 hours.
            </p>

            {status === "done" ? (
              <div className="mt-6 rounded-[20px] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <p className="font-semibold">You are on the list</p>
                <p className="mt-1">
                  We will email you within 24 hours with your early access link.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <input
                  type="email"
                  required
                  placeholder="your@clinic.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-2xl border border-border px-4 py-3 text-sm outline-none focus:border-brand"
                />
                <input type="hidden" value={plan} />

                {status === "error" && (
                  <p className="text-sm text-rose-600">
                    Something went wrong. Please try again.
                  </p>
                )}

                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="button-primary w-full"
                >
                  {status === "loading" ? "Sending..." : "Request early access"}
                </button>
              </form>
            )}

            <button
              onClick={() => setOpen(false)}
              className="mt-4 w-full text-center text-sm text-muted hover:text-foreground"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
