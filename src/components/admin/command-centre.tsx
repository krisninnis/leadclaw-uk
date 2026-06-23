"use client";

import { useEffect, useMemo, useState } from "react";

// Command Centre v2 — Founder Operating System dashboard.
// Read-only: fetches the aggregate from /api/admin/command-centre and renders
// operational panels. Production filters affect visibility only (no deletes).

type ActionItem = { id: string; name: string };
type HealthStatus = "healthy" | "attention" | "critical";
type RiskLevel = "critical" | "warning" | "attention";
type WidgetBucket = "live" | "today" | "stale" | "never" | null;

type ClinicView = {
  id: string;
  name: string;
  email: string | null;
  domain: string | null;
  isDemo: boolean;
  excludedFromProduction: boolean;
  subscriptionStatus: string | null;
  subscriptionPlan: string | null;
  mrr: number;
  totalEnquiries: number;
  realEnquiries: number;
  testEnquiries: number;
  createdAt: string;
  health: { status: HealthStatus; reasons: string[] };
  progress: {
    completed: number;
    total: number;
    nextStep: string | null;
    steps: { label: string; done: boolean; action: string }[];
  };
  widget: {
    live: boolean;
    bucket: WidgetBucket;
    tokenActive: boolean;
    lastSeenAt: string | null;
    lastSeenDomain: string | null;
  };
  timeline: { label: string; at: string }[];
};

type FunnelStageView = {
  key: string;
  label: string;
  count: number | null;
  conversionFromPrevPct: number | null;
  note?: string;
};

type AtRiskItem = {
  id: string;
  name: string;
  trialAgeDays: number;
  status: RiskLevel;
  action: string;
};

type FounderInboxItem = {
  id: string;
  name: string;
  score: number;
  tier: "critical" | "high" | "medium";
  code: string;
  status: string;
  action: string;
};

type BlockerItem = {
  id: string;
  name: string;
  code: string;
  problem: string;
  action: string;
  severity: number;
};

type Payload = {
  ok: boolean;
  generatedAt: string;
  founderInbox: {
    items: FounderInboxItem[];
    counts: { all: number; critical: number; high: number; medium: number };
  };
  growthFunnel: {
    visitorsAvailable: boolean;
    stages: FunnelStageView[];
  };
  revenuePipeline: {
    trialsStarted: number;
    activatedTrials: number;
    payingCustomers: number;
    trialToActivatedPct: number | null;
    activatedToPaidPct: number | null;
  };
  atRisk: {
    critical: AtRiskItem[];
    warning: AtRiskItem[];
    attention: AtRiskItem[];
    all: AtRiskItem[];
  };
  onboardingBlockers: BlockerItem[];
  widgetHealth: {
    totalWithWidget: number;
    seenLast15Min: number;
    seenLast24Hours: number;
    seenEarlier: number;
    neverSeen: number;
  };
  actionRequired: {
    widgetNotInstalled: ActionItem[];
    testLeadNotCompleted: ActionItem[];
    trialsExpiringSoon: ActionItem[];
    brokenAccounts: ActionItem[];
  };
  founderMetrics: {
    customers: { activePaid: number; activeTrials: number; totalClinics: number };
    revenue: { mrr: number; arr: number; trialToPaidPct: number };
    usage: { liveWidgets: number; totalEnquiries: number; enquiriesLast30Days: number };
    leadGeneration: { scraperLeadsImported: number; leadsAwaitingContact: number };
  };
  thisWeek: {
    newTrials: number;
    newCustomers: number;
    leadsImported: number;
    enquiriesCaptured: number;
  };
  pipeline: {
    new: number;
    contacted: number;
    interested: number;
    demoBooked: number;
    won: number;
    lost: number;
    total: number;
  };
  clinics: ClinicView[];
};

function gbp(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n);
}

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "—";
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function pctText(p: number | null): string {
  return p === null ? "—" : `${p}%`;
}

