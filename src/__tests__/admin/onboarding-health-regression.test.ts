import { describe, it, expect } from "@jest/globals";
import {
  assembleClinics,
  classifyHealth,
  onboardingProgress,
  computeActionRequired,
  type RawClient,
  type RawSite,
  type RawToken,
  type RawSubscription,
  type RawEnquiry,
} from "@/lib/admin/command-centre";
import {
  isActivated,
  isWidgetInstalled,
  computeAtRiskTrials,
} from "@/lib/admin/growth-funnel";

// Regression coverage for the Command Centre onboarding-health false positives.
//
// Root cause: assembleClinics used to derive widget status, clinic_id, and
// enquiry counts from ONLY the newest onboarding_site. A client with more than
// one site (e.g. a `test.leadclaw.uk` fallback site from provisioning plus the
// real-domain site) had its verified widget token and captured enquiries on a
// SIBLING site, so the dashboard reported false "widget not installed" /
// "test lead not completed" / "broken account". Secondary: the "test lead"
// milestone required the canonical "LeadClaw Test Enquiry" marker, so
// human-named test/real leads never satisfied it.

const NOW = Date.parse("2026-06-21T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
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

describe("multi-site join: token + enquiries live on an older sibling site", () => {
  // Production scenario: widget token last_seen 2026-03-16, domain
  // www.leadclaw.uk — but on the OLDER site; the newest site is a bare
  // real-domain stub with no token and no enquiries.
  const client: RawClient = {
    id: "c1",
    client_name: "Bright Dental",
    business_name: "Bright Dental Ltd",
    contact_email: "owner@brightdental.co.uk",
    status: "complete",
    created_at: iso(120 * DAY),
    notify_channels: ["email"],
  };
  const oldSite: RawSite = {
    id: "s_old",
    onboarding_client_id: "c1",
    domain: "test.leadclaw.uk",
    platform: "custom",
    settings: {},
    status: "installed",
    clinic_id: "clinic_old",
    created_at: iso(120 * DAY), // older
  };
  const newSite: RawSite = {
    id: "s_new",
    onboarding_client_id: "c1",
    domain: "www.brightdental.co.uk",
    platform: "wordpress",
    settings: { completed: true },
    status: "installed",
    clinic_id: "clinic_new",
    created_at: iso(10 * DAY), // newest -> chosen for display previously
  };
  // Verified token lives on the OLDER site.
  const token: RawToken = {
    id: "t1",
    onboarding_site_id: "s_old",
    token: "tok1",
    status: "active",
    last_seen_at: "2026-03-16T09:00:00.000Z",
    last_seen_domain: "www.leadclaw.uk",
    created_at: iso(120 * DAY),
  };
  const sub: RawSubscription = {
    id: "sub1",
    email: "owner@brightdental.co.uk",
    plan: "growth",
    status: "active",
    trial_end: null,
    current_period_end: iso(-20 * DAY),
    created_at: iso(120 * DAY),
    updated_at: iso(2 * DAY),
  };
  // Real enquiries are attached to the OLDER site's clinic_id.
  const enquiries: RawEnquiry[] = [
    { id: "e1", clinic_id: "clinic_old", name: "Jane Patient", service: "Checkup", status: "new", created_at: iso(5 * DAY) },
    { id: "e2", clinic_id: "clinic_old", name: "Test Lead", service: "Whitening", status: "new", created_at: iso(4 * DAY) },
  ];

  const [c] = build({
    clients: [client],
    sites: [newSite, oldSite],
    tokens: [token],
    subscriptions: [sub],
    enquiries,
  });

  it("reports widget installed from the sibling-site token", () => {
    expect(c.widgetLastSeenAt).toBe("2026-03-16T09:00:00.000Z");
    expect(c.widgetLastSeenDomain).toBe("www.leadclaw.uk");
    expect(c.widgetTokenActive).toBe(true);
    expect(isWidgetInstalled(c)).toBe(true);
  });

  it("counts enquiries from the sibling-site clinic_id", () => {
    expect(c.totalEnquiries).toBe(2);
  });

  it("is not flagged as broken / widget-missing / test-lead-incomplete", () => {
    const health = classifyHealth(c, NOW);
    expect(health.reasons).not.toContain("widget_missing");
    expect(health.reasons).not.toContain("inconsistent_state");

    const ar = computeActionRequired([c], NOW);
    expect(ar.widgetNotInstalled.map((i) => i.id)).not.toContain("c1");
    expect(ar.testLeadNotCompleted.map((i) => i.id)).not.toContain("c1");
    expect(ar.brokenAccounts.map((i) => i.id)).not.toContain("c1");
  });

  it("marks onboarding widget + test-lead steps complete", () => {
    const p = onboardingProgress(c);
    const byLabel = Object.fromEntries(p.steps.map((s) => [s.label, s.done]));
    expect(byLabel["Widget Installed"]).toBe(true);
    expect(byLabel["Test Lead Received"]).toBe(true);
  });
});

describe("test-lead milestone is satisfied by ANY captured lead", () => {
  // Single site, widget live, only human-named enquiries (no canonical marker).
  const client: RawClient = {
    id: "c2",
    client_name: "Smile Clinic",
    business_name: "Smile Clinic",
    contact_email: "owner@smile.co.uk",
    status: "complete",
    created_at: iso(30 * DAY),
    notify_channels: ["email"],
  };
  const site: RawSite = {
    id: "s2",
    onboarding_client_id: "c2",
    domain: "smile.co.uk",
    platform: "wordpress",
    settings: { completed: true },
    status: "installed",
    clinic_id: "clinic2",
    created_at: iso(30 * DAY),
  };
  const token: RawToken = {
    id: "t2",
    onboarding_site_id: "s2",
    token: "tok2",
    status: "active",
    last_seen_at: iso(5 * 60 * 1000),
    last_seen_domain: "smile.co.uk",
    created_at: iso(30 * DAY),
  };
  const sub: RawSubscription = {
    id: "sub2",
    email: "owner@smile.co.uk",
    plan: "growth",
    status: "trialing",
    trial_end: iso(-3 * DAY),
    current_period_end: iso(-3 * DAY),
    created_at: iso(30 * DAY),
    updated_at: iso(30 * DAY),
  };
  const names = ["Test Lead", "Test User", "Production Test Lead Email", "Test Lead Debug", "Test Demo Patient"];
  const enquiries: RawEnquiry[] = names.map((n, i) => ({
    id: `e${i}`,
    clinic_id: "clinic2",
    name: n,
    service: "General",
    status: "new",
    created_at: iso((i + 1) * DAY),
  }));

  const [c] = build({ clients: [client], sites: [site], tokens: [token], subscriptions: [sub], enquiries });

  it("counts these as real enquiries (no canonical marker)", () => {
    expect(c.totalEnquiries).toBe(5);
    expect(c.testEnquiries).toBe(0);
    expect(c.realEnquiries).toBe(5);
  });

  it("does not flag Test Lead Not Completed and counts as Activated", () => {
    const ar = computeActionRequired([c], NOW);
    expect(ar.testLeadNotCompleted.map((i) => i.id)).not.toContain("c2");
    expect(isActivated(c)).toBe(true);
  });

  it("is not surfaced as an At Risk trial", () => {
    const risk = computeAtRiskTrials([c], NOW);
    expect(risk.all.map((r) => r.id)).not.toContain("c2");
  });
});

describe("genuine problems are still flagged (no functionality removed)", () => {
  const base: RawClient = {
    id: "x",
    client_name: "X",
    business_name: "X Clinic",
    contact_email: "x@x.co.uk",
    status: "in_progress",
    created_at: iso(20 * DAY),
    notify_channels: [],
  };

  it("installed trial with zero captured leads -> At Risk warning", () => {
    const site: RawSite = {
      id: "sx", onboarding_client_id: "x", domain: "x.co.uk", platform: "wordpress",
      settings: {}, status: "installed", clinic_id: "clinicx", created_at: iso(20 * DAY),
    };
    const token: RawToken = {
      id: "tx", onboarding_site_id: "sx", token: "tokx", status: "active",
      last_seen_at: iso(5 * 60 * 1000), last_seen_domain: "x.co.uk", created_at: iso(20 * DAY),
    };
    const sub: RawSubscription = {
      id: "subx", email: "x@x.co.uk", plan: "growth", status: "trialing",
      trial_end: iso(-2 * DAY), current_period_end: iso(-2 * DAY), created_at: iso(20 * DAY), updated_at: iso(20 * DAY),
    };
    const [c] = build({ clients: [base], sites: [site], tokens: [token], subscriptions: [sub], enquiries: [] });
    const risk = computeAtRiskTrials([c], NOW);
    expect(risk.warning.map((r) => r.id)).toContain("x");
    expect(computeActionRequired([c], NOW).testLeadNotCompleted.map((i) => i.id)).toContain("x");
  });

  it("old trial that never installed a widget -> At Risk critical + widget-missing", () => {
    const site: RawSite = {
      id: "sx2", onboarding_client_id: "x", domain: "x.co.uk", platform: "wordpress",
      settings: {}, status: "pending_install", clinic_id: "clinicx", created_at: iso(20 * DAY),
    };
    const [c] = build({ clients: [base], sites: [site], tokens: [], subscriptions: [], enquiries: [] });
    expect(isWidgetInstalled(c)).toBe(false);
    expect(classifyHealth(c, NOW).reasons).toContain("widget_missing");
    expect(computeAtRiskTrials([c], NOW).critical.map((r) => r.id)).toContain("x");
  });
});
