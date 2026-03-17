"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type PlanSlug = "starter" | "growth" | "pro";

const planConfig: Record<
  PlanSlug,
  {
    name: string;
    mascot: string;
    priceLabel: string;
    description: string;
    badgeClass: string;
    cardClass: string;
    buttonClass: string;
    mascotSrc: string;
    included: string[];
  }
> = {
  starter: {
    name: "Starter",
    mascot: "Fox",
    priceLabel: "£39/month after trial",
    description:
      "A friendly starting point for clinics that want to begin capturing missed website enquiries.",
    badgeClass: "border-amber-200 bg-amber-100 text-amber-800",
    cardClass:
      "border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,0.95),rgba(255,255,255,0.96))]",
    buttonClass:
      "inline-flex items-center justify-center rounded-full bg-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-amber-600",
    mascotSrc: "/brand/mascots/fox-starter.png",
    included: [
      "AI website enquiry widget",
      "Lead capture into clinic portal",
      "Email notifications",
      "Simple setup flow",
    ],
  },
  growth: {
    name: "Growth",
    mascot: "Panther",
    priceLabel: "£99/month after trial",
    description:
      "The best all-round option for most clinics that want a stronger, more premium follow-up workflow.",
    badgeClass: "border-violet-200 bg-violet-100 text-violet-800",
    cardClass:
      "border-violet-200 bg-[linear-gradient(180deg,rgba(248,245,255,0.96),rgba(255,255,255,0.96))]",
    buttonClass:
      "button-primary inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold",
    mascotSrc: "/brand/mascots/panther-growth.png",
    included: [
      "Everything in Starter",
      "Priority clinic workflow",
      "Improved lead visibility",
      "Best fit for growing clinics",
    ],
  },
  pro: {
    name: "Pro",
    mascot: "Dragon",
    priceLabel: "£249/month after trial",
    description:
      "A premium plan for ambitious clinics that want the strongest LeadClaw setup and brand presentation.",
    badgeClass: "border-cyan-200 bg-cyan-100 text-cyan-800",
    cardClass:
      "border-cyan-200 bg-[linear-gradient(180deg,rgba(236,254,255,0.96),rgba(255,255,255,0.96))]",
    buttonClass:
      "inline-flex items-center justify-center rounded-full bg-cyan-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-cyan-700",
    mascotSrc: "/brand/mascots/dragon-elite.png",
    included: [
      "Everything in Growth",
      "Premium plan positioning",
      "Best for high-intent clinics",
      "Top-tier LeadClaw experience",
    ],
  },
};

function normalizePlan(value: string | null): PlanSlug {
  if (value === "starter") return "starter";
  if (value === "pro") return "pro";
  return "growth";
}

function FreeTrialContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const selectedPlan = useMemo(
    () => normalizePlan(searchParams?.get("plan") ?? null),
    [searchParams],
  );

  const plan = planConfig[selectedPlan];

  const [clinicName, setClinicName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus("Preparing your free trial...");

    const intake = {
      clinicName: clinicName.trim(),
      contactName: contactName.trim(),
      email: email.trim(),
      website: website.trim(),
      phone: phone.trim(),
      plan: selectedPlan,
      createdAt: new Date().toISOString(),
    };

    try {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          "leadclaw_trial_intake",
          JSON.stringify(intake),
        );
      }
    } catch {
      // ignore storage issues
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const response = await fetch("/api/trial/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan: selectedPlan }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.ok) {
        setStatus(result?.error || "Unable to start trial right now.");
        setLoading(false);
        return;
      }

      router.push(
        `/portal?trial=started&setup=ready&plan=${encodeURIComponent(
          selectedPlan,
        )}`,
      );
      return;
    }

    if (!email.trim()) {
      setStatus("Please enter your work email to continue.");
      setLoading(false);
      return;
    }

    const next = `/portal?startTrial=1&trial=started&setup=ready&plan=${selectedPlan}`;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
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

    setStatus("Magic link sent. Check your email to activate your free trial.");
    setLoading(false);
  }

  return (
    <div className="space-y-0">
      <section className="page-hero section-shell">
        <div className="container-shell">
          <div className="mx-auto max-w-5xl">
            <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
              <div>
                <div className="badge-soft mb-5">
                  <span className="h-2 w-2 rounded-full bg-brand" />
                  Start your 7-day free trial
                </div>

                <h1 className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                  Try LeadClaw free and start capturing more clinic enquiries.
                </h1>

                <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
                  Your selected plan is{" "}
                  <strong className="text-foreground">{plan.name}</strong>. You
                  can change it below before starting your trial.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  {(["starter", "growth", "pro"] as PlanSlug[]).map((slug) => {
                    const item = planConfig[slug];
                    const active = slug === selectedPlan;

                    return (
                      <Link
                        key={slug}
                        href={`/free-trial?plan=${slug}`}
                        className={[
                          "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
                          active
                            ? item.badgeClass
                            : "border-border bg-white text-foreground hover:border-border-strong",
                        ].join(" ")}
                      >
                        <span>{item.name}</span>
                        <span className="text-xs opacity-80">
                          {item.mascot}
                        </span>
                      </Link>
                    );
                  })}
                </div>

                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  <div className="card-premium p-4">
                    <p className="text-sm font-semibold text-foreground">
                      No credit card required
                    </p>
                    <p className="mt-2 text-sm text-muted">
                      Start your trial first and decide after you’ve seen the
                      workflow in action.
                    </p>
                  </div>

                  <div className="card-premium p-4">
                    <p className="text-sm font-semibold text-foreground">
                      Setup designed to be lightweight
                    </p>
                    <p className="mt-2 text-sm text-muted">
                      We’ll guide you through the core details needed to prepare
                      your widget and portal access.
                    </p>
                  </div>
                </div>
              </div>

              <div
                className={[
                  "relative rounded-[28px] border p-6 shadow-[var(--shadow-card)] md:p-8",
                  plan.cardClass,
                ].join(" ")}
              >
                <div className="flex justify-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white bg-white shadow-lg">
                    <Image
                      src={plan.mascotSrc}
                      alt={`${plan.name} mascot`}
                      width={56}
                      height={56}
                      className="h-auto w-auto object-contain"
                    />
                  </div>
                </div>

                <div className="mt-6 text-center">
                  <div
                    className={[
                      "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
                      plan.badgeClass,
                    ].join(" ")}
                  >
                    {plan.name} • {plan.mascot}
                  </div>

                  <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
                    {plan.name} free trial
                  </h2>

                  <p className="mt-3 text-sm leading-7 text-muted">
                    {plan.description}
                  </p>

                  <p className="mt-5 text-sm font-medium text-foreground">
                    {plan.priceLabel}
                  </p>
                </div>

                <div className="mt-6 space-y-3">
                  {plan.included.map((item) => (
                    <div key={item} className="flex items-start gap-3">
                      <span className="mt-1 h-2 w-2 rounded-full bg-brand" />
                      <span className="text-sm leading-7 text-muted">
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-10 card-premium p-6 md:p-8">
              <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-strong">
                    Your details
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                    Start your 7-day free trial in under 2 minutes
                  </h2>
                  <p className="mt-4 text-base leading-7 text-muted">
                    Enter your clinic details and we’ll use your selected plan
                    to begin preparing your LeadClaw setup.
                  </p>

                  <div className="mt-6 rounded-[24px] border border-border bg-white p-5">
                    <p className="text-sm font-semibold text-foreground">
                      What happens next
                    </p>
                    <ol className="mt-3 space-y-2 text-sm leading-7 text-muted">
                      <li>1. You choose or confirm your plan.</li>
                      <li>2. You enter your clinic and contact details.</li>
                      <li>3. We prepare your login or start your trial.</li>
                      <li>
                        4. You move into widget install and portal access.
                      </li>
                    </ol>
                  </div>
                </div>

                <form onSubmit={onSubmit} className="space-y-4">
                  <div>
                    <label
                      htmlFor="clinicName"
                      className="mb-2 block text-sm font-medium text-foreground"
                    >
                      Clinic name
                    </label>
                    <input
                      id="clinicName"
                      name="clinicName"
                      type="text"
                      value={clinicName}
                      onChange={(e) => setClinicName(e.target.value)}
                      className="input-premium rounded-2xl"
                      placeholder="Your clinic name"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="contactName"
                      className="mb-2 block text-sm font-medium text-foreground"
                    >
                      Contact name
                    </label>
                    <input
                      id="contactName"
                      name="contactName"
                      type="text"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      className="input-premium rounded-2xl"
                      placeholder="Your name"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="email"
                      className="mb-2 block text-sm font-medium text-foreground"
                    >
                      Work email
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input-premium rounded-2xl"
                      placeholder="you@clinic.co.uk"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="website"
                      className="mb-2 block text-sm font-medium text-foreground"
                    >
                      Clinic website
                    </label>
                    <input
                      id="website"
                      name="website"
                      type="url"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      className="input-premium rounded-2xl"
                      placeholder="https://yourclinic.co.uk"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="phone"
                      className="mb-2 block text-sm font-medium text-foreground"
                    >
                      Phone number
                    </label>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="input-premium rounded-2xl"
                      placeholder="Optional"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      className={plan.buttonClass}
                      disabled={loading}
                    >
                      {loading
                        ? "Preparing your trial..."
                        : "Start 7-day free trial"}
                    </button>
                    <p className="mt-3 text-xs text-muted-2">
                      No credit card required. You can review everything before
                      moving to a paid plan.
                    </p>
                  </div>

                  {status ? (
                    <div className="rounded-[20px] border border-border bg-surface-2 p-4 text-sm text-muted">
                      {status}
                    </div>
                  ) : null}
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function FreeTrialLoading() {
  return (
    <div className="space-y-0">
      <section className="page-hero section-shell">
        <div className="container-shell">
          <div className="mx-auto max-w-3xl">
            <div className="card-premium p-8 text-center">
              <p className="text-sm font-semibold text-foreground">
                Loading your trial options...
              </p>
              <p className="mt-2 text-sm text-muted">
                Preparing the right LeadClaw plan for your clinic.
              </p>
            </div>
          </div>
        </div>
      </section>
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