function Section({
  title,
  subtitle,
  defaultOpen = true,
  accent,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  accent?: "danger";
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section
      className={`rounded-2xl border bg-white shadow-sm ${
        accent === "danger" ? "border-rose-200" : "border-slate-200"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <div>
          <h2 className="text-base font-semibold text-foreground md:text-lg">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
        </div>
        <span className="text-slate-400">{open ? "▾" : "▸"}</span>
      </button>
      {open ? <div className="border-t border-slate-100 p-5">{children}</div> : null}
    </section>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

// ---- Founder Inbox (priority work queue) ----------------------------------

const INBOX_TIER_META: Record<
  "critical" | "high" | "medium",
  { label: string; cls: string }
> = {
  critical: { label: "🔴 CRITICAL", cls: "bg-rose-100 text-rose-700" },
  high: { label: "🟠 HIGH", cls: "bg-amber-100 text-amber-700" },
  medium: { label: "🟡 MEDIUM", cls: "bg-yellow-100 text-yellow-700" },
};

function FounderInboxSection({ inbox }: { inbox: Payload["founderInbox"] }) {
  const [filter, setFilter] = useState<"all" | "critical" | "high" | "medium">("all");

  const items =
    filter === "all" ? inbox.items : inbox.items.filter((i) => i.tier === filter);

  const tabs: {
    key: "all" | "critical" | "high" | "medium";
    label: string;
    count: number;
  }[] = [
    { key: "all", label: "All", count: inbox.counts.all },
    { key: "critical", label: "Critical", count: inbox.counts.critical },
    { key: "high", label: "High", count: inbox.counts.high },
    { key: "medium", label: "Medium", count: inbox.counts.medium },
  ];

  return (
    <Section
      title="Founder Inbox"
      subtitle="Highest impact actions to move revenue forward."
      accent={inbox.counts.critical > 0 ? "danger" : undefined}
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setFilter(t.key)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              filter === t.key
                ? "border-brand bg-brand/10 text-brand-strong"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted">Nothing requires attention today.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((i) => {
            const meta = INBOX_TIER_META[i.tier];
            return (
              <li key={i.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${meta.cls}`}
                  >
                    {meta.label}
                  </span>
                  <span className="font-medium text-slate-900">{i.name}</span>
                  <span className="text-sm text-slate-500">— {i.status}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  <span className="font-medium text-slate-700">Action:</span> {i.action}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

// ---- Revenue Pipeline (Phase 2) -------------------------------------------

function RevenuePipelineSection({ rp }: { rp: Payload["revenuePipeline"] }) {
  return (
    <Section
      title="Revenue Pipeline"
      subtitle="Trials → Activated → Paying, with stage conversion."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Trials Started" value={rp.trialsStarted} hint="Onboarding client exists" />
        <Metric
          label="Activated Trials"
          value={rp.activatedTrials}
          hint="Widget installed + ≥1 enquiry"
        />
        <Metric label="Paying Customers" value={rp.payingCustomers} hint="Active paid subscription" />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Trials → Activated</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {pctText(rp.trialToActivatedPct)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Activated → Paid</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {pctText(rp.activatedToPaidPct)}
          </p>
        </div>
      </div>
    </Section>
  );
}

// ---- Widget Health (Phase 5) ----------------------------------------------

function WidgetHealthSection({ wh }: { wh: Payload["widgetHealth"] }) {
  return (
    <Section
      title="Widget Health"
      subtitle={`${wh.totalWithWidget} widget${wh.totalWithWidget === 1 ? "" : "s"} — recency from last_seen_at`}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Seen last 15 min" value={wh.seenLast15Min} hint="Live right now" />
        <Metric
          label="Seen last 24 hours"
          value={wh.seenLast24Hours}
          hint="Active today (incl. last 15 min)"
        />
        <Metric label="Seen earlier" value={wh.seenEarlier} hint="Last seen > 24h ago" />
        <Metric label="Never seen" value={wh.neverSeen} hint="Token issued, never pinged" />
      </div>
    </Section>
  );
}

// ---- Onboarding Blockers (Phase 3) ----------------------------------------

const BLOCKER_TONE: Record<string, string> = {
  broken_onboarding: "bg-rose-100 text-rose-700",
  no_clinic_linked: "bg-rose-100 text-rose-700",
  missing_domain: "bg-amber-100 text-amber-700",
  no_widget: "bg-amber-100 text-amber-700",
  missing_subscription: "bg-amber-100 text-amber-700",
  no_enquiry: "bg-yellow-100 text-yellow-700",
};

function OnboardingBlockersSection({ blockers }: { blockers: BlockerItem[] }) {
  return (
    <Section
      title={`Onboarding Blockers${blockers.length > 0 ? ` (${blockers.length})` : ""}`}
      subtitle="Clinics requiring action — most severe first."
      accent={blockers.some((b) => b.severity >= 50) ? "danger" : undefined}
    >
      {blockers.length === 0 ? (
        <p className="text-sm text-muted">No onboarding blockers — every clinic is set up.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 font-medium">Clinic</th>
                <th className="py-2 pr-4 font-medium">Problem</th>
                <th className="py-2 font-medium">Recommended action</th>
              </tr>
            </thead>
            <tbody>
              {blockers.map((b) => (
                <tr key={b.id} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-4 font-medium text-slate-900">{b.name}</td>
                  <td className="py-2 pr-4">
                    <span
                      className={`whitespace-normal rounded-full px-2 py-0.5 text-xs font-medium ${
                        BLOCKER_TONE[b.code] || "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {b.problem}
                    </span>
                  </td>
                  <td className="py-2 text-slate-600">{b.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

// ---- Production Customers (Phase 4) ---------------------------------------

const WIDGET_BUCKET_LABEL: Record<string, string> = {
  live: "🟢 Live (≤15m)",
  today: "🟡 Seen today",
  stale: "🔴 Stale (>24h)",
  never: "⚪ Never seen",
};

function ProductionCustomersSection({ clinics }: { clinics: ClinicView[] }) {
  const [showTestData, setShowTestData] = useState(false); // default OFF

  const rows = useMemo(() => {
    const filtered = showTestData
      ? clinics
      : clinics.filter((c) => !c.excludedFromProduction);
    // Highest MRR first, then alphabetical.
    return [...filtered].sort((a, b) => b.mrr - a.mrr || a.name.localeCompare(b.name));
  }, [clinics, showTestData]);

  const totalMrr = rows.reduce((sum, c) => sum + c.mrr, 0);

  return (
    <Section
      title="Production Customers"
      subtitle={`${rows.length} account${rows.length === 1 ? "" : "s"} · ${gbp(totalMrr)} MRR`}
    >
      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
        <label className="flex items-center gap-2 text-slate-600">
          <input
            type="checkbox"
            checked={showTestData}
            onChange={(e) => setShowTestData(e.target.checked)}
          />
          Show Test Data
        </label>
        <span className="text-xs text-slate-400">
          Off by default — hides demo, test.leadclaw.uk, and LeadClaw internal accounts.
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">No production customers match the current filter.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 font-medium">Customer</th>
                <th className="py-2 pr-4 font-medium">Plan</th>
                <th className="py-2 pr-4 font-medium">MRR</th>
                <th className="py-2 pr-4 font-medium">Widget status</th>
                <th className="py-2 pr-4 font-medium">Leads received</th>
                <th className="py-2 font-medium">Health</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const meta = HEALTH_META[c.health.status];
                return (
                  <tr key={c.id} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-4">
                      <div className="font-medium text-slate-900">{c.name}</div>
                      <div className="text-xs text-slate-500">{c.domain || c.email || "—"}</div>
                    </td>
                    <td className="py-2 pr-4 text-slate-600">{c.subscriptionPlan || "—"}</td>
                    <td className="py-2 pr-4 font-medium text-slate-900">{gbp(c.mrr)}</td>
                    <td className="py-2 pr-4 whitespace-nowrap text-slate-600">
                      {c.widget.bucket ? WIDGET_BUCKET_LABEL[c.widget.bucket] : "— No widget"}
                    </td>
                    <td className="py-2 pr-4 font-medium text-slate-700">{c.realEnquiries}</td>
                    <td className="py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.cls}`}>
                        {meta.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

// ---- Growth Funnel ---------------------------------------------------------

function FunnelStageCard({ stage, index }: { stage: FunnelStageView; index: number }) {
  const isPlaceholder = stage.count === null;
  return (
    <div className="flex items-stretch gap-2">
      {index > 0 ? (
        <div className="flex flex-col items-center justify-center px-1 text-xs text-slate-400">
          <span aria-hidden>→</span>
          <span className="mt-1 whitespace-nowrap font-medium text-slate-500">
            {stage.conversionFromPrevPct === null
              ? "—"
              : `${stage.conversionFromPrevPct}%`}
          </span>
        </div>
      ) : null}
      <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm text-slate-500">{stage.label}</p>
        <p className="mt-1 text-2xl font-semibold text-foreground">
          {isPlaceholder ? "—" : stage.count?.toLocaleString("en-GB")}
        </p>
        {stage.note ? <p className="mt-1 text-xs text-slate-500">{stage.note}</p> : null}
      </div>
    </div>
  );
}

function GrowthFunnelSection({
  funnel,
}: {
  funnel: Payload["growthFunnel"];
}) {
  return (
    <Section
      title="Growth Funnel"
      subtitle="Visitors → Trials → Installed → Activated → Paid, with stage-to-stage conversion."
    >
      <div className="grid gap-2 lg:grid-cols-5">
        {funnel.stages.map((s, i) => (
          <FunnelStageCard key={s.key} stage={s} index={i} />
        ))}
      </div>
      {!funnel.visitorsAvailable ? (
        <p className="mt-3 text-xs text-slate-500">
          Visitors is a placeholder — PostHog events are captured client-side and no
          server-side read is wired up yet. Integration point documented in
          <span className="font-mono"> src/lib/admin/growth-funnel.ts</span> and the API
          route.
        </p>
      ) : null}
    </Section>
  );
}

// ---- At Risk Trials --------------------------------------------------------

const RISK_META: Record<RiskLevel, { label: string; cls: string }> = {
  critical: { label: "🔴 Critical", cls: "bg-rose-100 text-rose-700" },
  warning: { label: "🟠 Warning", cls: "bg-amber-100 text-amber-700" },
  attention: { label: "🟡 Attention", cls: "bg-yellow-100 text-yellow-700" },
};

function AtRiskSection({ atRisk }: { atRisk: Payload["atRisk"] }) {
  const total = atRisk.all.length;
  const subtitle = `${atRisk.critical.length} critical · ${atRisk.warning.length} warning · ${atRisk.attention.length} attention`;
  return (
    <Section
      title={`At Risk Trials${total > 0 ? ` (${total})` : ""}`}
      subtitle={subtitle}
      accent={atRisk.critical.length > 0 ? "danger" : undefined}
    >
      {total === 0 ? (
        <p className="text-sm text-muted">No trials are currently at risk.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 font-medium">Clinic</th>
                <th className="py-2 pr-4 font-medium">Trial age</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 font-medium">Recommended next action</th>
              </tr>
            </thead>
            <tbody>
              {atRisk.all.map((r) => {
                const meta = RISK_META[r.status];
                return (
                  <tr key={r.id} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-4 font-medium text-slate-900">{r.name}</td>
                    <td className="py-2 pr-4 text-slate-600 whitespace-nowrap">
                      {r.trialAgeDays} day{r.trialAgeDays === 1 ? "" : "s"}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${meta.cls}`}
                      >
                        {meta.label}
                      </span>
                    </td>
                    <td className="py-2 text-slate-600">{r.action}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function ActionCard({
  title,
  items,
  unit,
  href,
}: {
  title: string;
  items: ActionItem[];
  unit: string;
  href: string;
}) {
  const [open, setOpen] = useState(false);
  const count = items.length;
  return (
    <div
      className={`rounded-xl border p-4 ${
        count > 0 ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-slate-50"
      }`}
    >
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <p
        className={`mt-1 text-2xl font-semibold ${
          count > 0 ? "text-rose-700" : "text-slate-700"
        }`}
      >
        {count}
      </p>
      <p className="text-xs text-slate-600">
        {count === 1 ? `1 ${unit}` : `${count} ${unit}s`}
      </p>
      <div className="mt-2 flex items-center gap-3 text-xs">
        <a href={href} className="font-medium text-brand-strong hover:underline">
          View
        </a>
        {count > 0 ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="text-slate-500 hover:underline"
          >
            {open ? "Hide" : "List"}
          </button>
        ) : null}
      </div>
      {open && count > 0 ? (
        <ul className="mt-2 space-y-1 text-xs text-slate-700">
          {items.slice(0, 10).map((i) => (
            <li key={i.id} className="truncate">
              • {i.name}
            </li>
          ))}
          {count > 10 ? <li className="text-slate-500">+{count - 10} more</li> : null}
        </ul>
      ) : null}
    </div>
  );
}

const HEALTH_META: Record<HealthStatus, { label: string; cls: string }> = {
  healthy: { label: "🟢 Healthy", cls: "bg-emerald-100 text-emerald-700" },
  attention: { label: "🟡 Attention", cls: "bg-amber-100 text-amber-700" },
  critical: { label: "🔴 Critical", cls: "bg-rose-100 text-rose-700" },
};

function ClinicRow({ c, hideTestEnquiries }: { c: ClinicView; hideTestEnquiries: boolean }) {
  const [showTimeline, setShowTimeline] = useState(false);
  const meta = HEALTH_META[c.health.status];
  const pct = Math.round((c.progress.completed / c.progress.total) * 100);
  const enquiriesShown = hideTestEnquiries ? c.realEnquiries : c.totalEnquiries;

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.cls}`}>
              {meta.label}
            </span>
            {c.isDemo ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                demo/test
              </span>
            ) : null}
          </div>
          <p className="mt-1 truncate font-medium text-slate-900">{c.name}</p>
          <p className="truncate text-xs text-slate-500">{c.domain || c.email || "—"}</p>
        </div>

        <div className="text-right text-xs">
          <p className="font-medium text-slate-700">
            {c.widget.live ? "🟢 Live" : "⚪ Offline"}
          </p>
          <p className="text-slate-500">Last seen: {relativeTime(c.widget.lastSeenAt)}</p>
          {c.widget.lastSeenDomain ? (
            <p className="truncate text-slate-500">on {c.widget.lastSeenDomain}</p>
          ) : null}
        </div>
      </div>

      {/* Onboarding progress */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-slate-600">
            {c.progress.completed} / {c.progress.total} Complete
          </span>
          <span className="text-slate-500">{enquiriesShown} enquiries</span>
        </div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        {c.progress.nextStep ? (
          <p className="mt-1 text-xs text-slate-600">
            Next step: <span className="font-medium">{c.progress.nextStep}</span>
          </p>
        ) : (
          <p className="mt-1 text-xs text-emerald-700">All steps complete</p>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowTimeline((s) => !s)}
        className="mt-2 text-xs text-slate-500 hover:underline"
      >
        {showTimeline ? "Hide timeline" : "Timeline"}
      </button>
      {showTimeline ? (
        <ol className="mt-2 space-y-1 border-l border-slate-200 pl-3 text-xs text-slate-600">
          {c.timeline.length === 0 ? (
            <li className="text-slate-400">No activity recorded.</li>
          ) : (
            c.timeline.map((e, i) => (
              <li key={i}>
                <span className="font-medium text-slate-700">{e.label}</span>{" "}
                <span className="text-slate-400">— {relativeTime(e.at)}</span>
              </li>
            ))
          )}
        </ol>
      ) : null}
    </div>
  );
}

export default function CommandCentre() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Production filters (visibility only — never deletes data).
  const [productionOnly, setProductionOnly] = useState(true);
  const [hideDemo, setHideDemo] = useState(true);
  const [hideTestClinics, setHideTestClinics] = useState(true);
  const [hideTestEnquiries, setHideTestEnquiries] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/command-centre");
        const body = (await res.json()) as Payload;
        if (cancelled) return;
        if (!res.ok || !body.ok) {
          setError("Could not load the Command Centre.");
        } else {
          setData(body);
        }
      } catch {
        if (!cancelled) setError("Could not load the Command Centre.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleClinics = useMemo(() => {
    if (!data) return [];
    const hideDemoEffective = productionOnly || hideDemo || hideTestClinics;
    return data.clinics.filter((c) => (hideDemoEffective ? !c.isDemo : true));
  }, [data, productionOnly, hideDemo, hideTestClinics]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-muted">
        Loading Command Centre…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
        {error || "Command Centre unavailable."}
      </div>
    );
  }

  const { actionRequired: ar, founderMetrics: fm, thisWeek: tw, pipeline: pl } = data;
  const actionTotal =
    ar.widgetNotInstalled.length +
    ar.testLeadNotCompleted.length +
    ar.trialsExpiringSoon.length +
    ar.brokenAccounts.length;

  const healthCounts = visibleClinics.reduce(
    (acc, c) => {
      acc[c.health.status] += 1;
      return acc;
    },
    { healthy: 0, attention: 0, critical: 0 } as Record<HealthStatus, number>,
  );

  return (
    <div className="space-y-6">
      {/* Founder Inbox — top priority actions for today */}
      <FounderInboxSection inbox={data.founderInbox} />

      {/* Founder Funnel Dashboard — Growth Funnel */}
      <GrowthFunnelSection funnel={data.growthFunnel} />

      {/* Founder Funnel Dashboard — At Risk Trials */}
      <AtRiskSection atRisk={data.atRisk} />

      {/* PART 1 — Action Required */}
      <Section
        title={`🚨 Action Required${actionTotal > 0 ? ` (${actionTotal})` : ""}`}
        subtitle="What needs a human eye right now."
        accent="danger"
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ActionCard
            title="Widget Not Installed"
            items={ar.widgetNotInstalled}
            unit="clinic needs widget installation"
            href="#clinic-management"
          />
          <ActionCard
            title="Test Lead Not Completed"
            items={ar.testLeadNotCompleted}
            unit="clinic needs test lead verification"
            href="#clinic-management"
          />
          <ActionCard
            title="Trials Expiring Soon"
            items={ar.trialsExpiringSoon}
            unit="trial expiring this week"
            href="#clinic-management"
          />
          <ActionCard
            title="Broken Accounts"
            items={ar.brokenAccounts}
            unit="account requires review"
            href="#clinic-management"
          />
        </div>
      </Section>

      {/* PHASE 2 — Revenue Pipeline (above Founder Dashboard) */}
      <RevenuePipelineSection rp={data.revenuePipeline} />

      {/* PART 2 — Founder Dashboard */}
      <Section title="Founder Dashboard" subtitle="Key business metrics at a glance.">
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Customers
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Metric label="Active Paid Customers" value={fm.customers.activePaid} />
              <Metric label="Active Trials" value={fm.customers.activeTrials} />
              <Metric label="Total Clinics" value={fm.customers.totalClinics} />
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Revenue
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Metric label="MRR" value={gbp(fm.revenue.mrr)} hint="Active paid plans" />
              <Metric label="ARR" value={gbp(fm.revenue.arr)} />
              <Metric
                label="Trial → Paid"
                value={`${fm.revenue.trialToPaidPct}%`}
                hint="Current paid vs paid+trialing"
              />
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Usage
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Metric label="Total Enquiries" value={fm.usage.totalEnquiries} />
              <Metric label="Enquiries (30 days)" value={fm.usage.enquiriesLast30Days} />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Live widget counts moved to the Widget Health section below.
            </p>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Lead Generation
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Metric
                label="Scraper Leads Imported"
                value={fm.leadGeneration.scraperLeadsImported}
              />
              <Metric
                label="Leads Awaiting Contact"
                value={fm.leadGeneration.leadsAwaitingContact}
              />
            </div>
          </div>
        </div>
      </Section>

      {/* PHASE 5 — Widget Health */}
      <WidgetHealthSection wh={data.widgetHealth} />

      {/* PHASE 3 — Onboarding Blockers */}
      <OnboardingBlockersSection blockers={data.onboardingBlockers} />

      {/* PHASE 4 — Production Customers */}
      <ProductionCustomersSection clinics={data.clinics} />

      {/* PART 9 — This Week */}
      <Section title="This Week" subtitle="Last 7 days." defaultOpen={false}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="New Trials" value={`+${tw.newTrials}`} />
          <Metric label="New Customers" value={`+${tw.newCustomers}`} />
          <Metric label="Leads Imported" value={`+${tw.leadsImported}`} />
          <Metric label="Enquiries Captured" value={`+${tw.enquiriesCaptured}`} />
        </div>
      </Section>

      {/* PART 8 — Lead Pipeline summary */}
      <Section title="Lead Pipeline" subtitle={`${pl.total} leads`} defaultOpen={false}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {[
            ["New", pl.new],
            ["Contacted", pl.contacted],
            ["Interested", pl.interested],
            ["Demo Booked", pl.demoBooked],
            ["Won", pl.won],
            ["Lost", pl.lost],
          ].map(([label, value]) => (
            <div
              key={label as string}
              className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center"
            >
              <p className="text-lg font-semibold text-foreground">{value}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* PART 3/4/6/7 — Customer Health + Production filter */}
      <Section
        title="Customer Health"
        subtitle={`${healthCounts.healthy} healthy · ${healthCounts.attention} attention · ${healthCounts.critical} critical`}
      >
        <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={productionOnly}
              onChange={(e) => setProductionOnly(e.target.checked)}
            />
            Production Only
          </label>
          <label className="flex items-center gap-2 text-slate-600">
            <input
              type="checkbox"
              checked={hideDemo}
              onChange={(e) => setHideDemo(e.target.checked)}
            />
            Hide Demo Data
          </label>
          <label className="flex items-center gap-2 text-slate-600">
            <input
              type="checkbox"
              checked={hideTestClinics}
              onChange={(e) => setHideTestClinics(e.target.checked)}
            />
            Hide Test Clinics
          </label>
          <label className="flex items-center gap-2 text-slate-600">
            <input
              type="checkbox"
              checked={hideTestEnquiries}
              onChange={(e) => setHideTestEnquiries(e.target.checked)}
            />
            Hide Test Enquiries
          </label>
          <span className="text-xs text-slate-400">
            Filters change visibility only — no data is deleted.
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {visibleClinics.length === 0 ? (
            <p className="text-sm text-muted">No clinics match the current filters.</p>
          ) : (
            visibleClinics.map((c) => (
              <ClinicRow key={c.id} c={c} hideTestEnquiries={hideTestEnquiries} />
            ))
          )}
        </div>
      </Section>
    </div>
  );
}
