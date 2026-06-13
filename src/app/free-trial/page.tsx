"use client";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { normalizeTrialPlan } from "@/lib/plans";
import AccountFlowNotice from "@/components/auth/account-flow-notice";
import SignupForm from "./_components/signup-form";
import NotificationStep from "./_components/notification-step";

const TRIAL_INTAKE_KEY = "leadclaw_trial_intake";

type TrialIntakeInput = {
  clinicName: string;
  contactName: string;
  email: string;
  website: string;
  phone: string;
  city: string;
};

function FreeTrialContent() {
  const searchParams = useSearchParams();
  const supabase = createClient();
  const selectedPlan = useMemo(
    () => normalizeTrialPlan(searchParams?.get("plan") ?? null),
    [searchParams],
  );
  const flowError = searchParams?.get("error") ?? null;

  const [step, setStep] = useState<"signup" | "notifications">("signup");
  const [signedUpEmail, setSignedUpEmail] = useState("");

  function buildIntake(input: TrialIntakeInput) {
    return {
      clinicName: input.clinicName.trim(),
      contactName: input.contactName.trim(),
      email: input.email.trim().toLowerCase() || signedUpEmail,
      website: input.website.trim(),
      phone: input.phone.trim(),
      city: input.city.trim(),
      plan: selectedPlan,
      createdAt: new Date().toISOString(),
    };
  }

  function saveTrialIntake(intake: object) {
    try {
      window.sessionStorage.setItem(TRIAL_INTAKE_KEY, JSON.stringify(intake));
    } catch {}
  }

  async function saveIntakeToBackend(intake: object) {
    const res = await fetch("/api/trial/intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

  async function handleNotificationSave(whatsapp: string, sms: string) {
    try {
      await fetch("/api/trial/notification-prefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notifyWhatsapp: whatsapp || null,
          notifySms: sms || null,
        }),
      });
    } catch {}
    window.location.href = buildNextUrl();
  }

  if (step === "notifications") {
    return (
      <NotificationStep
        onSave={handleNotificationSave}
        onSkip={() => {
          window.location.href = buildNextUrl();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {flowError ? (
        <div className="mx-auto max-w-md px-6 pt-10">
          <AccountFlowNotice error={flowError} />
        </div>
      ) : null}
      <SignupForm
        onSuccess={(email) => {
          setSignedUpEmail(email);
          setStep("notifications");
        }}
        selectedPlan={selectedPlan}
        buildIntake={buildIntake}
        saveTrialIntake={saveTrialIntake}
        saveIntakeToBackend={saveIntakeToBackend}
        buildNextUrl={buildNextUrl}
        supabase={supabase}
      />
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
