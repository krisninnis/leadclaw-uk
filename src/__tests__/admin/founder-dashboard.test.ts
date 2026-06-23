import { describe, it, expect } from "@jest/globals";
import {
  assembleClinics,
  widgetSeenBucket,
  computeWidgetHealth,
  computeOnboardingBlockers,
  monthlyPriceFor,
  isExcludedFromProduction,
  type RawClient,
  type RawSite,
  type RawToken,
  type RawSubscription,
  type RawEnquiry,
} from "@/lib/admin/command-centre";
import { computeRevenuePipeline } from "@/lib/admin/growth-funnel";

const NOW = Date.parse("2026-06-21T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const MIN = 60 * 1000;
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();

function build(o: {
  clients?: RawClient[];
  sites?: RawSite[];
  tokens?: RawToken[];
  subscriptions?: RawSubscription[];
  enquiries?: RawEnquiry[];
}) {
  return assembleClinics({
    clients: o.clients ?? [],
    sites: o.sites ?? [],
    tokens: o.tokens ?? [],
    subscriptions: o.subscriptions ?? [],
    enquiries: o.enquiries ?? [],
  });
}

// Compact builder: one clinic with controllable signals.
let seq = 0;
function makeClinic(opts: {
  name?: string;
  email?: string;
  domain?: string | null;
  hasSite?: boolean;
  clinicLinked?: boolean;
  tokenActive?: boolean;
  lastSeenMsAgo?: number | null;
  subStatus?: string | null;
  plan?: string;
  enquiries?: number;
}) {
  seq += 1;
  const id = `c${seq}`;
  const clinicId = `clinic${seq}`;
  const email = opts.email ?? `owner${seq}@clinic${seq}.co.uk`;
  const domain = opts.domain === undefined ? `clinic${seq}.co.uk` : opts.domain;

  const clients: RawClient[] = [
    {
      id,
      client_name: opts.name ?? `Clinic ${seq}`,
      business_name: opts.name ?? `Clinic ${seq}`,
      contact_email: email,
      status: "complete",
      created_at: iso(30 * DAY),
      notify_channels: ["email"],
    },
  ];

  const sites: RawSite[] = [];
  const tokens: RawToken[] = [];
  const enquiries: RawEnquiry[] = [];

  if (opts.hasSite !== false) {
    sites.push({
      id: `s${seq}`,
      onboarding_client_id: id,
      domain,
      platform: "wordpress",
      settings: { completed: true },
      status: "installed",
      clinic_id: opts.clinicLinked === false ? null : clinicId,
      created_at: iso(30 * DAY),
    });

    if (opts.tokenActive || opts.lastSeenMsAgo != null) {
      tokens.push({
        id: `t${seq}`,
        onboarding_site_id: `s${seq}`,
        token: `tok${seq}`,
        status: opts.tokenActive === false ? "revoked" : "active",
        last_seen_at: opts.lastSeenMsAgo == null ? null : iso(opts.lastSeenMsAgo),
        last_seen_domain: opts.lastSeenMsAgo == null ? null : domain,
        created_at: iso(30 * DAY),
      });
    }

    for (let i = 0; i < (opts.enquiries ?? 0); i++) {
      enquiries.push({
        id: `e${seq}_${i}`,
        clinic_id: clinicId,
        name: "Patient",
        service: "Checkup",
        status: "new",
        created_at: iso((i + 1) * DAY),
      });
    }
  }

  const subscriptions: RawSubscription[] =
    opts.subStatus === null
      ? []
      : [
          {
            id: `sub${seq}`,
            email,
            plan: opts.plan ?? "growth",
            status: opts.subStatus ?? "trialing",
            trial_end: iso(-5 * DAY),
            current_period_end: iso(-5 * DAY),
            created_at: iso(30 * DAY),
            updated_at: iso(1 * DAY),
          },
        ];

  return { clients, sites, tokens, subscriptions, enquiries };
}

function merge(...parts: ReturnType<typeof makeClinic>[]) {
  return build({
    clients: parts.flatMap((p) => p.clients),
    sites: parts.flatMap((p) => p.sites),
    tokens: parts.flatMap((p) => p.tokens),
    subscriptions: parts.flatMap((p) => p.subscriptions),
    enquiries: parts.flatMap((p) => p.enquiries),
  });
}

describe("widgetSeenBucket (Phase 5)", () => {
  it("buckets by recency and handles never/no-widget", () => {
    expect(widgetSeenBucket(iso(5 * MIN), NOW, true)).toBe("live");
    expect(widgetSeenBucket(iso(3 * 60 * MIN), NOW, true)).toBe("today");
    expect(widgetSeenBucket(iso(30 * 60 * MIN), NOW, true)).toBe("stale");
    expect(widgetSeenBucket(null, NOW, true)).toBe("never"); // token, never pinged
    expect(widgetSeenBucket(null, NOW, false)).toBeNull(); // no widget at all
  });
});

describe("computeWidgetHealth (Phase 5)", () => {
  it("counts buckets; 24h total includes the last-15-min subset", () => {
    const clinics = merge(
      makeClinic({ tokenActive: true, lastSeenMsAgo: 5 * MIN }), // live
      makeClinic({ tokenActive: true, lastSeenMsAgo: 3 * 60 * MIN }), // today
      makeClinic({ tokenActive: true, lastSeenMsAgo: 30 * 60 * MIN }), // stale
      makeClinic({ tokenActive: true, lastSeenMsAgo: null }), // never seen
      makeClinic({ tokenActive: false, lastSeenMsAgo: null }), // no widget -> excluded
    );
    const wh = computeWidgetHealth(clinics, NOW);
    expect(wh.seenLast15Min).toBe(1);
    expect(wh.seenLast24Hours).toBe(2); // live + today
    expect(wh.seenEarlier).toBe(1);
    expect(wh.neverSeen).toBe(1);
    expect(wh.totalWithWidget).toBe(4);
  });
});

describe("monthlyPriceFor (Phase 4)", () => {
  it("prices only ACTIVE paid subscriptions", () => {
    const [growth] = merge(makeClinic({ subStatus: "active", plan: "growth" }));
    const [pro] = merge(makeClinic({ subStatus: "active", plan: "pro" }));
    const [trialing] = merge(makeClinic({ subStatus: "trialing", plan: "growth" }));
    const [basic] = merge(makeClinic({ subStatus: "active", plan: "basic" }));
    expect(monthlyPriceFor(growth)).toBe(79);
    expect(monthlyPriceFor(pro)).toBe(149);
    expect(monthlyPriceFor(trialing)).toBe(0);
    expect(monthlyPriceFor(basic)).toBe(0);
  });
});

describe("isExcludedFromProduction (Phase 4)", () => {
  it("excludes demo, internal LeadClaw, and test domains; keeps real clinics", () => {
    const [demo] = merge(makeClinic({ name: "LeadClaw Demo Clinic", email: "demo@example.com" }));
    const [internalDomain] = merge(makeClinic({ name: "LeadClaw Site", domain: "www.leadclaw.uk", email: "a@x.co.uk" }));
    const [internalEmail] = merge(makeClinic({ name: "Founder", domain: "foo.co.uk", email: "founder@leadclaw.uk" }));
    const [real] = merge(makeClinic({ name: "Bright Dental", domain: "brightdental.co.uk", email: "owner@brightdental.co.uk" }));

    expect(isExcludedFromProduction(demo)).toBe(true);
    expect(isExcludedFromProduction(internalDomain)).toBe(true);
    expect(isExcludedFromProduction(internalEmail)).toBe(true);
    expect(isExcludedFromProduction(real)).toBe(false);
    // www.leadclaw.uk is internal but not a "demo/test" clinic per isDemoClinic.
    expect(internalDomain.isDemo).toBe(false);
  });
});

describe("computeOnboardingBlockers (Phase 3)", () => {
  it("returns one most-severe blocker per clinic, sorted, excluding healthy + demo", () => {
    const clinics = merge(
      makeClinic({ name: "NoSite", hasSite: false }), // broken_onboarding 60
      makeClinic({ name: "NoClinic", clinicLinked: false, tokenActive: true, lastSeenMsAgo: 5 * MIN }), // no_clinic_linked 50
      makeClinic({ name: "NoDomain", domain: null, tokenActive: true, lastSeenMsAgo: 5 * MIN, enquiries: 1 }), // missing_domain 40
      makeClinic({ name: "NoWidget", tokenActive: false, lastSeenMsAgo: null }), // no_widget 30
      makeClinic({ name: "NoSub", tokenActive: true, lastSeenMsAgo: 5 * MIN, subStatus: null, enquiries: 1 }), // missing_subscription 20
      makeClinic({ name: "NoEnquiry", tokenActive: true, lastSeenMsAgo: 5 * MIN, subStatus: "active", enquiries: 0 }), // no_enquiry 10
      makeClinic({ name: "Healthy", tokenActive: true, lastSeenMsAgo: 5 * MIN, subStatus: "active", enquiries: 3 }), // none
      makeClinic({ name: "LeadClaw Demo", email: "demo@example.com", hasSite: false }), // demo -> excluded
    );
    const blockers = computeOnboardingBlockers(clinics);
    const codes = blockers.map((b) => b.code);

    expect(codes).toEqual([
      "broken_onboarding",
      "no_clinic_linked",
      "missing_domain",
      "no_widget",
      "missing_subscription",
      "no_enquiry",
    ]);
    expect(blockers.map((b) => b.name)).not.toContain("Healthy");
    expect(blockers.map((b) => b.name)).not.toContain("LeadClaw Demo");
    // each carries a recommended action
    expect(blockers.every((b) => b.action.length > 0)).toBe(true);
  });
});

describe("computeRevenuePipeline (Phase 2)", () => {
  it("counts trials/activated/paying and conversions, excluding demo", () => {
    const clinics = merge(
      makeClinic({ tokenActive: true, lastSeenMsAgo: 5 * MIN, enquiries: 2, subStatus: "active", plan: "growth" }), // activated + paying
      makeClinic({ tokenActive: true, lastSeenMsAgo: 5 * MIN, enquiries: 1, subStatus: "trialing" }), // activated, not paying
      makeClinic({ tokenActive: false, lastSeenMsAgo: null, subStatus: "trialing" }), // trial, not activated
      makeClinic({ name: "LeadClaw Demo", email: "demo@example.com", tokenActive: true, lastSeenMsAgo: 5 * MIN, enquiries: 5 }), // demo excluded
    );
    const rp = computeRevenuePipeline(clinics);
    expect(rp.trialsStarted).toBe(3); // demo excluded
    expect(rp.activatedTrials).toBe(2);
    expect(rp.payingCustomers).toBe(1);
    expect(rp.trialToActivatedPct).toBe(67); // 2/3
    expect(rp.activatedToPaidPct).toBe(50); // 1/2
  });
});
