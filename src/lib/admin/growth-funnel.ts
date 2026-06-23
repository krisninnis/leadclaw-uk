// Growth Funnel + At Risk Trials — Sprint 1.
//
// Pure, side-effect-free logic for the Founder Funnel Dashboard that sits at the
// top of the Command Centre. All functions take already-assembled ClinicRecord
// rows (no I/O) so they are unit-testable. This module is purely ADDITIVE: it
// reuses the existing ClinicRecord signals produced by assembleClinics() and
// does not change billing, outreach, onboarding, widget, or any other
// behaviour. Nothing here writes, deletes, or mutates data.

import { isPaidPlan, normalizePlan } from "@/lib/plans";
import type { ClinicRecord } from "@/lib/admin/command-centre";

const DAY_MS = 24 * 60 * 60 * 1000;
const TRIAL_RISK_AGE_DAYS = 7;

function lower(value: string | null | undefined): string {
  return String(value || "").trim().toLowerCase();
}

// Widget installed = verified ping (last_seen_at) OR an active token. Mirrors the
// exact derivation used by classifyHealth/onboardingProgress in command-centre.ts
// so the funnel and health views never disagree.
export function isWidgetInstalled(c: ClinicRecord): boolean {
  return Boolean(c.widgetLastSeenAt) || c.widgetTokenActive;
}

// Activated = widget installed AND at least one captured lead (test OR real).
// Any received enquiry proves the capture loop works, so we no longer require
// the canonical "LeadClaw Test Enquiry" marker specifically.
export function isActivated(c: ClinicRecord): boolean {
  return isWidgetInstalled(c) && c.totalEnquiries > 0;
}

// Paid customer = active subscription on a paid plan. Matches the activePaid
// definition in computeFounderMetrics so the funnel tail equals the dashboard.
export function isPaidCustomer(c: ClinicRecord): boolean {
  return (
    lower(c.subscriptionStatus) === "active" &&
    isPaidPlan(normalizePlan(c.subscriptionPlan))
  );
}

// ---- Growth Funnel ---------------------------------------------------------

export type FunnelStage = {
  key: "visitors" | "trials" | "installed" | "activated" | "paid";
  label: string;
  // null = stage value not yet available (e.g. Visitors before PostHog server
  // integration). UI renders this as a placeholder.
  count: number | null;
  // Conversion from the previous stage, as a whole percentage. null when it
  // cannot be computed (first stage, or a missing/zero previous stage).
  conversionFromPrevPct: number | null;
  note?: string;
};

export type GrowthFunnel = {
  stages: FunnelStage[];
  visitorsAvailable: boolean;
};

function conversion(curr: number | null, prev: number | null): number | null {
  if (curr === null || prev === null || prev <= 0) return null;
  return Math.round((curr / prev) * 100);
}

// Build the 5-stage acquisition funnel from assembled clinics.
//
// `visitors` is sourced from PostHog. There is currently no server-side PostHog
// query wired up (PostHog events are captured client-side — see
// src/lib/analytics.ts / src/components/posthog-provider.tsx), so the API route
// passes `null` and the UI shows a placeholder. INTEGRATION POINT: when a
// server-side PostHog read is added (PostHog Query API with the project's
// personal API key, counting `page_view`/`social_page_view` events over the
// chosen window), pass that number in here as `visitors` and the funnel + the
// Visitors→Trials conversion light up automatically with no other change.
export function computeGrowthFunnel(
  clinics: ClinicRecord[],
  visitors: number | null,
): GrowthFunnel {
  // Funnel reflects production reality: exclude demo/test clinics, consistent
  // with computeActionRequired which also skips demo clinics.
  const real = clinics.filter((c) => !c.isDemo);

  const trialsStarted = real.length; // each onboarding client is a trial account
  const widgetInstalled = real.filter(isWidgetInstalled).length;
  const activatedTrials = real.filter(isActivated).length;
  const paidCustomers = real.filter(isPaidCustomer).length;

  const stages: FunnelStage[] = [
    {
      key: "visitors",
      label: "Visitors",
      count: visitors,
      conversionFromPrevPct: null,
      note:
        visitors === null
          ? "Awaiting PostHog server integration (placeholder)"
          : "From PostHog",
    },
    {
      key: "trials",
      label: "Trials Started",
      count: trialsStarted,
      conversionFromPrevPct: conversion(trialsStarted, visitors),
      note: "Trial accounts created",
    },
    {
      key: "installed",
      label: "Widget Installed",
      count: widgetInstalled,
      conversionFromPrevPct: conversion(widgetInstalled, trialsStarted),
      note: "Widget verified / last seen",
    },
    {
      key: "activated",
      label: "Activated Trials",
      count: activatedTrials,
      conversionFromPrevPct: conversion(activatedTrials, widgetInstalled),
      note: "Widget installed + lead captured",
    },
    {
      key: "paid",
      label: "Paid Customers",
      count: paidCustomers,
      conversionFromPrevPct: conversion(paidCustomers, activatedTrials),
      note: "Active subscription",
    },
  ];

  return { stages, visitorsAvailable: visitors !== null };
}

