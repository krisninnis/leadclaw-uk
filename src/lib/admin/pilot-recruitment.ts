// Pilot Recruitment — pure candidate logic for the Command Centre.
//
// Side-effect-free, I/O-free functions (mirrors src/lib/admin/command-centre.ts):
// the API route loads leads + pilot metadata read-only and feeds them here. This
// module NEVER writes, mutates, or deletes — it only classifies, filters, ranks,
// and aggregates existing records. It also never touches the scraper, the import
// route, or core lead fields; pilot state lives entirely in lead_pilot_recruitment.
//
// Flow this supports:
//   scraper -> leads table -> (here) candidate filter/rank -> founder contacts.

// ---- Pilot status (mirrors the table CHECK constraint) ---------------------

export const PILOT_STATUSES = [
  "candidate",
  "contacted",
  "interested",
  "pilot",
  "customer",
  "not_fit",
  "no_response",
] as const;

export type PilotStatus = (typeof PILOT_STATUSES)[number];

export function isPilotStatus(value: unknown): value is PilotStatus {
  return (
    typeof value === "string" &&
    (PILOT_STATUSES as readonly string[]).includes(value)
  );
}

// ---- Target trades ---------------------------------------------------------
// V1 launch trades plus future-compatible ones. The scraper stores a canonical
// `niche` slug (see leadclaw-lead-scraper/niches.json: "plumber", "electrician",
// "roofer", "dental", "beauty", ...). We classify primarily off that slug, with a
// keyword fallback against the free-text niche / company name so a mislabelled or
// custom-sourced lead is still caught.

export type Trade =
  | "plumber"
  | "electrician"
  | "roofer"
  | "dentist"
  | "aesthetic_clinic"
  | "physiotherapist";

// Trades enabled for active pilot recruitment in v1.
export const PILOT_TRADES: Trade[] = ["plumber", "electrician", "roofer"];

// Future-compatible trades (recognised but not in the default v1 filter set).
export const FUTURE_TRADES: Trade[] = [
  "dentist",
  "aesthetic_clinic",
  "physiotherapist",
];

type TradeMatcher = { trade: Trade; slugs: string[]; keywords: RegExp };

const TRADE_MATCHERS: TradeMatcher[] = [
  {
    trade: "plumber",
    slugs: ["plumber", "plumbing"],
    keywords: /\bplumb(er|ing)?\b/,
  },
  {
    trade: "electrician",
    slugs: ["electrician", "electrical"],
    keywords: /\belectric(ian|al)?\b/,
  },
  {
    trade: "roofer",
    slugs: ["roofer", "roofing"],
    keywords: /\broof(er|ing)?\b/,
  },
  {
    trade: "dentist",
    slugs: ["dental", "dentist"],
    keywords: /\bdent(ist|al)\b/,
  },
  {
    trade: "aesthetic_clinic",
    slugs: ["beauty", "aesthetic", "aesthetics", "medspa", "med_spa"],
    keywords: /\b(aesthetic|aesthetics|medspa|med spa|botox|filler|skin clinic)\b/,
  },
  {
    trade: "physiotherapist",
    slugs: ["physio", "physiotherapy", "physiotherapist"],
    keywords: /\bphysio(therapy|therapist)?\b/,
  },
];

const TRADE_LABELS: Record<Trade, string> = {
  plumber: "Plumber",
  electrician: "Electrician",
  roofer: "Roofer",
  dentist: "Dentist",
  aesthetic_clinic: "Aesthetic clinic",
  physiotherapist: "Physiotherapist",
};

export function tradeLabel(trade: Trade): string {
  return TRADE_LABELS[trade];
}

