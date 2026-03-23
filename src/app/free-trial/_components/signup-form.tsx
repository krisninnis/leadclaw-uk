"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";

type Props = {
  onSuccess: (email: string) => void;
  selectedPlan: string;
  buildIntake: () => object;
  saveTrialIntake: (intake: object) => void;
  saveIntakeToBackend: (intake: object) => Promise<void>;
  buildNextUrl: () => string;
  supabase: ReturnType<typeof import("@/lib/supabase/client").createClient>;
};

export default function SignupForm({
  onSuccess,
  buildIntake,
  saveTrialIntake,
  saveIntakeToBackend,
  buildNextUrl,
  supabase,
}: Props) {
  const [clinicName, setClinicName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);

  const isLoading = googleLoading || passwordLoading || magicLinkLoading;

  async function signInWithGoogle() {
    setGoogleLoading(true);
    setStatus("");
    try {
      const intake = buildIntake();
      saveTrialIntake(intake);
      await saveIntakeToBackend(intake);
      const next = buildNextUrl();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (error) {
        setStatus(error.message);
        setGoogleLoading(false);
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Something went wrong.");
      setGoogleLoading(false);
    }
  }

  async function signUpWithPassword(e: FormEvent) {
    e.preventDefault();
    setPasswordLoading(true);
    setStatus("Creating your account...");
    try {
      if (!contactName.trim()) {
        setStatus("Enter your name.");
        setPasswordLoading(false);
        return;
      }
      if (!email.trim()) {
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

      const intake = buildIntake();
      saveTrialIntake(intake);
      await saveIntakeToBackend(intake);

      const next = buildNextUrl();
      const { error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(next)}`,
          data: { name: contactName.trim() },
        },
      });

      if (error) {
        setStatus(error.message);
        setPasswordLoading(false);
        return;
      }

      setPasswordLoading(false);
      onSuccess(email.trim().toLowerCase());
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Something went wrong.");
      setPasswordLoading(false);
    }
  }

  async function sendMagicLink() {
    setMagicLinkLoading(true);
    setStatus("Preparing your magic link...");
    try {
      if (!email.trim()) {
        setStatus("Enter your work email first.");
        setMagicLinkLoading(false);
        return;
      }

      const intake = buildIntake();
      saveTrialIntake(intake);
      await saveIntakeToBackend(intake);

      const next = buildNextUrl();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });

      if (error) {
        setStatus(error.message);
        setMagicLinkLoading(false);
        return;
      }

      setMagicLinkLoading(false);
      onSuccess(email.trim().toLowerCase());
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Something went wrong.");
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
            disabled={isLoading}
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
              disabled={isLoading}
            >
              {passwordLoading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <button
            type="button"
            onClick={sendMagicLink}
            disabled={isLoading}
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
