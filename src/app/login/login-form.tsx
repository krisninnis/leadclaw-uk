"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm({ next }: { next: string }) {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [status, setStatus] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);

  async function signInWithGoogle() {
    setGoogleLoading(true);
    setPasswordLoading(false);
    setMagicLinkLoading(false);
    setStatus("Redirecting to Google...");

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
            next,
          )}`,
        },
      });

      if (error) {
        setStatus(error.message);
        setGoogleLoading(false);
      }
    } catch {
      setStatus("Something went wrong. Please try again.");
      setGoogleLoading(false);
    }
  }

  async function signInWithPassword(e: FormEvent) {
    e.preventDefault();

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      setStatus("Enter your email and password.");
      return;
    }

    setPasswordLoading(true);
    setGoogleLoading(false);
    setMagicLinkLoading(false);
    setStatus("Signing you in...");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        setStatus(error.message);
        setPasswordLoading(false);
        return;
      }

      window.location.href = next;
    } catch {
      setStatus("Something went wrong. Please try again.");
      setPasswordLoading(false);
    }
  }

  async function sendMagicLink() {
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      setStatus("Enter your email first.");
      return;
    }

    setMagicLinkLoading(true);
    setGoogleLoading(false);
    setPasswordLoading(false);
    setStatus("Sending magic link...");

    try {
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
        setMagicLinkLoading(false);
        return;
      }

      setStatus("Magic link sent. Check your email.");
      setMagicLinkLoading(false);
    } catch {
      setStatus("Something went wrong. Please try again.");
      setMagicLinkLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white px-6 py-10">
      <div className="mx-auto max-w-md space-y-6">
        <div className="text-center">
          <p className="text-sm text-muted">LeadClaw</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
            Sign in to LeadClaw
          </h1>
          <p className="mt-3 text-sm text-muted">
            Access your clinic workspace with Google, password, or magic link.
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-white p-6 shadow-sm space-y-4">
          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={googleLoading || passwordLoading || magicLinkLoading}
            className="button-secondary w-full"
          >
            {googleLoading ? "Redirecting..." : "Continue with Google"}
          </button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-sm text-muted">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={signInWithPassword} className="space-y-3">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-premium w-full"
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-premium w-full"
            />

            <button
              type="submit"
              className="button-primary w-full"
              disabled={googleLoading || passwordLoading || magicLinkLoading}
            >
              {passwordLoading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <button
            type="button"
            onClick={sendMagicLink}
            disabled={googleLoading || passwordLoading || magicLinkLoading}
            className="w-full text-sm underline text-center text-muted"
          >
            {magicLinkLoading
              ? "Sending magic link..."
              : "Use magic link instead"}
          </button>

          {status ? <p className="text-sm text-muted">{status}</p> : null}
        </div>

        <p className="text-sm text-center text-muted">
          Don&apos;t have an account?{" "}
          <Link
            href="/free-trial?plan=growth"
            className="underline text-foreground"
          >
            Start free trial
          </Link>
        </p>
      </div>
    </div>
  );
}