function lower(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

// Classify a lead into one of the known trades, or null if it does not look like
// a target trade. Slug match (exact, from the scraper niche) wins; otherwise a
// keyword search over niche + company name is used.
export function classifyTrade(
  niche: string | null | undefined,
  companyName: string | null | undefined,
): Trade | null {
  const slug = lower(niche);
  for (const m of TRADE_MATCHERS) {
    if (m.slugs.includes(slug)) return m.trade;
  }
  const haystack = `${lower(niche)} ${lower(companyName)}`;
  for (const m of TRADE_MATCHERS) {
    if (m.keywords.test(haystack)) return m.trade;
  }
  return null;
}

// ---- Raw input shapes ------------------------------------------------------

// Subset of public.leads columns we read. All optional/nullable so a lead missing
// any enrichment field still flows through (we never require pilot data on leads).
export type RawLeadRow = {
  id: string;
  company_name: string | null;
  niche: string | null;
  city: string | null;
  website: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  status: string | null;
  score: number | null;
  lead_score: number | null;
  lead_quality_score: number | null;
  has_live_chat: boolean | null;
  has_contact_form: boolean | null;
  created_at: string | null;
};

// Subset of public.lead_pilot_recruitment columns.
export type RawPilotRow = {
  lead_id: string;
  pilot_status: string | null;
  pilot_notes: string | null;
  follow_up_at: string | null;
  last_contacted_at: string | null;
  contacted_count: number | null;
  interested_at: string | null;
  pilot_started_at: string | null;
  converted_customer_at: string | null;
  updated_at: string | null;
};

// ---- Candidate view --------------------------------------------------------

export type PilotCandidate = {
  leadId: string;
  companyName: string;
  trade: Trade;
  tradeLabel: string;
  city: string | null;
  phone: string | null;
  website: string | null;
  email: string | null;
  leadStatus: string | null;
  score: number; // best available lead score (0 if none)
  pilotStatus: PilotStatus;
  pilotNotes: string | null;
  notesPreview: string | null;
  followUpAt: string | null;
  lastContactedAt: string | null;
  contactedCount: number;
  followUpDue: boolean;
  // Ranking transparency.
  priorityScore: number;
  signals: string[];
  nextAction: string;
};

// Lead statuses that mean the lead is already a won customer in the SALES
// pipeline (see command-centre computePipeline). Such leads are excluded from
// pilot candidacy regardless of pilot metadata.
const CUSTOMER_LEAD_STATUSES = new Set(["won", "customer"]);

// Pilot statuses that take a lead OUT of the "new candidate" pool.
const NON_CANDIDATE_PILOT_STATUSES = new Set<PilotStatus>([
  "pilot",
  "customer",
  "not_fit",
]);

export function bestLeadScore(lead: RawLeadRow): number {
  const candidates = [
    lead.lead_quality_score,
    lead.lead_score,
    lead.score,
  ].filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  return candidates.length ? Math.max(...candidates) : 0;
}

function nextActionFor(status: PilotStatus, followUpDue: boolean): string {
  if (followUpDue) return "Follow up now (due)";
  switch (status) {
    case "candidate":
      return "Call / message to introduce the pilot";
    case "contacted":
      return "Awaiting reply — chase if no response";
    case "interested":
      return "Book the pilot onboarding call";
    case "pilot":
      return "Support live pilot, confirm value";
    case "customer":
      return "Convert to paid plan";
    case "no_response":
      return "Try an alternate channel or close out";
    case "not_fit":
      return "No action — marked not a fit";
    default:
      return "Review";
  }
}

function previewNotes(notes: string | null): string | null {
  if (!notes) return null;
  const trimmed = notes.trim();
  if (trimmed.length <= 80) return trimmed || null;
  return `${trimmed.slice(0, 77)}…`;
}

// ---- Candidate eligibility -------------------------------------------------

export type CandidateOptions = {
  trades?: Trade[]; // which trades count as targets (default: PILOT_TRADES)
  now?: number;
};

// A lead is an eligible pilot candidate when:
//   * it classifies as a target trade;
//   * it has a phone number (needed for missed-call recovery outreach);
//   * it has a website OR a business name (something to identify/reference);
//   * its sales status is not already a customer/won;
//   * its pilot status is not not_fit / pilot / customer (those are out of the
//     candidate pool — "pilot"/"customer" are tracked, just not "new candidates").
// We do NOT require all enrichment signals — ranking handles partial data.
export function isEligibleCandidate(
  lead: RawLeadRow,
  pilot: RawPilotRow | null,
  options: CandidateOptions = {},
): boolean {
  const targetTrades = options.trades ?? PILOT_TRADES;
  const trade = classifyTrade(lead.niche, lead.company_name);
  if (!trade || !targetTrades.includes(trade)) return false;

  const hasPhone = Boolean(lower(lead.contact_phone));
  if (!hasPhone) return false;

  const hasIdentity = Boolean(lower(lead.website) || lower(lead.company_name));
  if (!hasIdentity) return false;

  if (CUSTOMER_LEAD_STATUSES.has(lower(lead.status))) return false;

  const pilotStatus = isPilotStatus(pilot?.pilot_status)
    ? (pilot!.pilot_status as PilotStatus)
    : "candidate";
  if (NON_CANDIDATE_PILOT_STATUSES.has(pilotStatus)) return false;

  return true;
}

// ---- Ranking ---------------------------------------------------------------
// Higher priorityScore = contact sooner. Partial data is fine — every present
// signal adds points. Calibrated so a fully-signalled local trade with no online
// booking/chat ranks well above a bare lead.

export function rankCandidate(
  lead: RawLeadRow,
  pilot: RawPilotRow | null,
  now: number,
): { priorityScore: number; signals: string[] } {
  const signals: string[] = [];
  let score = 0;

  // Trade business (always true for eligible candidates) — baseline.
  signals.push("trade_business");
  score += 20;

  if (lower(lead.contact_phone)) {
    signals.push("phone_available");
    score += 25;
  }
  if (lower(lead.website)) {
    signals.push("website_available");
    score += 10;
  }
  if (lower(lead.city)) {
    signals.push("local_uk_business");
    score += 5;
  }

  // Quality score (0..100-ish) folded in at a modest weight so it tie-breaks but
  // does not dominate the structural signals above.
  const quality = bestLeadScore(lead);
  if (quality > 0) {
    signals.push("has_lead_score");
    score += Math.min(20, Math.round(quality / 5));
  }

  // Missed-call-recovery fit: a business with NO live chat and NO online booking
  // form has no automated capture today, so it benefits most from the product.
  if (lead.has_live_chat === false) {
    signals.push("no_live_chat");
    score += 10;
  }
  if (lead.has_contact_form === false) {
    signals.push("no_online_booking");
    score += 10;
  }

  // A follow-up that is due nudges the lead up so it is not missed.
  if (pilot?.follow_up_at) {
    const due = new Date(pilot.follow_up_at).getTime();
    if (Number.isFinite(due) && due <= now) {
      signals.push("follow_up_due");
      score += 30;
    }
  }

  return { priorityScore: score, signals };
}

// ---- Assembly --------------------------------------------------------------

export function buildCandidates(
  leads: RawLeadRow[],
  pilots: RawPilotRow[],
  options: CandidateOptions = {},
): PilotCandidate[] {
  const now = options.now ?? Date.now();
  const pilotByLead = new Map<string, RawPilotRow>();
  for (const p of pilots) pilotByLead.set(p.lead_id, p);

  const out: PilotCandidate[] = [];
  for (const lead of leads) {
    const pilot = pilotByLead.get(lead.id) || null;
    if (!isEligibleCandidate(lead, pilot, options)) continue;

    const trade = classifyTrade(lead.niche, lead.company_name) as Trade;
    const pilotStatus = isPilotStatus(pilot?.pilot_status)
      ? (pilot!.pilot_status as PilotStatus)
      : "candidate";

    const followUpDue = Boolean(
      pilot?.follow_up_at &&
        Number.isFinite(new Date(pilot.follow_up_at).getTime()) &&
        new Date(pilot.follow_up_at).getTime() <= now,
    );

    const { priorityScore, signals } = rankCandidate(lead, pilot, now);

    out.push({
      leadId: lead.id,
      companyName: lead.company_name || "(unnamed business)",
      trade,
      tradeLabel: tradeLabel(trade),
      city: lead.city,
      phone: lead.contact_phone,
      website: lead.website,
      email: lead.contact_email,
      leadStatus: lead.status,
      score: bestLeadScore(lead),
      pilotStatus,
      pilotNotes: pilot?.pilot_notes ?? null,
      notesPreview: previewNotes(pilot?.pilot_notes ?? null),
      followUpAt: pilot?.follow_up_at ?? null,
      lastContactedAt: pilot?.last_contacted_at ?? null,
      contactedCount: pilot?.contacted_count ?? 0,
      followUpDue,
      priorityScore,
      signals,
      nextAction: nextActionFor(pilotStatus, followUpDue),
    });
  }

  // Best candidates first; due follow-ups bubble up via priorityScore. Stable
  // alphabetical tie-break for deterministic display.
  out.sort(
    (a, b) =>
      b.priorityScore - a.priorityScore ||
      b.score - a.score ||
      a.companyName.localeCompare(b.companyName),
  );

  return out;
}

// ---- Summary cards ---------------------------------------------------------
// These count ALL pilot-tracked + candidate leads (not just the default-trade
// filtered list) so the cards reflect the whole pilot pipeline. "newCandidates"
// counts eligible leads currently in the candidate pool; the status counts come
// from the pilot metadata regardless of trade so nothing is hidden once tracked.

export type PilotSummary = {
  newCandidates: number;
  contacted: number;
  interested: number;
  pilot: number;
  customer: number;
  notFit: number;
  noResponse: number;
  followUpsDue: number;
  total: number; // total pilot-tracked leads
};

export function computePilotSummary(
  leads: RawLeadRow[],
  pilots: RawPilotRow[],
  now: number = Date.now(),
): PilotSummary {
  // New candidates: eligible leads whose pilot status is still "candidate"
  // (untracked leads default to candidate). Computed across the v1 pilot trades.
  const candidates = buildCandidates(leads, pilots, { now });
  const newCandidates = candidates.filter(
    (c) => c.pilotStatus === "candidate",
  ).length;

  const summary: PilotSummary = {
    newCandidates,
    contacted: 0,
    interested: 0,
    pilot: 0,
    customer: 0,
    notFit: 0,
    noResponse: 0,
    followUpsDue: 0,
    total: pilots.length,
  };

  for (const p of pilots) {
    const status = isPilotStatus(p.pilot_status)
      ? (p.pilot_status as PilotStatus)
      : "candidate";
    if (status === "contacted") summary.contacted += 1;
    else if (status === "interested") summary.interested += 1;
    else if (status === "pilot") summary.pilot += 1;
    else if (status === "customer") summary.customer += 1;
    else if (status === "not_fit") summary.notFit += 1;
    else if (status === "no_response") summary.noResponse += 1;

    if (p.follow_up_at) {
      const due = new Date(p.follow_up_at).getTime();
      if (
        Number.isFinite(due) &&
        due <= now &&
        status !== "not_fit" &&
        status !== "customer"
      ) {
        summary.followUpsDue += 1;
      }
    }
  }

  return summary;
}

// ---- Trade filter counts ---------------------------------------------------

export type TradeFilterCount = { trade: Trade | "all"; label: string; count: number };

export function computeTradeCounts(
  candidates: PilotCandidate[],
): TradeFilterCount[] {
  const counts: TradeFilterCount[] = [
    { trade: "all", label: "All", count: candidates.length },
  ];
  for (const trade of PILOT_TRADES) {
    counts.push({
      trade,
      label: tradeLabel(trade),
      count: candidates.filter((c) => c.trade === trade).length,
    });
  }
  return counts;
}
