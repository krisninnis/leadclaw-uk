import { describe, it, expect } from "@jest/globals";
import {
  classifyTrade,
  isEligibleCandidate,
  buildCandidates,
  computePilotSummary,
  computeTradeCounts,
  bestLeadScore,
  PILOT_TRADES,
  type RawLeadRow,
  type RawPilotRow,
} from "@/lib/admin/pilot-recruitment";

const NOW = Date.parse("2026-06-24T12:00:00.000Z");

function lead(overrides: Partial<RawLeadRow> = {}): RawLeadRow {
  return {
    id: "lead-default",
    company_name: "Acme Plumbing Ltd",
    niche: "plumber",
    city: "Leeds",
    website: "https://acmeplumbing.co.uk",
    contact_phone: "0113 000 0000",
    contact_email: "owner@acmeplumbing.co.uk",
    status: "new",
    score: 40,
    lead_score: null,
    lead_quality_score: 80,
    has_live_chat: false,
    has_contact_form: false,
    created_at: "2026-06-10T09:00:00.000Z",
    ...overrides,
  };
}

function pilot(overrides: Partial<RawPilotRow> = {}): RawPilotRow {
  return {
    lead_id: "lead-default",
    pilot_status: "candidate",
    pilot_notes: null,
    follow_up_at: null,
    last_contacted_at: null,
    contacted_count: 0,
    interested_at: null,
    pilot_started_at: null,
    converted_customer_at: null,
    updated_at: null,
    ...overrides,
  };
}

describe("classifyTrade", () => {
  it("matches canonical scraper niche slugs", () => {
    expect(classifyTrade("plumber", null)).toBe("plumber");
    expect(classifyTrade("electrician", null)).toBe("electrician");
    expect(classifyTrade("roofer", null)).toBe("roofer");
  });

  it("maps future-compatible trades from their slugs", () => {
    expect(classifyTrade("dental", null)).toBe("dentist");
    expect(classifyTrade("beauty", null)).toBe("aesthetic_clinic");
    expect(classifyTrade("physio", null)).toBe("physiotherapist");
  });

  it("falls back to keywords in niche or company name", () => {
    expect(classifyTrade("local-service", "Top Roofing Contractors")).toBe(
      "roofer",
    );
    expect(classifyTrade(null, "Spark Electrical Services")).toBe("electrician");
  });

  it("returns null for non-target trades", () => {
    expect(classifyTrade("estate_agent", "City Lettings")).toBeNull();
    expect(classifyTrade(null, "Joe's Cafe")).toBeNull();
  });
});

describe("bestLeadScore", () => {
  it("prefers the highest available score field", () => {
    expect(
      bestLeadScore(lead({ score: 10, lead_score: 55, lead_quality_score: 90 })),
    ).toBe(90);
    expect(
      bestLeadScore(lead({ score: 30, lead_score: null, lead_quality_score: null })),
    ).toBe(30);
    expect(
      bestLeadScore(lead({ score: null as unknown as number, lead_score: null, lead_quality_score: null })),
    ).toBe(0);
  });
});

describe("isEligibleCandidate", () => {
  it("accepts a target trade with a phone and identity", () => {
    expect(isEligibleCandidate(lead(), null)).toBe(true);
  });

  it("rejects leads without a phone number", () => {
    expect(isEligibleCandidate(lead({ contact_phone: null }), null)).toBe(false);
    expect(isEligibleCandidate(lead({ contact_phone: "  " }), null)).toBe(false);
  });

  it("rejects non-target trades", () => {
    expect(
      isEligibleCandidate(lead({ niche: "estate_agent", company_name: "ABC Lettings" }), null),
    ).toBe(false);
  });

  it("excludes leads already won/customer in the sales pipeline", () => {
    expect(isEligibleCandidate(lead({ status: "won" }), null)).toBe(false);
    expect(isEligibleCandidate(lead({ status: "customer" }), null)).toBe(false);
  });

  it("excludes leads marked not_fit / pilot / customer in pilot metadata", () => {
    expect(isEligibleCandidate(lead(), pilot({ pilot_status: "not_fit" }))).toBe(false);
    expect(isEligibleCandidate(lead(), pilot({ pilot_status: "pilot" }))).toBe(false);
    expect(isEligibleCandidate(lead(), pilot({ pilot_status: "customer" }))).toBe(false);
  });

  it("still includes contacted / interested / no_response leads", () => {
    expect(isEligibleCandidate(lead(), pilot({ pilot_status: "contacted" }))).toBe(true);
    expect(isEligibleCandidate(lead(), pilot({ pilot_status: "interested" }))).toBe(true);
    expect(isEligibleCandidate(lead(), pilot({ pilot_status: "no_response" }))).toBe(true);
  });

  it("respects a custom trade filter (future trades excluded by default)", () => {
    const dentistLead = lead({ niche: "dental", company_name: "Smile Dental" });
    expect(isEligibleCandidate(dentistLead, null)).toBe(false); // not in PILOT_TRADES
    expect(
      isEligibleCandidate(dentistLead, null, { trades: ["dentist"] }),
    ).toBe(true);
  });
});

