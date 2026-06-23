// Command Centre v2 — Founder Operating System.
//
// Pure, side-effect-free logic for the admin operational dashboard. All
// functions take already-loaded rows (no I/O) so they are unit-testable. The
// API route (src/app/api/admin/command-centre/route.ts) loads data read-only
// and feeds it here. Nothing in this module writes, deletes, or mutates data —
// it only classifies and aggregates existing records.

import { PLAN_MONTHLY_PRICES, normalizePlan, isPaidPlan } from "@/lib/plans";

// Markers mirror src/app/api/portal/test-enquiry/route.ts so we can recognise
// the founder's own test enquiries without importing the server route.
export const TEST_ENQUIRY_NAME = "LeadClaw Test Enquiry";
export const TEST_ENQUIRY_SERVICE_PREFIX = "[TEST]";

const DAY_MS = 24 * 60 * 60 * 1000;
const WIDGET_LIVE_WINDOW_MS = 15 * 60 * 1000; // matches /portal/install "recently"
const TRIAL_EXPIRY_WINDOW_DAYS = 7;

// ---- Raw input shapes (subset of columns we read) -------------------------

export type RawClient = {
  id: string;
  client_name: string;
  business_name: string | null;
  contact_email: string | null;
  status: string | null;
  created_at: string;
  notify_sms?: string | null;
  notify_whatsapp?: string | null;
  notify_channels?: string[] | null;
};

export type RawSite = {
  id: string;
  onboarding_client_id: string;
  domain: string | null;
  platform: string | null;
  settings: Record<string, unknown> | null;
  status: string | null;
  clinic_id: string | null;
  created_at: string;
};

export type RawToken = {
  id: string;
  onboarding_site_id: string;
  token: string | null;
  status: string | null;
  last_seen_at: string | null;
  last_seen_domain: string | null;
  created_at: string;
};

