import { describe, it, expect } from "@jest/globals";
import {
  assembleClinics,
  classifyHealth,
  onboardingProgress,
  isDemoClinic,
  isTestEnquiry,
  computeActionRequired,
  computeFounderMetrics,
  computePipeline,
  computeThisWeek,
  TEST_ENQUIRY_NAME,
  TEST_ENQUIRY_SERVICE_PREFIX,
  type RawClient,
  type RawSite,
  type RawToken,
  type RawSubscription,
  type RawEnquiry,
  type RawLead,
} from "@/lib/admin/command-centre";

const NOW = Date.parse("2026-06-21T12:00:00.000Z");
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();
const DAY = 24 * 60 * 60 * 1000;

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

const healthyClient: RawClient = {
  id: "c1",
  client_name: "Bright Dental",
  business_name: "Bright Dental Ltd",
  contact_email: "owner@brightdental.co.uk",
  status: "complete",
  created_at: iso(40 * DAY),
  notify_channels: ["email"],
};
const healthySite: RawSite = {
  id: "s1",
  onboarding_client_id: "c1",
  domain: "brightdental.co.uk",
  platform: "wordpress",
  settings: { completed: true, enquiryEmail: "owner@brightdental.co.uk" },
  status: "live",
  clinic_id: "clinic1",
  created_at: iso(39 * DAY),
};
const healthyToken: RawToken = {
  id: "t1",
  onboarding_site_id: "s1",
  token: "tok1",
  status: "active",
  last_seen_at: iso(5 * 60 * 1000), // 5 min ago = live
  last_seen_domain: "brightdental.co.uk",
  created_at: iso(38 * DAY),
};
const healthySub: RawSubscription = {
  id: "sub1",
  email: "owner@brightdental.co.uk",
  plan: "growth",
  status: "active",
  trial_end: null,
  current_period_end: iso(-20 * DAY),
  created_at: iso(38 * DAY),
  updated_at: iso(2 * DAY),
};

describe("isTestEnquiry / isDemoClinic", () => {
  it("detects test enquiries by name or service prefix", () => {
    expect(isTestEnquiry(TEST_ENQUIRY_NAME, null)).toBe(true);
    expect(isTestEnquiry(null, `${TEST_ENQUIRY_SERVICE_PREFIX} install`)).toBe(true);
    expect(isTestEnquiry("Jane Smith", "Teeth whitening")).toBe(false);
  });

  it("detects demo/test clinics from name, email or domain", () => {
    expect(isDemoClinic({ name: "LeadClaw Demo Clinic" })).toBe(true);
    expect(isDemoClinic({ email: "founder@example.com" })).toBe(true);
    expect(isDemoClinic({ domain: "test-clinic.co.uk" })).toBe(true);
    expect(isDemoClinic({ name: "Bright Dental Ltd", domain: "brightdental.co.uk" })).toBe(
      false,
    );
  });
});

describe("classifyHealth", () => {
  it("is healthy when widget installed + onboarding complete + sub active", () => {
    const [c] = build({
      clients: [healthyClient],
      sites: [healthySite],
      tokens: [healthyToken],
      subscriptions: [healthySub],
    });
    expect(classifyHealth(c, NOW).status).toBe("healthy");
  });

  it("is critical when widget is missing", () => {
    const [c] = build({
      clients: [healthyClient],
      sites: [{ ...healthySite }],
      tokens: [],
      subscriptions: [healthySub],
    });
    const res = classifyHealth(c, NOW);
    expect(res.status).toBe("critical");
    expect(res.reasons).toContain("widget_missing");
  });

  it("is critical when subscription is broken", () => {
    const [c] = build({
      clients: [healthyClient],
      sites: [healthySite],
      tokens: [healthyToken],
      subscriptions: [{ ...healthySub, status: "past_due" }],
    });
    expect(classifyHealth(c, NOW).status).toBe("critical");
  });

  it("is attention when onboarding incomplete but widget present + sub active", () => {
    const [c] = build({
      clients: [{ ...healthyClient, status: "in_progress" }],
      sites: [{ ...healthySite, settings: {} }],
      tokens: [healthyToken],
      subscriptions: [healthySub],
    });
    const res = classifyHealth(c, NOW);
    expect(res.status).toBe("attention");
    expect(res.reasons).toContain("onboarding_incomplete");
  });
});

describe("onboardingProgress", () => {
  it("counts steps and surfaces the first missing step", () => {
    const [c] = build({
      clients: [{ ...healthyClient, notify_channels: [] }],
      sites: [{ ...healthySite, settings: {} }],
      tokens: [healthyToken],
      subscriptions: [healthySub],
      enquiries: [], // no test lead yet
    });
    const p = onboardingProgress(c);
    expect(p.total).toBe(6);
    // Trial, Website, Widget done; Test Lead missing -> next step.
    expect(p.nextStep).toBe("Send a test enquiry");
    expect(p.completed).toBeLessThan(6);
  });
});

