"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) return;

    setLoading(true);
    setStatus("Checking your account...");

    try {
      const checkRes = await fetch("/api/auth/check-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: trimmedEmail }),
      });

      const checkData = (await checkRes.json()) as {
        ok?: boolean;
        shouldLogin?: boolean;
        shouldStartTrial?: boolean;
      };

      if (!checkRes.ok || !checkData.ok) {
        setStatus("We could not verify this account right now.");
        setLoading(false);
        return;
      }

      if (checkData.shouldStartTrial) {
        window.location.href = `/free-trial?plan=growth&email=${encodeURIComponent(
          trimmedEmail,
        )}`;
        return;
      }

      if (!checkData.shouldLogin) {
        setStatus("We could not find an active account for this email.");
        setLoading(false);
        return;
      }

      setStatus("Sending magic link...");

      const supabase = createClient();

      const { error } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
            next,
          )}`,
        },
      });

      if (error) {
        setStatus(error.message);
        setLoading(false);
        return;
      }

      setStatus("Magic link sent. Check your email.");
      setLoading(false);
    } catch {
      setStatus("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="page-hero section-shell">
      <div className="container-shell">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <div>
              <div className="badge-soft mb-5">
                <span className="h-2 w-2 rounded-full bg-brand" />
                Secure clinic login
              </div>

              <h1 className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                Sign in to your LeadClaw portal
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
                Use your clinic email and we&apos;ll send you a secure magic
                link. No password needed.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <div className="card-premium p-4">
                  <p className="text-sm font-semibold text-foreground">
                    No password to remember
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    Sign in with a secure email link and go straight to your
                    LeadClaw workspace.
                  </p>
                </div>

                <div className="card-premium p-4">
                  <p className="text-sm font-semibold text-foreground">
                    Built for clinic teams
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    Access your portal, review enquiries, and manage your setup
                    from one place.
                  </p>
                </div>
              </div>

              <p className="mt-6 text-sm text-muted">
                New here?{" "}
                <Link
                  href="/free-trial?plan=growth"
                  className="font-medium text-foreground underline decoration-border-strong underline-offset-4 transition hover:text-brand-strong"
                >
                  Start a 7-day free trial
                </Link>
              </p>
            </div>

            <div className="card-premium p-6 md:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-strong">
                Magic link login
              </p>

              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                Enter your email
              </h2>

              <p className="mt-3 text-sm leading-7 text-muted">
                We&apos;ll send a secure sign-in link to your inbox.
              </p>

              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-medium text-foreground"
                  >
                    Work email
                  </label>
                  <input
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    required
                    placeholder="you@clinic.com"
                    className="input-premium rounded-2xl"
                  />
                </div>

                <div className="pt-2">
                  <button
                    className="button-primary w-full"
                    type="submit"
                    disabled={loading}
                  >
                    {loading ? "Checking account..." : "Send magic link"}
                  </button>
                </div>
              </form>

              {status ? (
                <div className="mt-4 rounded-[20px] border border-border bg-surface-2 p-4 text-sm text-muted">
                  {status}
                </div>
              ) : null}

              <div className="mt-6 rounded-[20px] border border-border bg-white p-4">
                <p className="text-sm font-semibold text-foreground">
                  Redirect after sign in
                </p>
                <p className="mt-2 text-sm text-muted">
                  You&apos;ll be sent to{" "}
                  <span className="font-medium text-foreground">{next}</span>{" "}
                  after using your email link.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