export type RawSubscription = {
  id: string;
  email: string | null;
  plan: string | null;
  status: string | null;
  trial_end: string | null;
  current_period_end: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type RawEnquiry = {
  id: string;
  clinic_id: string | null;
  name: string | null;
  service: string | null;
  status: string | null;
  created_at: string;
};

export type RawLead = {
  id: string;
  status: string | null;
  source: string | null;
  created_at: string | null;
};

// ---- Assembled per-clinic record ------------------------------------------

export type HealthStatus = "healthy" | "attention" | "critical";

export type TimelineEvent = { label: string; at: string };

export type ClinicRecord = {
  id: string;
  name: string;
  email: string | null;
  domain: string | null;
  platform: string | null;
  onboardingStatus: string | null;
  settingsCompleted: boolean;
  clinicId: string | null;
  hasSite: boolean;
  widgetTokenActive: boolean;
  widgetLastSeenAt: string | null;
  widgetLastSeenDomain: string | null;
  subscriptionStatus: string | null;
  subscriptionPlan: string | null;
  trialEnd: string | null;
  subscriptionUpdatedAt: string | null;
  totalEnquiries: number;
  realEnquiries: number;
  testEnquiries: number;
  lastRealEnquiryAt: string | null;
  notificationsConfigured: boolean;
  isDemo: boolean;
  createdAt: string;
};

const BROKEN_SUB_STATUSES = new Set([
  "past_due",
  "canceled",
  "cancelled",
  "unpaid",
  "incomplete_expired",
]);
const ACTIVE_SUB_STATUSES = new Set(["active", "trialing"]);
const RECENT_ENQUIRY_WINDOW_MS = 30 * DAY_MS;

function lower(value: string | null | undefined): string {
  return String(value || "").trim().toLowerCase();
}

export function isTestEnquiry(name: string | null, service: string | null): boolean {
  if ((name || "").trim() === TEST_ENQUIRY_NAME) return true;
  return (service || "").trim().startsWith(TEST_ENQUIRY_SERVICE_PREFIX);
}

// Demo/test detection from the strongest available signals (no is_demo column
// exists). Conservative: matches the known "LeadClaw Demo" record and obvious
// demo/test markers in the name, email, or domain.
export function isDemoClinic(input: {
  name?: string | null;
  email?: string | null;
  domain?: string | null;
}): boolean {
  const haystacks = [input.name, input.email, input.domain].map(lower);
  for (const h of haystacks) {
    if (!h) continue;
    if (h.includes("leadclaw demo")) return true;
    if (/\b(demo|test|sample|example|dummy)\b/.test(h)) return true;
    if (h.endsWith("@example.com") || h.includes("example.com")) return true;
  }
  return false;
}

export function widgetIsLive(lastSeenAt: string | null, now: number): boolean {
  if (!lastSeenAt) return false;
  const t = new Date(lastSeenAt).getTime();
  if (!Number.isFinite(t)) return false;
  return now - t <= WIDGET_LIVE_WINDOW_MS;
}

// ---- Assembly --------------------------------------------------------------

export function assembleClinics(input: {
  clients: RawClient[];
  sites: RawSite[];
  tokens: RawToken[];
  subscriptions: RawSubscription[];
  enquiries: RawEnquiry[];
}): ClinicRecord[] {
  const { clients, sites, tokens, subscriptions, enquiries } = input;

  const sitesByClient = new Map<string, RawSite[]>();
  for (const s of sites) {
    const arr = sitesByClient.get(s.onboarding_client_id) || [];
    arr.push(s);
    sitesByClient.set(s.onboarding_client_id, arr);
  }

  const tokensBySite = new Map<string, RawToken[]>();
  for (const t of tokens) {
    const arr = tokensBySite.get(t.onboarding_site_id) || [];
    arr.push(t);
    tokensBySite.set(t.onboarding_site_id, arr);
  }

  const latestSubByEmail = new Map<string, RawSubscription>();
  for (const sub of subscriptions) {
    const email = lower(sub.email);
    if (!email) continue;
    // subscriptions arrive newest-first; keep the first seen per email.
    if (!latestSubByEmail.has(email)) latestSubByEmail.set(email, sub);
  }

  // Enquiry aggregates per clinic_id.
  type EnqAgg = { total: number; real: number; test: number; lastRealAt: string | null };
  const enqByClinic = new Map<string, EnqAgg>();
  for (const e of enquiries) {
    if (!e.clinic_id) continue;
    const agg =
      enqByClinic.get(e.clinic_id) || { total: 0, real: 0, test: 0, lastRealAt: null };
    agg.total += 1;
    if (isTestEnquiry(e.name, e.service)) {
      agg.test += 1;
    } else {
      agg.real += 1;
      if (!agg.lastRealAt || new Date(e.created_at) > new Date(agg.lastRealAt)) {
        agg.lastRealAt = e.created_at;
      }
    }
    enqByClinic.set(e.clinic_id, agg);
  }

  return clients.map((client) => {
    const clientSites = (sitesByClient.get(client.id) || []).slice();
    clientSites.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    const site = clientSites[0] || null; // newest — used for display fields

    // A client can own MORE THAN ONE onboarding_site (e.g. an initial
    // `test.leadclaw.uk` fallback site from provisioning plus the real-domain
    // site). The widget token, its last_seen_at, the clinic_id, and captured
    // enquiries can live on ANY of those sibling sites — not just the newest.
    // Deriving widget/enquiry status from only the newest site produced false
    // "widget not installed" / "test lead not completed" / "broken account"
    // warnings. Aggregate across ALL of the client's sites instead.
    const siteTokens = clientSites.flatMap((s) => tokensBySite.get(s.id) || []);
    const activeToken = siteTokens.find((t) => t.status === "active") || null;
    const seenToken =
      siteTokens
        .filter((t) => t.last_seen_at)
        .sort(
          (a, b) =>
            new Date(b.last_seen_at as string).getTime() -
            new Date(a.last_seen_at as string).getTime(),
        )[0] || activeToken;

    // Primary clinic_id: prefer the newest site that has one, else any sibling
    // site that carries the clinic linkage.
    const clinicId =
      site?.clinic_id || clientSites.find((s) => s.clinic_id)?.clinic_id || null;

    // Merge enquiry aggregates across every clinic_id linked to this client's
    // sites, so leads captured against a sibling site are counted.
    const clinicIds = Array.from(
      new Set(
        clientSites
          .map((s) => s.clinic_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    let totalEnquiries = 0;
    let realEnquiries = 0;
    let testEnquiries = 0;
    let lastRealEnquiryAt: string | null = null;
    for (const cid of clinicIds) {
      const agg = enqByClinic.get(cid);
      if (!agg) continue;
      totalEnquiries += agg.total;
      realEnquiries += agg.real;
      testEnquiries += agg.test;
      if (
        agg.lastRealAt &&
        (!lastRealEnquiryAt ||
          new Date(agg.lastRealAt) > new Date(lastRealEnquiryAt))
      ) {
        lastRealEnquiryAt = agg.lastRealAt;
      }
    }

    const email = client.contact_email;
    const sub = email ? latestSubByEmail.get(lower(email)) || null : null;

    const settings = (site?.settings || {}) as Record<string, unknown>;
    const settingsCompleted = settings.completed === true;
    const notificationsConfigured =
      Boolean(client.notify_sms) ||
      Boolean(client.notify_whatsapp) ||
      (Array.isArray(client.notify_channels) && client.notify_channels.length > 0) ||
      Boolean(settings.enquiryEmail) ||
      Boolean(settings.notifications);

    const name = client.business_name || client.client_name;

    return {
      id: client.id,
      name,
      email,
      domain: site?.domain || null,
      platform: site?.platform || null,
      onboardingStatus: client.status,
      settingsCompleted,
      clinicId,
      hasSite: Boolean(site),
      widgetTokenActive: Boolean(activeToken),
      widgetLastSeenAt: seenToken?.last_seen_at || null,
      widgetLastSeenDomain: seenToken?.last_seen_domain || null,
      subscriptionStatus: sub?.status || null,
      subscriptionPlan: sub?.plan || null,
      trialEnd: sub?.trial_end || null,
      subscriptionUpdatedAt: sub?.updated_at || null,
      totalEnquiries,
      realEnquiries,
      testEnquiries,
      lastRealEnquiryAt,
      notificationsConfigured,
      isDemo: isDemoClinic({ name, email, domain: site?.domain }),
      createdAt: client.created_at,
    };
  });
}

// ---- Health classification -------------------------------------------------

export function classifyHealth(
  c: ClinicRecord,
  now: number,
): { status: HealthStatus; reasons: string[] } {
  const reasons: string[] = [];
  const subStatus = lower(c.subscriptionStatus);
  const widgetInstalled = Boolean(c.widgetLastSeenAt) || c.widgetTokenActive;
  const onboardingComplete = c.settingsCompleted || lower(c.onboardingStatus) === "complete";
  const subActive = ACTIVE_SUB_STATUSES.has(subStatus);

  // Critical signals.
  if (!widgetInstalled) reasons.push("widget_missing");
  if (subStatus && BROKEN_SUB_STATUSES.has(subStatus)) reasons.push("broken_subscription");
  if (c.hasSite && !c.clinicId) reasons.push("inconsistent_state");
  if (!c.hasSite) reasons.push("missing_onboarding_site");
  if (reasons.length > 0) return { status: "critical", reasons };

  // Healthy requires all three.
  if (widgetInstalled && onboardingComplete && subActive) {
    return { status: "healthy", reasons: [] };
  }

  // Otherwise attention — explain why.
  if (!onboardingComplete) reasons.push("onboarding_incomplete");
  if (!subActive) reasons.push("no_active_subscription");
  const noRecentEnquiry =
    !c.lastRealEnquiryAt ||
    now - new Date(c.lastRealEnquiryAt).getTime() > RECENT_ENQUIRY_WINDOW_MS;
  if (widgetInstalled && noRecentEnquiry) reasons.push("no_recent_enquiries");
  return { status: "attention", reasons };
}

// ---- Onboarding progress ---------------------------------------------------

export type ProgressStep = { label: string; done: boolean; action: string };

export function onboardingProgress(c: ClinicRecord): {
  steps: ProgressStep[];
  completed: number;
  total: number;
  nextStep: string | null;
} {
  const steps: ProgressStep[] = [
    { label: "Trial Started", done: true, action: "Account created" },
    {
      label: "Website Added",
      done: Boolean(c.domain),
      action: "Add the clinic website",
    },
    {
      label: "Widget Installed",
      done: Boolean(c.widgetLastSeenAt) || c.widgetTokenActive,
      action: "Install the widget snippet",
    },
    {
      label: "Test Lead Received",
      // Any captured lead (test OR real) proves the widget capture loop works;
      // not only the canonical "LeadClaw Test Enquiry" marker.
      done: c.totalEnquiries > 0,
      action: "Send a test enquiry",
    },
    {
      label: "Notifications Configured",
      done: c.notificationsConfigured,
      action: "Configure enquiry notifications",
    },
    {
      label: "Live",
      done: c.settingsCompleted || ACTIVE_SUB_STATUSES.has(lower(c.subscriptionStatus)),
      action: "Activate the account",
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done) || null;
  return { steps, completed, total: steps.length, nextStep: next?.action || null };
}

// ---- Timeline --------------------------------------------------------------

export function buildTimeline(c: ClinicRecord): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  if (c.createdAt) events.push({ label: "Trial Started", at: c.createdAt });
  if (c.widgetLastSeenAt)
    events.push({ label: "Widget Detected Live", at: c.widgetLastSeenAt });
  if (c.testEnquiries > 0 && c.widgetLastSeenAt)
    events.push({ label: "Test Lead Sent", at: c.widgetLastSeenAt });
  if (c.lastRealEnquiryAt)
    events.push({ label: "Real Enquiry Captured", at: c.lastRealEnquiryAt });
  if (
    c.subscriptionUpdatedAt &&
    ACTIVE_SUB_STATUSES.has(lower(c.subscriptionStatus))
  )
    events.push({ label: "Subscription Active", at: c.subscriptionUpdatedAt });

  return events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

// ---- Action Required -------------------------------------------------------

export type ActionItem = { id: string; name: string };
export type ActionRequired = {
  widgetNotInstalled: ActionItem[];
  testLeadNotCompleted: ActionItem[];
  trialsExpiringSoon: ActionItem[];
  brokenAccounts: ActionItem[];
};

export function computeActionRequired(
  clinics: ClinicRecord[],
  now: number,
): ActionRequired {
  const widgetNotInstalled: ActionItem[] = [];
  const testLeadNotCompleted: ActionItem[] = [];
  const trialsExpiringSoon: ActionItem[] = [];
  const brokenAccounts: ActionItem[] = [];

  for (const c of clinics) {
    if (c.isDemo) continue;
    const item = { id: c.id, name: c.name };
    const widgetInstalled = Boolean(c.widgetLastSeenAt) || c.widgetTokenActive;

    if (!widgetInstalled) widgetNotInstalled.push(item);
    // Any captured lead (test OR real) satisfies the verification milestone.
    else if (c.totalEnquiries === 0) testLeadNotCompleted.push(item);

    if (lower(c.subscriptionStatus) === "trialing" && c.trialEnd) {
      const days = (new Date(c.trialEnd).getTime() - now) / DAY_MS;
      if (days >= 0 && days <= TRIAL_EXPIRY_WINDOW_DAYS) trialsExpiringSoon.push(item);
    }

    const subStatus = lower(c.subscriptionStatus);
    const broken =
      !c.hasSite ||
      (c.hasSite && !c.clinicId) ||
      !c.subscriptionStatus ||
      BROKEN_SUB_STATUSES.has(subStatus);
    if (broken) brokenAccounts.push(item);
  }

  return { widgetNotInstalled, testLeadNotCompleted, trialsExpiringSoon, brokenAccounts };
}

// ---- Founder metrics -------------------------------------------------------

export type FounderMetrics = {
  customers: { activePaid: number; activeTrials: number; totalClinics: number };
  revenue: { mrr: number; arr: number; trialToPaidPct: number };
  usage: { liveWidgets: number; totalEnquiries: number; enquiriesLast30Days: number };
  leadGeneration: { scraperLeadsImported: number; leadsAwaitingContact: number };
};

export function computeFounderMetrics(
  clinics: ClinicRecord[],
  leads: RawLead[],
  enquiries: RawEnquiry[],
  now: number,
): FounderMetrics {
  let activePaid = 0;
  let activeTrials = 0;
  let mrr = 0;
  let liveWidgets = 0;

  for (const c of clinics) {
    const status = lower(c.subscriptionStatus);
    const plan = normalizePlan(c.subscriptionPlan);
    if (status === "active") {
      mrr += PLAN_MONTHLY_PRICES[plan]?.amount || 0;
      if (isPaidPlan(plan)) activePaid += 1;
    }
    if (status === "trialing") activeTrials += 1;
    if (widgetIsLive(c.widgetLastSeenAt, now)) liveWidgets += 1;
  }

  // Conversion proxy from current state (no historical funnel is stored):
  // paid customers / (paid customers + active trials).
  const denom = activePaid + activeTrials;
  const trialToPaidPct = denom > 0 ? Math.round((activePaid / denom) * 100) : 0;

  const realEnquiries = enquiries.filter((e) => !isTestEnquiry(e.name, e.service));
  const enquiriesLast30Days = realEnquiries.filter(
    (e) => now - new Date(e.created_at).getTime() <= RECENT_ENQUIRY_WINDOW_MS,
  ).length;

  const leadsAwaitingContact = leads.filter((l) => lower(l.status) === "new").length;

  return {
    customers: { activePaid, activeTrials, totalClinics: clinics.length },
    revenue: { mrr, arr: mrr * 12, trialToPaidPct },
    usage: {
      liveWidgets,
      totalEnquiries: realEnquiries.length,
      enquiriesLast30Days,
    },
    leadGeneration: {
      scraperLeadsImported: leads.length,
      leadsAwaitingContact,
    },
  };
}

// ---- Lead pipeline ---------------------------------------------------------

export type PipelineCounts = {
  new: number;
  contacted: number;
  interested: number;
  demoBooked: number;
  won: number;
  lost: number;
  total: number;
};

export function computePipeline(leads: RawLead[]): PipelineCounts {
  const counts: PipelineCounts = {
    new: 0,
    contacted: 0,
    interested: 0,
    demoBooked: 0,
    won: 0,
    lost: 0,
    total: leads.length,
  };
  for (const l of leads) {
    const s = lower(l.status);
    if (s === "new" || s === "") counts.new += 1;
    else if (s === "contacted" || s === "replied") counts.contacted += 1;
    else if (s === "interested") counts.interested += 1;
    else if (s === "demo_booked" || s === "demo") counts.demoBooked += 1;
    else if (s === "won" || s === "customer") counts.won += 1;
    else if (s === "lost" || s === "not_interested" || s === "do_not_contact")
      counts.lost += 1;
  }
  return counts;
}

// ---- This week snapshot ----------------------------------------------------

export type ThisWeek = {
  newTrials: number;
  newCustomers: number;
  leadsImported: number;
  enquiriesCaptured: number;
};

export function computeThisWeek(
  clinics: ClinicRecord[],
  leads: RawLead[],
  enquiries: RawEnquiry[],
  now: number,
): ThisWeek {
  const weekAgo = now - 7 * DAY_MS;
  const within = (iso: string | null | undefined) =>
    Boolean(iso) && new Date(iso as string).getTime() >= weekAgo;

  const newTrials = clinics.filter((c) => within(c.createdAt)).length;
  const newCustomers = clinics.filter(
    (c) => lower(c.subscriptionStatus) === "active" && within(c.subscriptionUpdatedAt),
  ).length;
  const leadsImported = leads.filter((l) => within(l.created_at)).length;
  const enquiriesCaptured = enquiries.filter(
    (e) => !isTestEnquiry(e.name, e.service) && within(e.created_at),
  ).length;

  return { newTrials, newCustomers, leadsImported, enquiriesCaptured };
}

// ---- Widget health (Phase 5) ----------------------------------------------
// Operationally useful recency breakdown of installed widgets, derived purely
// from widget_tokens.last_seen_at (no new query). Replaces the single ambiguous
// "Live Widgets" number that conflicted with the active-token count shown in the
// Business overview grid (which counted issued tokens, not liveness).

export type WidgetSeenBucket = "live" | "today" | "stale" | "never";

// Returns null when the clinic has no widget at all (no active token and never
// seen) — such clinics are an onboarding blocker, not a widget-health data point.
export function widgetSeenBucket(
  lastSeenAt: string | null,
  now: number,
  hasToken: boolean,
): WidgetSeenBucket | null {
  const hasWidget = hasToken || Boolean(lastSeenAt);
  if (!hasWidget) return null;
  if (!lastSeenAt) return "never";
  const t = new Date(lastSeenAt).getTime();
  if (!Number.isFinite(t)) return "never";
  const age = now - t;
  if (age <= WIDGET_LIVE_WINDOW_MS) return "live"; // <= 15 min
  if (age <= DAY_MS) return "today"; // <= 24 h
  return "stale"; // > 24 h
}

export type WidgetHealth = {
  totalWithWidget: number;
  seenLast15Min: number;
  seenLast24Hours: number; // cumulative: live + today (<= 24h)
  seenEarlier: number; // > 24h
  neverSeen: number;
};

export function computeWidgetHealth(
  clinics: ClinicRecord[],
  now: number,
): WidgetHealth {
  let live = 0;
  let today = 0;
  let stale = 0;
  let never = 0;
  for (const c of clinics) {
    const bucket = widgetSeenBucket(c.widgetLastSeenAt, now, c.widgetTokenActive);
    if (bucket === null) continue;
    if (bucket === "live") live += 1;
    else if (bucket === "today") today += 1;
    else if (bucket === "stale") stale += 1;
    else never += 1;
  }
  return {
    totalWithWidget: live + today + stale + never,
    seenLast15Min: live,
    seenLast24Hours: live + today,
    seenEarlier: stale,
    neverSeen: never,
  };
}

// ---- Production-customer helpers (Phase 4) --------------------------------

// Per-clinic monthly price. Mirrors the MRR rule in computeFounderMetrics:
// only an ACTIVE subscription contributes, priced by plan.
export function monthlyPriceFor(c: ClinicRecord): number {
  if (lower(c.subscriptionStatus) !== "active") return 0;
  const plan = normalizePlan(c.subscriptionPlan);
  return PLAN_MONTHLY_PRICES[plan]?.amount || 0;
}

// Excluded from the Production Customers table by default: demo/test clinics
// (isDemoClinic already covers demo|test|example and test.leadclaw.uk) plus
// LeadClaw internal accounts/domains (anything containing "leadclaw", e.g.
// www.leadclaw.uk or @leadclaw.uk). The "Show Test Data" toggle bypasses this.
export function isExcludedFromProduction(c: ClinicRecord): boolean {
  if (c.isDemo) return true;
  const haystacks = [c.name, c.email, c.domain].map(lower);
  for (const h of haystacks) {
    if (!h) continue;
    if (h.includes("leadclaw")) return true; // internal company accounts/sites
  }
  return false;
}

// ---- Onboarding blockers (Phase 3) ----------------------------------------

export type OnboardingBlocker = {
  id: string;
  name: string;
  code: string;
  problem: string;
  action: string;
  severity: number; // higher = more severe (used for sort order)
};

// One row per non-demo clinic that needs action, carrying its single
// most-severe blocker. Clinics with no blocker are omitted ("only show clinics
// requiring action"). Reuses the same ClinicRecord signals as the rest of the
// dashboard — no new query or duplicate aggregation.
export function computeOnboardingBlockers(
  clinics: ClinicRecord[],
): OnboardingBlocker[] {
  const out: OnboardingBlocker[] = [];

  for (const c of clinics) {
    if (c.isDemo) continue;
    const widgetInstalled = Boolean(c.widgetLastSeenAt) || c.widgetTokenActive;

    // Ordered most-severe first; first match wins for this clinic.
    let blocker: Omit<OnboardingBlocker, "id" | "name"> | null = null;

    if (!c.hasSite) {
      blocker = {
        code: "broken_onboarding",
        severity: 60,
        problem: "Broken onboarding state — no onboarding site exists",
        action: "Re-run provisioning to create the site and widget token",
      };
    } else if (!c.clinicId) {
      blocker = {
        code: "no_clinic_linked",
        severity: 50,
        problem: "No clinic linked to the onboarding site",
        action: "Link the clinic record (clinic_id) to the site",
      };
    } else if (!c.domain) {
      blocker = {
        code: "missing_domain",
        severity: 40,
        problem: "No website domain set",
        action: "Add the clinic's website domain in onboarding",
      };
    } else if (!widgetInstalled) {
      blocker = {
        code: "no_widget",
        severity: 30,
        problem: "Widget not installed (no active token, never seen)",
        action: "Send the install snippet and confirm it is on the site",
      };
    } else if (!c.subscriptionStatus) {
      blocker = {
        code: "missing_subscription",
        severity: 20,
        problem: "No subscription on record for this account",
        action: "Check billing — no subscription is linked to this email",
      };
    } else if (c.totalEnquiries === 0) {
      blocker = {
        code: "no_enquiry",
        severity: 10,
        problem: "No enquiries captured yet",
        action: "Send a test enquiry and review widget placement",
      };
    }

    if (!blocker) continue;
    out.push({ id: c.id, name: c.name, ...blocker });
  }

  // Most severe first, then alphabetical for stable display.
  out.sort((a, b) => b.severity - a.severity || a.name.localeCompare(b.name));
  return out;
}
