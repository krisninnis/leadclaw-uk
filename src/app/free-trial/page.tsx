"use client";

import Link from "next/link";
import { FormEvent, Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type PlanSlug = "starter" | "growth" | "pro";

const TRIAL_INTAKE_KEY = "leadclaw_trial_intake";

function normalizePlan(value: string | null): PlanSlug {
  if (value === "starter") return "starter";
  if (value === "pro") return "pro";
  return "growth";
}

type TrialIntake = {
  clinicName: string;
  contactName: string;
  email: string;
  website: string;
  phone: string;
  plan: PlanSlug;
  createdAt: string;
};

function FreeTrialContent() {
  const searchParams = useSearchParams();
  const supabase = createClient();

  const selectedPlan = useMemo(
    () => normalizePlan(searchParams?.get("plan") ?? null),
    [searchParams],
  );

  const [clinicName, setClinicName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);

  function buildIntake(): TrialIntake {
    return {
      clinicName: clinicName.trim(),
      contactName: contactName.trim(),
      email: email.trim().toLowerCase(),
      website: website.trim(),
      phone: phone.trim(),
      plan: selectedPlan,
      createdAt: new Date().toISOString(),
    };
  }

  function saveTrialIntake(intake: TrialIntake) {
    try {
      window.sessionStorage.setItem(TRIAL_INTAKE_KEY, JSON.stringify(intake));
    } catch {
      // ignore storage errors
    }
  }

  async function saveIntakeToBackend(intake: TrialIntake) {
    const res = await fetch("/api/trial/intake", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(intake),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || "Failed to save details.");
    }
  }

  function buildNextUrl() {
    return `/portal?startTrial=1&trial=started&setup=ready&plan=${selectedPlan}`;
  }

  async function signInWithGoogle() {
    setGoogleLoading(true);
    setLoading(false);
    setPasswordLoading(false);
    setMagicLinkLoading(false);
    setStatus("Saving your details...");

    try {
      const intake = buildIntake();

      if (!intake.email) {
        setStatus("Enter your work email first.");
        setGoogleLoading(false);
        return;
      }

      saveTrialIntake(intake);
      await saveIntakeToBackend(intake);

      setStatus("Redirecting to Google...");

      const next = buildNextUrl();

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
    setLoading(false);
    setGoogleLoading(false);
    setMagicLinkLoading(false);
    setStatus("Creating your account...");

    try {
      const intake = buildIntake();

      if (!intake.email) {
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

      saveTrialIntake(intake);
      await saveIntakeToBackend(intake);

      const next = buildNextUrl();

      const { error } = await supabase.auth.signUp({
        email: intake.email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
            next,
          )}`,
        },
      });

      if (error) {
        setStatus(error.message);
        setPasswordLoading(false);
        return;
      }

      setStatus(
        "Account created. Check your email to confirm your address and activate your free trial.",
      );
      setPasswordLoading(false);
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
    setLoading(false);
    setGoogleLoading(false);
    setPasswordLoading(false);
    setStatus("Preparing your magic link...");

    try {
      const intake = buildIntake();

      if (!intake.email) {
        setStatus("Enter your work email first.");
        setMagicLinkLoading(false);
        return;
      }

      saveTrialIntake(intake);
      await saveIntakeToBackend(intake);

      const next = buildNextUrl();

      const { error } = await supabase.auth.signInWithOtp({
        email: intake.email,
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

      setStatus(
        "Magic link sent. Check your email to confirm and activate your free trial.",
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
            Start your 7-day free trial
          </h1>
          <p className="mt-3 text-sm text-muted">
            Create your clinic account and begin setup on the{" "}
            <span className="font-medium text-foreground">{selectedPlan}</span>{" "}
            plan.
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-white p-6 shadow-sm space-y-4">
          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={googleLoading || passwordLoading || magicLinkLoading}
            className="button-secondary w-full"
          >
            {googleLoading ? "Redirecting..." : "Sign up with Google"}
          </button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-sm text-muted">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={signUpWithPassword} className="space-y-3">
            <input
              placeholder="Clinic name"
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              className="input-premium w-full"
            />

            <input
              placeholder="Your name"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
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
              type="url"
              placeholder="Clinic website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="input-premium w-full"
            />

            <input
              type="tel"
              placeholder="Phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
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
              {passwordLoading ? "Creating account..." : "Create account"}
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
          Already have an account?{" "}
          <Link href="/login" className="underline text-foreground">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

function FreeTrialLoading() {
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

export default function FreeTrialPage() {
  return (
    <Suspense fallback={<FreeTrialLoading />}>
      <FreeTrialContent />
    </Suspense>
  );
}