// ---- At Risk Trials --------------------------------------------------------

export type RiskLevel = "critical" | "warning" | "attention";

export type AtRiskTrial = {
  id: string;
  name: string;
  trialAgeDays: number;
  status: RiskLevel;
  action: string;
};

export type AtRiskTrials = {
  critical: AtRiskTrial[];
  warning: AtRiskTrial[];
  attention: AtRiskTrial[];
  all: AtRiskTrial[];
};

const RISK_ACTIONS: Record<RiskLevel, string> = {
  critical:
    "Trial >7 days with widget not installed — reach out and help them install the snippet.",
  warning:
    "Widget installed but unverified — ask them to send a test enquiry to confirm capture.",
  attention:
    "Activated but no real enquiries yet — review widget placement and site traffic.",
};

function trialAgeDays(c: ClinicRecord, now: number): number {
  const created = new Date(c.createdAt).getTime();
  if (!Number.isFinite(created)) return 0;
  return Math.max(0, Math.floor((now - created) / DAY_MS));
}

// Classify trials that need attention. Excludes demo clinics and paid customers
// (a paid account with problems is a "broken account", surfaced separately in
// Action Required). Each clinic falls into at most one bucket; the conditions
// are mutually exclusive by construction:
//   CRITICAL   — trial older than 7 days AND widget not installed
//   WARNING    — widget installed AND no captured leads at all
//   ATTENTION  — widget installed + a lead captured AND no real enquiries received
export function computeAtRiskTrials(
  clinics: ClinicRecord[],
  now: number,
): AtRiskTrials {
  const out: AtRiskTrials = { critical: [], warning: [], attention: [], all: [] };

  for (const c of clinics) {
    if (c.isDemo) continue;
    if (isPaidCustomer(c)) continue;

    const installed = isWidgetInstalled(c);
    const ageDays = trialAgeDays(c, now);

    let status: RiskLevel | null = null;
    if (!installed && ageDays > TRIAL_RISK_AGE_DAYS) {
      status = "critical";
    } else if (installed && c.totalEnquiries === 0) {
      status = "warning";
    } else if (installed && c.totalEnquiries > 0 && c.realEnquiries === 0) {
      status = "attention";
    }

    if (!status) continue;

    const item: AtRiskTrial = {
      id: c.id,
      name: c.name,
      trialAgeDays: ageDays,
      status,
      action: RISK_ACTIONS[status],
    };
    out[status].push(item);
    out.all.push(item);
  }

  // Surface the most urgent first within the combined list.
  const order: Record<RiskLevel, number> = { critical: 0, warning: 1, attention: 2 };
  out.all.sort(
    (a, b) => order[a.status] - order[b.status] || b.trialAgeDays - a.trialAgeDays,
  );

  return out;
}

// ---- Revenue Pipeline (Phase 2) -------------------------------------------
// Focused trial -> activated -> paid view for the founder dashboard. Reuses the
// same predicates as the Growth Funnel (isActivated / isPaidCustomer) so the
// numbers are guaranteed consistent — no duplicate aggregation logic.

export type RevenuePipeline = {
  trialsStarted: number;
  activatedTrials: number;
  payingCustomers: number;
  trialToActivatedPct: number | null;
  activatedToPaidPct: number | null;
};

export function computeRevenuePipeline(clinics: ClinicRecord[]): RevenuePipeline {
  const real = clinics.filter((c) => !c.isDemo);
  const trialsStarted = real.length;
  const activatedTrials = real.filter(isActivated).length;
  const payingCustomers = real.filter(isPaidCustomer).length;

  return {
    trialsStarted,
    activatedTrials,
    payingCustomers,
    trialToActivatedPct: conversion(activatedTrials, trialsStarted),
    activatedToPaidPct: conversion(payingCustomers, activatedTrials),
  };
}
