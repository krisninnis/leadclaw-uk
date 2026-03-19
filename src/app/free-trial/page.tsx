"use client";

import Link from "next/link";
import { FormEvent, Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type PlanSlug = "growth";

const TRIAL_INTAKE_KEY = "leadclaw_trial_intake";

function normalizePlan(_value: string | null): PlanSlug {
  return "growth";
}

type TrialIntake = {
  clinicName: string;
  contactName: string;
  email: string;
  website: string;
  phone: string;
  city: string;
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
  const [city, setCity] = useState("");

  const [status, setStatus] = useState("");
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
      city: city.trim(),
      plan: selectedPlan,
      createdAt: new Date().toISOString(),
    };
  }

  function saveTrialIntake(intake: TrialIntake) {
    try {
      window.sessionStorage.setItem(TRIAL_INTAKE_KEY, JSON.stringify(intake));
    } catch {}
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
    return `/portal?startTrial=1&trial=started&setup=ready&plan=growth`;
  }

  async function signInWithGoogle() {
    setGoogleLoading(true);
    setPasswordLoading(false);
    setMagicLinkLoading(false);
    setStatus("");

    try {
      const intake = buildIntake();

      saveTrialIntake(intake);

      const hasAnyTypedDetails =
        intake.clinicName ||
        intake.contactName ||
        intake.email ||
        intake.website ||
        intake.phone ||
        intake.city;

      if (hasAnyTypedDetails) {
        await saveIntakeToBackend(intake);
      }

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
    setStatus("Creating your account...");

    try {
      const intake = buildIntake();

      if (!intake.contactName) {
        setStatus("Enter your name.");
        setPasswordLoading(false);
        return;
      }

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
          emailRedirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(
            next,
          )}`,
          data: {
            name: intake.contactName,
          },
        },
      });

      if (error) {
        setStatus(error.message);
        setPasswordLoading(false);
        return;
      }

      setStatus(
        "Account created. Check your email to confirm your address and start your 7-day Growth trial.",
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
          emailRedirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(
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
        "Magic link sent. Check your email to confirm and start your 7-day Growth trial.",
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
            Start on the{" "}
            <span className="font-medium text-foreground">Growth</span> plan for
            7 days with full access to the core LeadClaw workflow.
          </p>
          <p className="mt-2 text-xs font-medium text-muted-2">
            No card required • keep Growth, upgrade to Pro, or switch to free
            Basic after the trial
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
            Fastest option — start your Growth trial with no card details
          </p>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-sm text-muted">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={signUpWithPassword} className="space-y-3">
            <input
              placeholder="Clinic name (optional)"
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
              placeholder="Clinic website (optional)"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="input-premium w-full"
            />
            <input
              type="tel"
              placeholder="Phone number (optional)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input-premium w-full"
            />
            <input
              type="text"
              placeholder="City (optional)"
              value={city}
              onChange={(e) => setCity(e.target.value)}
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
          Want the free widget only?{" "}
          <Link href="/signup?plan=basic" className="underline text-foreground">
            Start Basic instead
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
