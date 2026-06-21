"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  INDUSTRY_OPTIONS,
  PLATFORM_OPTIONS,
  PLATFORM_INSTALL,
  industryLabel,
  type IndustryValue,
  type OnboardingConfig,
  type PlatformValue,
} from "@/lib/onboarding-wizard";
import LegalConsentCheckboxes from "@/components/auth/legal-consent-checkboxes";
import { track } from "@/lib/analytics";

type Props = {
  initialConfig: OnboardingConfig;
  initialSnippet: string;
  initialDetected: boolean;
  initialDomain: string | null;
  accountEmail: string;
};

const TOTAL_STEPS = 6;
const STEP_LABELS = [
  "Business",
  "Platform",
  "Receptionist",
  "Install",
  "Verify",
  "Test",
];

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="M5 10.5l3.2 3.2L15 7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function OnboardingWizard({
  initialConfig,
  initialSnippet,
  initialDetected,
  initialDomain,
  accountEmail,
}: Props) {
  const [step, setStep] = useState(1);

  // Analytics: onboarding funnel (started once + per-step views).
  const onboardingStartedRef = useRef(false);
  useEffect(() => {
    if (!onboardingStartedRef.current) {
      onboardingStartedRef.current = true;
      track("onboarding_started", { step });
    }
    track("onboarding_step_viewed", { step });
  }, [step]);

  // Form state
  const [businessName, setBusinessName] = useState(initialConfig.businessName || "");
  const [websiteUrl, setWebsiteUrl] = useState(initialConfig.websiteUrl || initialDomain || "");
  const [industry, setIndustry] = useState<IndustryValue | "">(initialConfig.industry || "");
  const [platform, setPlatform] = useState<PlatformValue | "">(initialConfig.platform || "");
  const [services, setServices] = useState<string[]>(initialConfig.services || []);
  const [serviceDraft, setServiceDraft] = useState("");
  const [openingHours, setOpeningHours] = useState(initialConfig.openingHours || "");
  const [enquiryPhone, setEnquiryPhone] = useState(initialConfig.enquiryPhone || "");
  const [enquiryEmail, setEnquiryEmail] = useState(initialConfig.enquiryEmail || accountEmail || "");

  // Async / status state
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeNote, setAnalyzeNote] = useState<string | null>(null);
  const [detectedFields, setDetectedFields] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snippet, setSnippet] = useState(initialSnippet);
  const [copied, setCopied] = useState(false);

  const [verifyState, setVerifyState] = useState<"waiting" | "checking" | "installed">(
    initialDetected ? "installed" : "waiting",
  );
  const [verifiedDomain, setVerifiedDomain] = useState<string | null>(null);

  const [testState, setTestState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [completed, setCompleted] = useState(initialConfig.completed === true);

  // Legal acceptance captured at onboarding completion (Part 1).
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const legalAccepted = termsAccepted && privacyAccepted;

  // ---- Persist helper ----
  const saveConfig = useCallback(
    async (patch: Partial<OnboardingConfig>): Promise<boolean> => {
      setSaving(true);
      setError(null);
      try {
        const res = await fetch("/api/onboarding/config", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error || `Save failed (${res.status})`);
        }
        if (typeof data.snippet === "string" && data.snippet) {
          setSnippet(data.snippet);
        }
        track("onboarding_config_saved", { fields: Object.keys(patch) });
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save your details.");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  // ---- Step 1: analyse website ----
  async function handleAnalyze() {
    const url = websiteUrl.trim();
    if (!url) return;
    setAnalyzing(true);
    setAnalyzeNote(null);
    try {
      const res = await fetch("/api/onboarding/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setAnalyzeNote("We couldn't read that site — just fill in the details below.");
        return;
      }
      if (!data.reachable) {
        setAnalyzeNote("We couldn't reach that site — just fill in the details below.");
        return;
      }
      const d = data.detected || {};
      const filled = new Set<string>();
      if (d.businessName && !businessName) {
        setBusinessName(d.businessName);
        filled.add("businessName");
      }
      if (d.industry && !industry) {
        setIndustry(d.industry);
        filled.add("industry");
      }
      if (d.platform && !platform) {
        setPlatform(d.platform);
        filled.add("platform");
      }
      if (Array.isArray(d.services) && d.services.length && services.length === 0) {
        setServices(d.services.slice(0, 8));
        filled.add("services");
      }
      if (d.phone && !enquiryPhone) {
        setEnquiryPhone(d.phone);
        filled.add("enquiryPhone");
      }
      if (d.email && (!enquiryEmail || enquiryEmail === accountEmail)) {
        setEnquiryEmail(d.email);
        filled.add("enquiryEmail");
      }
      setDetectedFields(filled);
      track("onboarding_website_analyzed", { detected_fields: filled.size });
      setAnalyzeNote(
        filled.size
          ? "We pre-filled what we found. Check it's right and continue."
          : "We read your site but couldn't detect much — fill in the details below.",
      );
    } catch {
      setAnalyzeNote("We couldn't read that site — just fill in the details below.");
    } finally {
      setAnalyzing(false);
    }
  }

  // ---- Step navigation with save ----
  async function next() {
    setError(null);

    if (step === 1) {
      if (!businessName.trim()) return setError("Please enter your business name.");
      if (!industry) return setError("Please choose your industry.");
      const ok = await saveConfig({
        businessName: businessName.trim(),
        websiteUrl: websiteUrl.trim() || undefined,
        industry,
      });
      if (!ok) return;
    }

    if (step === 2) {
      if (!platform) return setError("Please choose what powers your website.");
      const ok = await saveConfig({ platform });
      if (!ok) return;
    }

    if (step === 3) {
      if (!enquiryEmail.trim()) return setError("Please enter an email for enquiries.");
      const ok = await saveConfig({
        services,
        openingHours: openingHours.trim() || undefined,
        enquiryPhone: enquiryPhone.trim() || undefined,
        enquiryEmail: enquiryEmail.trim(),
      });
      if (!ok) return;
    }

    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  }

  function back() {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  function addService() {
    const v = serviceDraft.trim();
    if (!v) return;
    if (!services.some((s) => s.toLowerCase() === v.toLowerCase())) {
      setServices((prev) => [...prev, v].slice(0, 30));
    }
    setServiceDraft("");
  }

  function removeService(value: string) {
    setServices((prev) => prev.filter((s) => s !== value));
  }

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      track("widget_snippet_copied", { surface: "onboarding" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy automatically — select the code and copy it manually.");
    }
  }

  // ---- Step 5: poll for installation ----
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (step !== 5 || verifyState === "installed") return;

    let cancelled = false;
    async function check() {
      if (cancelled) return;
      setVerifyState((s) => (s === "installed" ? s : "checking"));
      try {
        const res = await fetch("/api/onboarding/widget-status", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled && data.ok && data.detected) {
          setVerifiedDomain(data.lastSeenDomain || null);
          setVerifyState("installed");
          track("widget_detected", { domain: data.lastSeenDomain || null });
          if (pollRef.current) clearInterval(pollRef.current);
        } else if (!cancelled) {
          setVerifyState("waiting");
        }
      } catch {
        if (!cancelled) setVerifyState("waiting");
      }
    }

    check();
    pollRef.current = setInterval(check, 4000);
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [step, verifyState]);

  // ---- Step 6: send test enquiry ----
  async function sendTest() {
    if (!legalAccepted) {
      setError(
        "Please agree to the Terms of Service and Privacy Policy to finish setup.",
      );
      return;
    }
    setTestState("sending");
    setError(null);
    try {
      // Record account-holder legal acceptance + marketing consent at
      // onboarding completion (best-effort; UI gating already enforces it).
      try {
        await fetch("/api/account/consent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            acceptTerms: true,
            acceptPrivacy: true,
            marketingConsent,
          }),
        });
      } catch {
        /* best-effort consent capture */
      }
      const res = await fetch("/api/portal/test-enquiry", { method: "POST" });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setTestState("sent");
      track("test_enquiry_sent", { surface: "onboarding" });
      await saveConfig({ completed: true });
      setCompleted(true);
      track("onboarding_completed", {});
    } catch (e) {
      setTestState("error");
      setError(e instanceof Error ? e.message : "Could not send the test enquiry.");
    }
  }

  // ===== Success screen =====
  if (completed && testState !== "idle" && step === 6) {
    return (
      <div className="mx-auto w-full max-w-xl">
        <div className="card-premium overflow-hidden p-7 text-center md:p-9">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckIcon className="h-8 w-8" />
          </div>
          <h1 className="mt-5 text-2xl font-semibold text-foreground md:text-3xl">
            Your AI Receptionist Is Live
          </h1>
          <p className="mt-2 text-sm text-muted">
            Setup complete — you&apos;re ready to capture enquiries.
          </p>

          <dl className="mt-7 space-y-3 text-left">
            <SummaryRow label="Website" value={websiteUrl || "—"} />
            <SummaryRow label="Industry" value={industryLabel(industry || null)} />
            <SummaryRow label="Notification email" value={enquiryEmail || accountEmail} />
          </dl>

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <a href="/portal/leads" className="button-primary w-full justify-center">
              View Leads
            </a>
            <a
              href="/portal"
              className="inline-flex w-full items-center justify-center rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-surface-2"
            >
              Open Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  const installInfo = PLATFORM_INSTALL[(platform || "custom") as PlatformValue];

  return (
    <div className="mx-auto w-full max-w-xl">
      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-2">
            Step {step} of {TOTAL_STEPS}
          </p>
          <p className="text-xs font-medium text-muted">{STEP_LABELS[step - 1]}</p>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-brand transition-all duration-500"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </div>

      <div className="card-premium p-6 md:p-8">
        {/* ===== Step 1: Business details ===== */}
        {step === 1 && (
          <div className="space-y-5">
            <header>
              <h1 className="text-xl font-semibold text-foreground md:text-2xl">
                Tell us about your business
              </h1>
              <p className="mt-1 text-sm text-muted">
                Enter your website and we&apos;ll set up as much as we can for you.
              </p>
            </header>

            <Field label="Website URL">
              <div className="flex gap-2">
                <input
                  type="url"
                  inputMode="url"
                  placeholder="yourbusiness.co.uk"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  className="rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-2 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 flex-1"
                />
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={analyzing || !websiteUrl.trim()}
                  className="shrink-0 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
                >
                  {analyzing ? "Reading…" : "Analyse"}
                </button>
              </div>
              {analyzeNote && (
                <p className="mt-2 text-xs text-muted">{analyzeNote}</p>
              )}
            </Field>

            <Field label="Business name" hint={detectedFields.has("businessName") ? "Detected from your website" : undefined}>
              <input
                type="text"
                placeholder="Acme Dental"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-2 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 w-full"
              />
            </Field>

            <Field label="Industry" hint={detectedFields.has("industry") ? "Detected from your website" : undefined}>
              <select
                value={industry}
                onChange={(e) => {
                  const value = e.target.value as IndustryValue;
                  setIndustry(value);
                  track("onboarding_industry_selected", { industry: value });
                }}
                className="rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-2 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 w-full"
              >
                <option value="">Select your industry…</option>
                {INDUSTRY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}

        {/* ===== Step 2: Platform ===== */}
        {step === 2 && (
          <div className="space-y-5">
            <header>
              <h1 className="text-xl font-semibold text-foreground md:text-2xl">
                What powers your website?
              </h1>
              <p className="mt-1 text-sm text-muted">
                We&apos;ll give you the exact install steps for your platform.
              </p>
            </header>

            <div className="grid grid-cols-2 gap-3">
              {PLATFORM_OPTIONS.map((o) => {
                const active = platform === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => {
                      setPlatform(o.value);
                      track("onboarding_platform_selected", { platform: o.value });
                    }}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3.5 text-left text-sm font-medium transition ${
                      active
                        ? "border-brand bg-brand/5 text-foreground ring-2 ring-brand/30"
                        : "border-border bg-white text-foreground hover:bg-surface-2"
                    }`}
                  >
                    <span>{o.label}</span>
                    {active && <CheckIcon className="h-4 w-4 text-brand" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ===== Step 3: AI receptionist config ===== */}
        {step === 3 && (
          <div className="space-y-5">
            <header>
              <h1 className="text-xl font-semibold text-foreground md:text-2xl">
                Set up your receptionist
              </h1>
              <p className="mt-1 text-sm text-muted">
                This is how enquiries reach you and what your assistant talks about.
              </p>
            </header>

            <Field label="Services you offer" hint={detectedFields.has("services") ? "Detected from your website" : undefined}>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Teeth whitening"
                  value={serviceDraft}
                  onChange={(e) => setServiceDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addService();
                    }
                  }}
                  className="rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-2 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 flex-1"
                />
                <button
                  type="button"
                  onClick={addService}
                  className="shrink-0 rounded-lg border border-border bg-white px-4 text-sm font-medium text-foreground transition hover:bg-surface-2"
                >
                  Add
                </button>
              </div>
              {services.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {services.map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-sm text-foreground"
                    >
                      {s}
                      <button
                        type="button"
                        onClick={() => removeService(s)}
                        className="text-muted hover:text-foreground"
                        aria-label={`Remove ${s}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </Field>

            <Field label="Opening hours">
              <input
                type="text"
                placeholder="Mon–Fri 9am–5pm"
                value={openingHours}
                onChange={(e) => setOpeningHours(e.target.value)}
                className="rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-2 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 w-full"
              />
            </Field>

            <Field label="Phone for enquiries" hint={detectedFields.has("enquiryPhone") ? "Detected from your website" : undefined}>
              <input
                type="tel"
                inputMode="tel"
                placeholder="020 1234 5678"
                value={enquiryPhone}
                onChange={(e) => setEnquiryPhone(e.target.value)}
                className="rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-2 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 w-full"
              />
            </Field>

            <Field label="Email for enquiries" hint={detectedFields.has("enquiryEmail") ? "Detected from your website" : undefined}>
              <input
                type="email"
                inputMode="email"
                placeholder="hello@yourbusiness.co.uk"
                value={enquiryEmail}
                onChange={(e) => setEnquiryEmail(e.target.value)}
                className="rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-2 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 w-full"
              />
            </Field>
          </div>
        )}

        {/* ===== Step 4: Install ===== */}
        {step === 4 && (
          <div className="space-y-5">
            <header>
              <h1 className="text-xl font-semibold text-foreground md:text-2xl">
                {installInfo.heading}
              </h1>
              <p className="mt-1 text-sm text-muted">{installInfo.intro}</p>
            </header>

            <ol className="space-y-2.5">
              {installInfo.steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm leading-6 text-foreground">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-muted">
                    {i + 1}
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>

            <div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Your install code</p>
                <button
                  type="button"
                  onClick={copySnippet}
                  disabled={!snippet}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-60"
                >
                  {copied ? "Copied ✓" : "Copy code"}
                </button>
              </div>
              <pre className="mt-2 overflow-x-auto rounded-xl border border-border bg-slate-950 p-4 text-xs leading-5 text-slate-100">
                <code>{snippet || "Preparing your snippet…"}</code>
              </pre>
            </div>
          </div>
        )}

        {/* ===== Step 5: Verify ===== */}
        {step === 5 && (
          <div className="space-y-5">
            <header>
              <h1 className="text-xl font-semibold text-foreground md:text-2xl">
                Checking your installation
              </h1>
              <p className="mt-1 text-sm text-muted">
                Publish your site and open it once. We&apos;ll detect the widget
                automatically — no need to refresh.
              </p>
            </header>

            <div
              className={`rounded-2xl border p-5 ${
                verifyState === "installed"
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-border bg-surface-2"
              }`}
            >
              <div className="flex items-center gap-3">
                {verifyState === "installed" ? (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white">
                    <CheckIcon className="h-5 w-5" />
                  </span>
                ) : (
                  <span className="h-9 w-9 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
                )}
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {verifyState === "waiting" && "Waiting for your widget…"}
                    {verifyState === "checking" && "Checking…"}
                    {verifyState === "installed" && "Installed ✓"}
                  </p>
                  <p className="text-xs text-muted">
                    {verifyState === "installed"
                      ? verifiedDomain
                        ? `Detected on ${verifiedDomain}`
                        : "Your widget is live."
                      : "This usually takes a few seconds after you publish."}
                  </p>
                </div>
              </div>
            </div>

            {verifyState !== "installed" && (
              <p className="text-xs text-muted">
                Haven&apos;t installed it yet? Go back a step to copy your code again.
              </p>
            )}
          </div>
        )}

        {/* ===== Step 6: Test lead ===== */}
        {step === 6 && (
          <div className="space-y-5">
            <header>
              <h1 className="text-xl font-semibold text-foreground md:text-2xl">
                Send a test enquiry
              </h1>
              <p className="mt-1 text-sm text-muted">
                Prove the whole loop works — we&apos;ll create a test lead in your inbox.
              </p>
            </header>

            <div className="space-y-2.5">
              <ChecklistRow done label="Widget Installed" />
              <ChecklistRow done={testState === "sent"} label="Lead Received" />
              <ChecklistRow done={testState === "sent"} label="Setup Complete" />
            </div>

            {testState !== "sent" && (
              <div className="rounded-2xl border border-border bg-surface-2 p-4">
                <p className="mb-3 text-sm font-medium text-foreground">
                  Before you finish, please confirm:
                </p>
                <LegalConsentCheckboxes
                  termsAccepted={termsAccepted}
                  privacyAccepted={privacyAccepted}
                  marketingConsent={marketingConsent}
                  onTermsChange={setTermsAccepted}
                  onPrivacyChange={setPrivacyAccepted}
                  onMarketingChange={setMarketingConsent}
                  disabled={testState === "sending"}
                  showDpaReference
                />
              </div>
            )}

            {testState !== "sent" && (
              <button
                type="button"
                onClick={sendTest}
                disabled={testState === "sending" || !legalAccepted}
                className="button-primary w-full justify-center"
              >
                {testState === "sending" ? "Sending…" : "Send Test Enquiry"}
              </button>
            )}

            {testState === "sent" && (
              <p className="text-center text-sm text-emerald-700">
                Test lead received. Finishing up…
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            {error}
          </div>
        )}

        {/* Footer nav (hidden on success-driven step 6 after send) */}
        {!(step === 6 && testState === "sent") && (
          <div className="mt-7 flex items-center justify-between gap-3">
            {step > 1 ? (
              <button
                type="button"
                onClick={back}
                className="rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-surface-2"
              >
                Back
              </button>
            ) : (
              <span />
            )}

            {step < 6 && (
              <button
                type="button"
                onClick={next}
                disabled={saving || (step === 5 && verifyState !== "installed")}
                className="button-primary justify-center disabled:opacity-60"
              >
                {saving ? "Saving…" : "Continue"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">{label}</label>
        {hint && (
          <span className="text-[11px] font-medium text-emerald-700">{hint}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-surface-2 px-4 py-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="ml-3 truncate text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

function ChecklistRow({ done, label }: { done?: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-white px-4 py-3">
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full ${
          done ? "bg-emerald-600 text-white" : "bg-surface-2 text-transparent"
        }`}
      >
        <CheckIcon className="h-3.5 w-3.5" />
      </span>
      <span className={`text-sm font-medium ${done ? "text-foreground" : "text-muted"}`}>
        {label} {done ? "✓" : ""}
      </span>
    </div>
  );
}
