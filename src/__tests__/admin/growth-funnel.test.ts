import { describe, it, expect } from "@jest/globals";
import {
  assembleClinics,
  TEST_ENQUIRY_NAME,
  type RawClient,
  type RawSite,
  type RawToken,
  type RawSubscription,
  type RawEnquiry,
} from "@/lib/admin/command-centre";
import {
  computeGrowthFunnel,
  computeAtRiskTrials,
  isWidgetInstalled,
  isActivated,
  isPaidCustomer,
} from "@/lib/admin/growth-funnel";

const NOW = Date.parse("2026-06-21T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();

function build(overrides: {
  clients?: RawClient[];
  sites?: RawSite[];
  tokens?: RawToken[];
  subscriptions?: RawSubscription[];
  enquiries?: RawEnquiry[];
}) {
  return assembleClinics({
    clients: overrides.clients ?? [],
    sites: overrides.sites ?? [],
    tokens: overrides.tokens ?? [],
    subscriptions: overrides.subscriptions ?? [],
    enquiries: overrides.enquiries ?? [],
  });
}

// Factory helpers to spin up a clinic at a chosen funnel depth.
let seq = 0;
function clinic(
  depth: "trial" | "installed" | "activated" | "paid",
  opts: {
    ageDays?: number;
    demo?: boolean;
    realEnquiries?: number;
    name?: string;
  } = {},
) {
  seq += 1;
  const id = `c${seq}`;
  const email = `owner${seq}@clinic${seq}.co.uk`;
  const ageMs = (opts.ageDays ?? 30) * DAY;
  const clinicId = `clinic${seq}`;

  const clients: RawClient[] = [
    {
      id,
      client_name: opts.name ?? `Clinic ${seq}`,
      business_name: opts.demo ? "LeadClaw Demo Clinic" : (opts.name ?? `Clinic ${seq}`),
      contact_email: opts.demo ? `demo${seq}@example.com` : email,
      status: "complete",
      created_at: iso(ageMs),
      notify_channels: ["email"],
    },
  ];
  const sites: RawSite[] = [
    {
      id: `s${seq}`,
      onboarding_client_id: id,
      domain: opts.demo ? `demo${seq}.example.com` : `clinic${seq}.co.uk`,
      platform: "wordpress",
      settings: { completed: true },
      status: "live",
      clinic_id: clinicId,
      created_at: iso(ageMs),
    },
  ];

  const installed = depth !== "trial";
  const tokens: RawToken[] = installed
    ? [
        {
          id: `t${seq}`,
          onboarding_site_id: `s${seq}`,
          token: `tok${seq}`,
          status: "active",
          last_seen_at: iso(5 * 60 * 1000),
          last_seen_domain: `clinic${seq}.co.uk`,
          created_at: iso(ageMs),
        },
      ]
    : [];

  const enquiries: RawEnquiry[] = [];
  if (depth === "activated" || depth === "paid") {
    enquiries.push({
      id: `te${seq}`,
      clinic_id: clinicId,
      name: TEST_ENQUIRY_NAME,
      service: null,
      status: "new",
      created_at: iso(ageMs),
    });
  }
  for (let i = 0; i < (opts.realEnquiries ?? 0); i++) {
    enquiries.push({
      id: `re${seq}_${i}`,
      clinic_id: clinicId,
      name: "Real Patient",
      service: "Checkup",
      status: "new",
      created_at: iso(1 * DAY),
    });
  }

  const subscriptions: RawSubscription[] =
    depth === "paid"
      ? [
          {
            id: `sub${seq}`,
            email,
            plan: "growth",
            status: "active",
            trial_end: null,
            current_period_end: iso(-20 * DAY),
            created_at: iso(ageMs),
            updated_at: iso(1 * DAY),
          },
        ]
      : [
          {
            id: `sub${seq}`,
            email,
            plan: "growth",
            status: "trialing",
            trial_end: iso(-5 * DAY),
            current_period_end: iso(-5 * DAY),
            created_at: iso(ageMs),
            updated_at: iso(ageMs),
          },
        ];

  return { clients, sites, tokens, subscriptions, enquiries };
}

function merge(...parts: ReturnType<typeof clinic>[]) {
  return build({
    clients: parts.flatMap((p) => p.clients),
    sites: parts.flatMap((p) => p.sites),
    tokens: parts.flatMap((p) => p.tokens),
    subscriptions: parts.flatMap((p) => p.subscriptions),
    enquiries: parts.flatMap((p) => p.enquiries),
  });
}

describe("funnel stage predicates", () => {
  it("classifies a clinic at each depth", () => {
    const [trial] = merge(clinic("trial"));
    const [installed] = merge(clinic("installed"));
    const [activated] = merge(clinic("activated"));
    const [paid] = merge(clinic("paid"));

    expect(isWidgetInstalled(trial)).toBe(false);
    expect(isWidgetInstalled(installed)).toBe(true);
    expect(isActivated(installed)).toBe(false);
    expect(isActivated(activated)).toBe(true);
    expect(isPaidCustomer(activated)).toBe(false);
    expect(isPaidCustomer(paid)).toBe(true);
  });
});

describe("computeGrowthFunnel", () => {
  it("counts each stage and excludes demo clinics", () => {
    const clinics = merge(
      clinic("trial"),
      clinic("installed"),
      clinic("activated"),
      clinic("paid", { realEnquiries: 3 }),
      clinic("trial", { demo: true }), // excluded
    );
    const f = computeGrowthFunnel(clinics, null);
    const by = Object.fromEntries(f.stages.map((s) => [s.key, s.count]));

    expect(by.trials).toBe(4); // demo excluded
    expect(by.installed).toBe(3); // installed + activated + paid
    expect(by.activated).toBe(2); // activated + paid
    expect(by.paid).toBe(1);
  });

  it("leaves Visitors as a placeholder when PostHog is unavailable", () => {
    const f = computeGrowthFunnel(merge(clinic("trial")), null);
    const visitors = f.stages.find((s) => s.key === "visitors")!;
    expect(visitors.count).toBeNull();
    expect(f.visitorsAvailable).toBe(false);
    // Visitors->Trials conversion cannot be computed without visitors.
    expect(f.stages.find((s) => s.key === "trials")!.conversionFromPrevPct).toBeNull();
  });

  it("computes conversion percentages between stages", () => {
    const clinics = merge(
      clinic("installed"),
      clinic("installed"),
      clinic("activated"),
      clinic("paid", { realEnquiries: 2 }),
    );
    const f = computeGrowthFunnel(clinics, 200);
    const by = Object.fromEntries(
      f.stages.map((s) => [s.key, s.conversionFromPrevPct]),
    );
    // 4 trials / 200 visitors = 2%
    expect(by.trials).toBe(2);
    // installed 4 / trials 4 = 100%
    expect(by.installed).toBe(100);
    // activated 2 / installed 4 = 50%
    expect(by.activated).toBe(50);
    // paid 1 / activated 2 = 50%
    expect(by.paid).toBe(50);
  });
});

describe("computeAtRiskTrials", () => {
  it("buckets critical / warning / attention and excludes demo + paid", () => {
    const clinics = merge(
      clinic("trial", { ageDays: 10 }), // critical: old + no widget
      clinic("trial", { ageDays: 2 }), // not at risk: too young
      clinic("installed"), // warning: installed, no test enquiry
      clinic("activated", { realEnquiries: 0 }), // attention: activated, no real leads
      clinic("activated", { realEnquiries: 5 }), // healthy: has real leads
      clinic("paid", { realEnquiries: 0 }), // excluded: paid customer
      clinic("trial", { ageDays: 20, demo: true }), // excluded: demo
    );
    const r = computeAtRiskTrials(clinics, NOW);

    expect(r.critical).toHaveLength(1);
    expect(r.warning).toHaveLength(1);
    expect(r.attention).toHaveLength(1);
    expect(r.all).toHaveLength(3);
    // most urgent first
    expect(r.all[0].status).toBe("critical");
    expect(r.critical[0].trialAgeDays).toBe(10);
    expect(r.critical[0].action).toMatch(/install/i);
  });

  it("does not flag a young trial without a widget", () => {
    const r = computeAtRiskTrials(merge(clinic("trial", { ageDays: 3 })), NOW);
    expect(r.all).toHaveLength(0);
  });
});