describe("computeActionRequired", () => {
  it("buckets clinics and ignores demo clinics", () => {
    const demoClient: RawClient = {
      ...healthyClient,
      id: "demo",
      business_name: "LeadClaw Demo Clinic",
      contact_email: "demo@example.com",
    };
    const noWidgetClient: RawClient = {
      ...healthyClient,
      id: "c2",
      business_name: "No Widget Co",
      contact_email: "no@widgetco.co.uk",
    };
    const clinics = build({
      clients: [healthyClient, noWidgetClient, demoClient],
      sites: [
        healthySite,
        { ...healthySite, id: "s2", onboarding_client_id: "c2", clinic_id: "clinic2" },
        { ...healthySite, id: "s3", onboarding_client_id: "demo", clinic_id: "clinic3" },
      ],
      tokens: [healthyToken], // only c1 has a widget
      subscriptions: [healthySub],
    });
    const ar = computeActionRequired(clinics, NOW);
    const ids = ar.widgetNotInstalled.map((i) => i.id);
    expect(ids).toContain("c2");
    expect(ids).not.toContain("demo"); // demo excluded
    expect(ids).not.toContain("c1"); // has widget
  });

  it("flags trials expiring within 7 days", () => {
    const clinics = build({
      clients: [healthyClient],
      sites: [healthySite],
      tokens: [healthyToken],
      subscriptions: [
        { ...healthySub, status: "trialing", trial_end: iso(-3 * DAY) },
      ],
    });
    const ar = computeActionRequired(clinics, NOW);
    expect(ar.trialsExpiringSoon.map((i) => i.id)).toContain("c1");
  });
});

describe("computeFounderMetrics", () => {
  it("computes MRR/ARR from active paid plans and awaiting leads", () => {
    const clinics = build({
      clients: [
        healthyClient,
        { ...healthyClient, id: "c2", contact_email: "pro@x.co.uk" },
      ],
      sites: [
        healthySite,
        { ...healthySite, id: "s2", onboarding_client_id: "c2", clinic_id: "clinic2" },
      ],
      tokens: [healthyToken],
      subscriptions: [
        healthySub, // growth active = 79
        { ...healthySub, id: "sub2", email: "pro@x.co.uk", plan: "pro" }, // pro active = 149
      ],
    });
    const leads: RawLead[] = [
      { id: "l1", status: "new", source: "google", created_at: iso(1 * DAY) },
      { id: "l2", status: "contacted", source: "google", created_at: iso(2 * DAY) },
    ];
    const fm = computeFounderMetrics(clinics, leads, [], NOW);
    expect(fm.revenue.mrr).toBe(228);
    expect(fm.revenue.arr).toBe(228 * 12);
    expect(fm.customers.activePaid).toBe(2);
    expect(fm.leadGeneration.scraperLeadsImported).toBe(2);
    expect(fm.leadGeneration.leadsAwaitingContact).toBe(1);
  });
});

describe("computePipeline", () => {
  it("maps lead statuses into pipeline columns", () => {
    const leads: RawLead[] = [
      { id: "1", status: "new", source: null, created_at: null },
      { id: "2", status: "contacted", source: null, created_at: null },
      { id: "3", status: "replied", source: null, created_at: null },
      { id: "4", status: "interested", source: null, created_at: null },
      { id: "5", status: "won", source: null, created_at: null },
      { id: "6", status: "lost", source: null, created_at: null },
    ];
    const p = computePipeline(leads);
    expect(p.new).toBe(1);
    expect(p.contacted).toBe(2); // contacted + replied
    expect(p.interested).toBe(1);
    expect(p.won).toBe(1);
    expect(p.lost).toBe(1);
    expect(p.total).toBe(6);
  });
});

describe("computeThisWeek", () => {
  it("counts last-7-day activity", () => {
    const clinics = build({
      clients: [
        { ...healthyClient, created_at: iso(2 * DAY) }, // new this week
        { ...healthyClient, id: "old", created_at: iso(40 * DAY) },
      ],
    });
    const leads: RawLead[] = [
      { id: "l1", status: "new", source: null, created_at: iso(1 * DAY) },
      { id: "l2", status: "new", source: null, created_at: iso(20 * DAY) },
    ];
    const enquiries: RawEnquiry[] = [
      { id: "e1", clinic_id: "clinic1", name: "Real", service: "x", status: "new", created_at: iso(1 * DAY) },
      { id: "e2", clinic_id: "clinic1", name: TEST_ENQUIRY_NAME, service: null, status: "new", created_at: iso(1 * DAY) },
    ];
    const tw = computeThisWeek(clinics, leads, enquiries, NOW);
    expect(tw.newTrials).toBe(1);
    expect(tw.leadsImported).toBe(1);
    expect(tw.enquiriesCaptured).toBe(1); // test enquiry excluded
  });
});
