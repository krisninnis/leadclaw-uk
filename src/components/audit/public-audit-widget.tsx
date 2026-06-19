"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Check, LockKeyhole, MinusCircle, X } from "lucide-react";
import type { PublicAuditReport } from "@/lib/audit/public-report";
import AuditScoreRing from "./audit-score-ring";
import CategoryScoreCard from "./category-score-card";
import RecommendationsList from "./recommendations-list";
import AuditEvidence from "./audit-evidence";

type FormState = {
  websiteUrl: string;
  name: string;
  email: string;
};

type ApiResponse =
  | { ok: true; report: PublicAuditReport }
  | { ok: false; error: string; message?: string };

const EMPTY_FORM: FormState = { websiteUrl: "", name: "", email: "" };

function FullCategoryBreakdown({ report }: { report: PublicAuditReport }) {
  return (
    <div className="space-y-5">
      {report.fullReport.categories.map((category) => {
        const passed = category.checks.filter((check) => check.passed).length;
        return (
          <section
            key={category.category}
            className="rounded-[24px] border border-border bg-white p-5 md:p-6"
          >
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-2">
                  {passed}/{category.checks.length} checks passed
                </p>
                <h3 className="mt-1 text-xl font-semibold text-foreground">
                  {category.label}
                </h3>
              </div>
              <p className="text-3xl font-semibold text-foreground">
                {category.score}
              </p>
            </div>

            <div className="mt-5 space-y-3">
              {category.checks.map((check) => {
                const Icon = check.passed
                  ? Check
                  : check.score > 0
                    ? MinusCircle
                    : X;
                const color = check.passed
                  ? "text-emerald-600"
                  : check.score > 0
                    ? "text-amber-600"
                    : "text-rose-600";

                return (
                  <div
                    key={check.id}
                    className="flex items-start gap-3 rounded-[18px] border border-border bg-surface-2 p-4"
                  >
                    <Icon
                      size={18}
                      aria-hidden="true"
                      className={`mt-0.5 shrink-0 ${color}`}
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{check.label}</p>
                      <p className="mt-1 text-sm leading-6 text-muted">
                        {check.detail}
                      </p>
                      <AuditEvidence evidence={check.evidence} />
                      {check.recommendation ? (
                        <p className="mt-2 text-sm leading-6 text-brand-strong">
                          {check.recommendation}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function shouldShowBookDemo(score: number) {
  return score < 80;
}

function ReportCta({ score }: { score: number }) {
  const showBookDemo = shouldShowBookDemo(score);
  return (
    <section className="rounded-[28px] bg-slate-950 p-6 text-white shadow-xl md:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">
        Turn the findings into growth
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight">
        {score < 80
          ? "Your website has clear opportunities to capture more enquiries."
          : "Your website is healthy. Keep improving and track what changes."}
      </h2>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        {showBookDemo ? (
          <Link href="/demo" className="button-primary text-center">
            Book Demo
          </Link>
        ) : null}
        <Link
          href="/free-trial"
          className={showBookDemo ? "button-secondary text-center" : "button-primary text-center"}
        >
          Start Free Trial
        </Link>
      </div>
    </section>
  );
}

export default function PublicAuditWidget() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [report, setReport] = useState<PublicAuditReport | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function update(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setReport(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/audit/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await response.json().catch(() => null)) as ApiResponse | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(
          payload && !payload.ok && payload.message
            ? payload.message
            : "The audit could not be completed. Please try again.",
        );
      }

      setReport(payload.report);
      window.setTimeout(() => {
        document.getElementById("free-audit-report")?.scrollIntoView?.({
          behavior: "smooth",
          block: "start",
        });
      }, 0);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The audit could not be completed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="card-premium p-6 md:p-8">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-strong">
              <LockKeyhole size={22} aria-hidden="true" />
            </div>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-brand-strong">
              Free website audit
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
              Unlock the full report
            </h2>
            <p className="mt-3 text-sm leading-7 text-muted">
              Enter your details to run the audit. Your score, top five actions,
              evidence, and complete category breakdown appear here as soon as
              the analysis finishes.
            </p>
            <p className="mt-3 text-xs leading-6 text-muted-2">
              This captures an audit lead only. It does not add you to an
              outreach sequence. See our{" "}
              <Link href="/legal/privacy" className="underline hover:text-foreground">
                privacy policy
              </Link>
              .
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-foreground">
                Website URL
              </span>
              <input
                className="input-premium"
                type="text"
                inputMode="url"
                autoComplete="url"
                placeholder="https://yourbusiness.co.uk"
                value={form.websiteUrl}
                onChange={(event) => update("websiteUrl", event.target.value)}
                required
                maxLength={2048}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-foreground">
                  Name
                </span>
                <input
                  className="input-premium"
                  type="text"
                  autoComplete="name"
                  placeholder="Alex Smith"
                  value={form.name}
                  onChange={(event) => update("name", event.target.value)}
                  required
                  maxLength={120}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-foreground">
                  Email
                </span>
                <input
                  className="input-premium"
                  type="email"
                  autoComplete="email"
                  placeholder="alex@yourbusiness.co.uk"
                  value={form.email}
                  onChange={(event) => update("email", event.target.value)}
                  required
                  maxLength={320}
                />
              </label>
            </div>

            {error ? (
              <div
                role="alert"
                className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
              >
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              className="button-primary w-full"
              disabled={submitting}
            >
              {submitting ? "Auditing your website…" : "Run my free audit"}
            </button>
          </form>
        </div>
      </section>

      {report ? (
        <div id="free-audit-report" className="scroll-mt-6 space-y-8" aria-live="polite">
          <section className="card-premium p-6 md:p-8">
            <div className="flex flex-col items-center gap-6 md:flex-row md:items-center">
              <AuditScoreRing score={report.overallScore} size={150} />
              <div className="text-center md:text-left">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-strong">
                  Audit complete
                </p>
                <h2 className="mt-2 break-all text-2xl font-semibold tracking-tight text-foreground">
                  {report.websiteUrl}
                </h2>
                <p className="mt-2 text-sm leading-7 text-muted">
                  Your full report is unlocked. Start with the highest-priority
                  recommendations below.
                </p>
              </div>
            </div>

            {report.status === "failed" ? (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                The site could not be fully fetched. The report shows the
                signals available from this run. {report.error}
              </div>
            ) : null}

            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {report.categoryScores.map((category) => (
                <CategoryScoreCard
                  key={category.category}
                  label={category.label}
                  score={category.score}
                />
              ))}
            </div>
          </section>

          <section className="card-premium p-6 md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-strong">
              Where to start
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              Top 5 recommendations
            </h2>
            <div className="mt-6">
              <RecommendationsList recommendations={report.topRecommendations} />
            </div>
          </section>

          <section className="card-premium p-6 md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-strong">
              Full report
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              Full recommendations
            </h2>
            <div className="mt-6">
              <RecommendationsList recommendations={report.fullReport.recommendations} />
            </div>
          </section>

          <section className="card-premium p-6 md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-strong">
              Evidence and checks
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              Full category breakdown
            </h2>
            <div className="mt-6">
              <FullCategoryBreakdown report={report} />
            </div>
          </section>

          <ReportCta score={report.overallScore} />
        </div>
      ) : (
        <section className="rounded-[24px] border border-dashed border-border-strong bg-white/70 p-8 text-center">
          <LockKeyhole className="mx-auto text-muted-2" size={28} aria-hidden="true" />
          <h2 className="mt-3 text-lg font-semibold text-foreground">
            Your report is locked
          </h2>
          <p className="mt-2 text-sm text-muted">
            Submit the form to see the score, recommendations, evidence, and
            full category breakdown.
          </p>
        </section>
      )}
    </div>
  );
}
