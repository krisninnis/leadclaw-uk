import { describe, it, expect } from "@jest/globals";
import {
  assembleClinics,
  computeFounderInbox,
  founderInboxTier,
  TEST_ENQUIRY_NAME,
  type RawClient,
  type RawSite,
  type RawToken,
  type RawSubscription,
  type RawEnquiry,
} from "@/lib/admin/command-centre";

const NOW = Date.parse("2026-06-21T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const MIN = 60 * 1000;
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();

let seq = 0;

// Build a single assembled ClinicRecord with precise control over each signal
// the Founder Inbox scores against.
function mk(opts: {
  name?: string;
  hasSite?: boolean;
  clinicLinked?: boolean; // default true
  subStatus?: string | null; // null = no subscription row
  plan?: string;
  tokenActive?: boolean;
  lastSeenMsAgo?: number | null; // null = never seen
  realEnq?: number;
  testEnq?: number;
  createdDaysAgo?: number;
  trialEndInDays?: number | null; // future = +days
  notifications?: boolean; // default true
  demo?: boolean;
}): ReturnType<typeof assembleClinics>[number] {
  seq += 1;
  const id = `c${seq}`;
  const clinicId = `clinic${seq}`;
  const email = opts.demo ? `demo${seq}@example.com` : `o${seq}@clinic${seq}.co.uk`;
  const name = opts.name ?? (opts.demo ? "LeadClaw Demo" : `Clinic ${seq}`);

  const clients: RawClient[] = [
    {
      id,
      client_name: name,
      business_name: name,
      contact_email: email,
      status: "complete",
      created_at: iso((opts.createdDaysAgo ?? 30) * DAY),
      notify_channels: opts.notifications === false ? [] : ["email"],
    },
  ];

  const sites: RawSite[] = [];
  const tokens: RawToken[] = [];
  const enquiries: RawEnquiry[] = [];

  if (opts.hasSite !== false) {
    sites.push({
      id: `s${seq}`,
      onboarding_client_id: id,
      domain: opts.demo ? `demo${seq}.example.com` : `clinic${seq}.co.uk`,
      platform: "wordpress",
      settings: { completed: true },
      status: "installed",
      clinic_id: opts.clinicLinked === false ? null : clinicId,
      created_at: iso((opts.createdDaysAgo ?? 30) * DAY),
    });

    if (opts.tokenActive || opts.lastSeenMsAgo != null) {
      tokens.push({
        id: `t${seq}`,
        onboarding_site_id: `s${seq}`,
        token: `tok${seq}`,
        status: opts.tokenActive === false ? "revoked" : "active",
        last_seen_at: opts.lastSeenMsAgo == null ? null : iso(opts.lastSeenMsAgo),
        last_seen_domain: opts.lastSeenMsAgo == null ? null : `clinic${seq}.co.uk`,
        created_at: iso((opts.createdDaysAgo ?? 30) * DAY),
      });
    }

    for (let i = 0; i < (opts.realEnq ?? 0); i++) {
      enquiries.push({
        id: `re${seq}_${i}`,
        clinic_id: clinicId,
        name: "Real Patient",
        service: "Checkup",
        status: "new",
        created_at: iso((i + 1) * DAY),
      });
    }
    for (let i = 0; i < (opts.testEnq ?? 0); i++) {
      enquiries.push({
        id: `te${seq}_${i}`,
        clinic_id: clinicId,
        name: TEST_ENQUIRY_NAME,
        service: null,
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
            trial_end:
              opts.trialEndInDays == null ? null : iso(-opts.trialEndInDays * DAY),
            current_period_end: iso(-5 * DAY),
            created_at: iso((opts.createdDaysAgo ?? 30) * DAY),
            updated_at: iso(1 * DAY),
          },
        ];

  const [record] = assembleClinics({
    clients,
    sites,
    tokens,
    subscriptions,
    enquiries,
  });
  return record;
}

function inboxFor(record: ReturnType<typeof mk>) {
  return computeFounderInbox([record], NOW).items[0] ?? null;
}

describe("founderInboxTier mapping", () => {
  it("maps scores to the spec example tiers", () => {
    expect(founderInboxTier(100)).toBe("critical");
    expect(founderInboxTier(90)).toBe("critical");
    expect(founderInboxTier(80)).toBe("critical");
    expect(founderInboxTier(70)).toBe("high");
    expect(founderInboxTier(60)).toBe("medium");
    expect(founderInboxTier(20)).toBe("medium");
  });
});

describe("computeFounderInbox — per-rule scoring", () => {
  it("100 broken account (no subscription record)", () => {
    const item = inboxFor(mk({ subStatus: null, tokenActive: true, lastSeenMsAgo: 5 * MIN }));
    expect(item?.score).toBe(100);
    expect(item?.code).toBe("broken_account");
    expect(item?.tier).toBe("critical");
  });

  it("100 broken account (clinic not linked)", () => {
    const item = inboxFor(mk({ clinicLinked: false, subStatus: "active", plan: "growth" }));
    expect(item?.score).toBe(100);
  });

  it("90 paid customer, widget never installed", () => {
    const item = inboxFor(mk({ subStatus: "active", plan: "growth", tokenActive: false, lastSeenMsAgo: null }));
    expect(item?.score).toBe(90);
    expect(item?.code).toBe("paid_no_widget");
  });

  it("80 trial older than 7 days, widget not installed", () => {
    const item = inboxFor(
      mk({ subStatus: "trialing", createdDaysAgo: 11, tokenActive: false, lastSeenMsAgo: null }),
    );
    expect(item?.score).toBe(80);
    expect(item?.tier).toBe("critical");
    expect(item?.status).toContain("11 days");
  });

  it("70 widget installed, no enquiry captured", () => {
    const item = inboxFor(
      mk({ subStatus: "trialing", createdDaysAgo: 3, tokenActive: true, lastSeenMsAgo: 5 * MIN, realEnq: 0 }),
    );
    expect(item?.score).toBe(70);
    expect(item?.tier).toBe("high");
  });

  it("60 activated, no real enquiry (only a test lead)", () => {
    const item = inboxFor(
      mk({ subStatus: "active", plan: "growth", tokenActive: true, lastSeenMsAgo: 5 * MIN, realEnq: 0, testEnq: 1 }),
    );
    expect(item?.score).toBe(60);
    expect(item?.tier).toBe("medium");
  });

  it("50 subscription past due", () => {
    const item = inboxFor(
      mk({ subStatus: "past_due", tokenActive: true, lastSeenMsAgo: 5 * MIN, realEnq: 2 }),
    );
    expect(item?.score).toBe(50);
    expect(item?.code).toBe("subscription_past_due");
  });

  it("40 trial expires within 3 days", () => {
    const item = inboxFor(
      mk({ subStatus: "trialing", createdDaysAgo: 4, tokenActive: true, lastSeenMsAgo: 5 * MIN, realEnq: 1, trialEndInDays: 2 }),
    );
    expect(item?.score).toBe(40);
    expect(item?.status).toContain("2 days");
  });

  it("30 widget offline more than 7 days", () => {
    const item = inboxFor(
      mk({ subStatus: "active", plan: "growth", tokenActive: true, lastSeenMsAgo: 10 * DAY, realEnq: 2 }),
    );
    expect(item?.score).toBe(30);
    expect(item?.code).toBe("widget_offline");
  });

  it("20 no notification settings configured", () => {
    const item = inboxFor(
      mk({ subStatus: "active", plan: "growth", tokenActive: true, lastSeenMsAgo: 5 * MIN, realEnq: 2, notifications: false }),
    );
    expect(item?.score).toBe(20);
    expect(item?.code).toBe("no_notifications");
  });
});

describe("computeFounderInbox — ordering, exclusions, empty state", () => {
  it("sorts by priority descending and counts tiers", () => {
    const clinics = [
      mk({ subStatus: "active", plan: "growth", tokenActive: true, lastSeenMsAgo: 5 * MIN, realEnq: 2, notifications: false }), // 20
      mk({ subStatus: null, tokenActive: true, lastSeenMsAgo: 5 * MIN }), // 100
      mk({ subStatus: "trialing", createdDaysAgo: 3, tokenActive: true, lastSeenMsAgo: 5 * MIN, realEnq: 0 }), // 70
      mk({ subStatus: "active", plan: "growth", tokenActive: false, lastSeenMsAgo: null }), // 90
    ];
    const inbox = computeFounderInbox(clinics, NOW);
    expect(inbox.items.map((i) => i.score)).toEqual([100, 90, 70, 20]);
    expect(inbox.counts.all).toBe(4);
    expect(inbox.counts.critical).toBe(2); // 100 + 90
    expect(inbox.counts.high).toBe(1); // 70
    expect(inbox.counts.medium).toBe(1); // 20
  });

  it("excludes demo clinics", () => {
    const inbox = computeFounderInbox(
      [mk({ demo: true, subStatus: null })],
      NOW,
    );
    expect(inbox.items).toHaveLength(0);
  });

  it("empty state: a fully healthy clinic produces no inbox item", () => {
    const healthy = mk({
      subStatus: "active",
      plan: "growth",
      tokenActive: true,
      lastSeenMsAgo: 5 * MIN,
      realEnq: 3,
      notifications: true,
    });
    const inbox = computeFounderInbox([healthy], NOW);
    expect(inbox.items).toHaveLength(0);
    expect(inbox.counts.all).toBe(0);
  });
});
