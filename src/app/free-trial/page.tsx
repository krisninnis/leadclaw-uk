"use client";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import SignupForm from "./_components/signup-form";
import NotificationStep from "./_components/notification-step";

type PlanSlug = "growth";
const TRIAL_INTAKE_KEY = "leadclaw_trial_intake";

function normalizePlan(_value: string | null): PlanSlug {
  return "growth";
}

function FreeTrialContent() {
  const searchParams = useSearchParams();
  const supabase = createClient();
  const selectedPlan = useMemo(
    () => normalizePlan(searchParams?.get("plan") ?? null),
    [searchParams],
  );

  const [step, setStep] = useState<"signup" | "notifications">("signup");
  const [signedUpEmail, setSignedUpEmail] = useState("");

  function buildIntake() {
    return {
      clinicName: "",
      contactName: "",
      email: signedUpEmail,
      website: "",
      phone: "",
      city: "",
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
    return `/portal?startTrial=1&trial=started&setup=ready&plan=growth`;
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
