"use client";

import Link from "next/link";
import { FormEvent, Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type PlanSlug = "basic";

function normalizePlan(_value: string | null): PlanSlug {
  return "basic";
}

function SignupContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  const plan = useMemo(
    () => normalizePlan(searchParams?.get("plan") ?? null),
    [searchParams],
  );

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [googleLoading, setGoogleLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [status, setStatus] = useState("");

  function buildNextUrl() {
    return `/portal?startBasic=1&setup=ready&plan=${plan}`;
  }

  async function signInWithGoogle() {
    setGoogleLoading(true);
    setPasswordLoading(false);
    setMagicLinkLoading(false);
    setStatus("");

    try {
      const next = buildNextUrl();

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(
            next,
          )}`,
        },
      });

      if (error) {
        setStatus(error.message);
        setGoogleLoading(false);
      }
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );
      setGoogleLoading(false);
    }
  }

  async function signUpWithPassword(e: FormEvent) {
    e.preventDefault();

    setPasswordLoading(true);
    setGoogleLoading(false);
    setMagicLinkLoading(false);
    setStatus("Creating your free Basic account...");

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const trimmedName = name.trim();

      if (!trimmedName) {
        setStatus("Enter your name.");
        setPasswordLoading(false);
        return;
      }

      if (!normalizedEmail) {
        setStatus("Enter your work email.");
        setPasswordLoading(false);
        return;
      }

      if (!password || !confirmPassword) {
        setStatus("Enter and confirm your password.");
        setPasswordLoading(false);
        return;
      }

      if (password.length < 8) {
        setStatus("Password must be at least 8 characters.");
        setPasswordLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        setStatus("Passwords do not match.");
        setPasswordLoading(false);
        return;
      }

      const next = buildNextUrl();

      const { error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(
            next,
          )}`,
          data: {
            name: trimmedName,
            plan,
          },
        },
      });

      if (error) {
        setStatus(error.message);
        setPasswordLoading(false);
        return;
      }

      setStatus(
        "Account created. Check your email to confirm your address and start your free Basic plan.",
      );
      setPasswordLoading(false);

      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );
      setPasswordLoading(false);
    }
  }

  async function sendMagicLink() {
    setMagicLinkLoading(true);
    setGoogleLoading(false);
    setPasswordLoading(false);
    setStatus("Preparing your magic link...");

    try {
      const normalizedEmail = email.trim().toLowerCase();

      if (!normalizedEmail) {
        setStatus("Enter your work email first.");
        setMagicLinkLoading(false);
        return;
      }

      const next = buildNextUrl();

      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(
            next,
          )}`,
          data: {
            name: name.trim(),
            plan,
          },
        },
      });

      if (error) {
        setStatus(error.message);
        setMagicLinkLoading(false);
        return;
      }

      setStatus(
        "Magic link sent. Check your email to confirm and start your free Basic plan.",
      );
      setMagicLinkLoading(false);
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );
      setMagicLinkLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white px-6 py-10">
      <div className="mx-auto max-w-md space-y-6">
        <div className="text-center">
          <p className="text-sm text-muted">LeadClaw</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
            Start your free Basic plan
          </h1>
          <p className="mt-3 text-sm text-muted">
            Get the free AI receptionist widget with a simple self-serve setup.
          </p>
          <p className="mt-2 text-xs font-medium text-muted-2">
            Free forever • no card required • upgrade to Growth or Pro anytime
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

          <p className="text-center text-xs text-muted-2">
            Fastest option — start Basic instantly with no card details
          </p>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-sm text-muted">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={signUpWithPassword} className="space-y-3">
            <input
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-premium w-full"
            />

            <input
              type="email"
              placeholder="Work email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-premium w-full"
            />

            <input
              type="password"
              placeholder="Create password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-premium w-full"
            />

            <input
              type="password"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input-premium w-full"
            />

            <button
              type="submit"
              className="button-primary w-full"
              disabled={googleLoading || passwordLoading || magicLinkLoading}
            >
              {passwordLoading ? "Creating account..." : "Create free account"}
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

        <p className="text-center text-sm text-muted">
          Want the full 7-day Growth trial instead?{" "}
          <Link
            href="/free-trial?plan=growth"
            className="underline text-foreground"
          >
            Start trial
          </Link>
        </p>

        <p className="text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="underline text-foreground">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

function SignupLoading() {
  return (
    <div className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-md">
        <div className="rounded-3xl border border-border bg-white p-6 shadow-sm">
          Loading...
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupLoading />}>
      <SignupContent />
    </Suspense>
  );
}