describe("buildCandidates ranking & filtering", () => {
  it("ranks a fully-signalled local trade above a bare one", () => {
    const strong = lead({ id: "strong" });
    const weak = lead({
      id: "weak",
      city: null,
      website: null,
      lead_quality_score: null,
      score: null as unknown as number,
      lead_score: null,
      has_live_chat: true,
      has_contact_form: true,
    });
    const ranked = buildCandidates([weak, strong], [], { now: NOW });
    expect(ranked.map((c) => c.leadId)).toEqual(["strong", "weak"]);
    expect(ranked[0].signals).toEqual(
      expect.arrayContaining([
        "trade_business",
        "phone_available",
        "website_available",
        "local_uk_business",
        "no_live_chat",
        "no_online_booking",
      ]),
    );
  });

  it("floats due follow-ups to the top", () => {
    const a = lead({ id: "a" });
    const b = lead({ id: "b" });
    const overdue = pilot({
      lead_id: "b",
      pilot_status: "contacted",
      follow_up_at: "2026-06-20T09:00:00.000Z",
    });
    const ranked = buildCandidates([a, b], [overdue], { now: NOW });
    expect(ranked[0].leadId).toBe("b");
    expect(ranked[0].followUpDue).toBe(true);
    expect(ranked[0].signals).toContain("follow_up_due");
  });

  it("only includes the requested trade when filtered via trade counts", () => {
    const leads = [
      lead({ id: "p", niche: "plumber" }),
      lead({ id: "e", niche: "electrician", company_name: "Volt Electric" }),
      lead({ id: "r", niche: "roofer", company_name: "Peak Roofing" }),
    ];
    const candidates = buildCandidates(leads, [], { now: NOW });
    const counts = computeTradeCounts(candidates);
    expect(counts.find((c) => c.trade === "all")?.count).toBe(3);
    expect(counts.find((c) => c.trade === "plumber")?.count).toBe(1);
    expect(counts.find((c) => c.trade === "electrician")?.count).toBe(1);
    expect(counts.find((c) => c.trade === "roofer")?.count).toBe(1);
    expect(PILOT_TRADES).toEqual(["plumber", "electrician", "roofer"]);
  });
});

describe("computePilotSummary", () => {
  it("counts statuses, new candidates, and due follow-ups", () => {
    const leads = [
      lead({ id: "c1" }),
      lead({ id: "c2" }),
      lead({ id: "i1" }),
      lead({ id: "won1" }),
    ];
    const pilots = [
      pilot({ lead_id: "i1", pilot_status: "interested" }),
      pilot({
        lead_id: "c2",
        pilot_status: "contacted",
        follow_up_at: "2026-06-01T09:00:00.000Z", // overdue
      }),
      pilot({ lead_id: "won1", pilot_status: "customer" }),
    ];
    const summary = computePilotSummary(leads, pilots, NOW);
    // c1 has no pilot row -> defaults to candidate and is a new candidate.
    expect(summary.newCandidates).toBe(1);
    expect(summary.contacted).toBe(1);
    expect(summary.interested).toBe(1);
    expect(summary.customer).toBe(1);
    expect(summary.followUpsDue).toBe(1);
    expect(summary.total).toBe(3);
  });
});
