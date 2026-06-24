import { describe, it, expect } from "@jest/globals";
import {
  CONTENT_BACKLOG,
  CLUSTER_PRIORITY,
  totalScore,
  rankOpportunities,
  recommendNextArticle,
  getClusters,
  computeQueueSummary,
  getExistingInventory,
  getExistingSlugSet,
  findDuplicateSlugs,
  summarizeInventory,
  isContentStatus,
  MAX_AXIS,
  MIN_TOTAL,
  type StatusRow,
} from "@/lib/seo/content-engine";

describe("backlog integrity", () => {
  it("contains at least 50 opportunities", () => {
    expect(CONTENT_BACKLOG.length).toBeGreaterThanOrEqual(50);
  });

  it("has unique slugs", () => {
    const slugs = CONTENT_BACKLOG.map((o) => o.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("uses path-safe slugs", () => {
    for (const o of CONTENT_BACKLOG) {
      expect(o.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  it("keeps every axis within 0..10 and total above the quality gate", () => {
    for (const o of CONTENT_BACKLOG) {
      for (const v of [o.scores.commercial, o.scores.seo, o.scores.productFit]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(MAX_AXIS);
      }
      expect(totalScore(o.scores)).toBeGreaterThanOrEqual(MIN_TOTAL);
    }
  });

  it("covers all five priority clusters", () => {
    const clusters = new Set(CONTENT_BACKLOG.map((o) => o.cluster));
    for (const c of ["missed-calls", "ai-receptionists", "dental", "aesthetic-clinics", "trades"]) {
      expect(clusters.has(c as keyof typeof CLUSTER_PRIORITY)).toBe(true);
    }
  });

  it("only links to root-relative internal URLs", () => {
    for (const o of CONTENT_BACKLOG) {
      for (const link of o.internalLinks) {
        expect(link.startsWith("/")).toBe(true);
      }
    }
  });
});

describe("duplicate detection against live registries", () => {
  it("builds an inventory from the published registries", () => {
    const inv = getExistingInventory();
    // 35 ai-receptionist + 10 seo-pages + 4 articles + 3 standalone = 52.
    expect(inv.length).toBeGreaterThanOrEqual(50);
    expect(getExistingSlugSet().size).toBeGreaterThan(40);
  });

  it("contains NO backlog slug that already exists as a published page", () => {
    expect(findDuplicateSlugs()).toEqual([]);
  });

  it("summarises the inventory by funnel stage", () => {
    const s = summarizeInventory();
    expect(s.total).toBe(getExistingInventory().length);
    expect(s.byFunnel.BOFU).toBeGreaterThan(0);
  });
});

describe("scoring model", () => {
  it("totals the three axes (brief example: 10+8+10 = 28)", () => {
    expect(totalScore({ commercial: 10, seo: 8, productFit: 10 })).toBe(28);
  });
});

describe("ranking", () => {
  it("orders highest total first and assigns sequential ranks", () => {
    const ranked = rankOpportunities();
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].total).toBeGreaterThanOrEqual(ranked[i].total);
    }
    expect(ranked[0].rank).toBe(1);
    expect(ranked[ranked.length - 1].rank).toBe(ranked.length);
  });

  it("merges persisted status (default backlog)", () => {
    const rows: StatusRow[] = [
      { slug: CONTENT_BACKLOG[0].slug, status: "published", notes: "live", updated_at: "2026-06-20T00:00:00Z" },
    ];
    const ranked = rankOpportunities(undefined, rows);
    const target = ranked.find((o) => o.slug === CONTENT_BACKLOG[0].slug);
    expect(target?.status).toBe("published");
    const other = ranked.find((o) => o.slug !== CONTENT_BACKLOG[0].slug);
    expect(other?.status).toBe("backlog");
  });

  it("ignores invalid persisted status values", () => {
    const rows: StatusRow[] = [
      { slug: CONTENT_BACKLOG[0].slug, status: "garbage", notes: null, updated_at: null },
    ];
    const ranked = rankOpportunities(undefined, rows);
    expect(ranked.find((o) => o.slug === CONTENT_BACKLOG[0].slug)?.status).toBe("backlog");
  });
});

describe("next article recommendation", () => {
  it("recommends the top-ranked, not-yet-started opportunity", () => {
    const ranked = rankOpportunities();
    const rec = recommendNextArticle();
    expect(rec).not.toBeNull();
    expect(rec!.slug).toBe(ranked[0].slug);
    expect(rec!.total).toBe(ranked[0].total);
    expect(rec!.internalLinksToAdd.length).toBeGreaterThan(0);
    expect(rec!.recommendedCta).toBeTruthy();
  });

  it("skips opportunities already published or in progress", () => {
    const top = rankOpportunities()[0];
    const second = rankOpportunities()[1];
    const rows: StatusRow[] = [
      { slug: top.slug, status: "published", notes: null, updated_at: null },
    ];
    const rec = recommendNextArticle(undefined, rows);
    expect(rec!.slug).not.toBe(top.slug);
    expect(rec!.slug).toBe(second.slug);
  });

  it("returns null when everything is published/in progress", () => {
    const rows: StatusRow[] = CONTENT_BACKLOG.map((o) => ({
      slug: o.slug,
      status: "published",
      notes: null,
      updated_at: null,
    }));
    expect(recommendNextArticle(undefined, rows)).toBeNull();
  });
});

describe("clusters", () => {
  it("returns clusters in priority order with pillars and supporting articles", () => {
    const clusters = getClusters();
    expect(clusters[0].key).toBe("missed-calls");
    expect(clusters.map((c) => c.priority)).toEqual([...clusters.map((c) => c.priority)].sort((a, b) => a - b));
    for (const c of clusters) {
      expect(c.internalLinkingRecommendation.length).toBeGreaterThan(0);
    }
    // Missed-calls reuses the existing landing page as a pillar.
    const missed = clusters.find((c) => c.key === "missed-calls")!;
    expect(missed.pillarPages.some((p) => p.existing)).toBe(true);
    expect(missed.supportingArticles.length).toBeGreaterThan(0);
  });
});

describe("queue summary", () => {
  it("counts statuses and clusters", () => {
    const rows: StatusRow[] = [
      { slug: CONTENT_BACKLOG[0].slug, status: "in_progress", notes: null, updated_at: null },
      { slug: CONTENT_BACKLOG[1].slug, status: "published", notes: null, updated_at: null },
    ];
    const summary = computeQueueSummary(rankOpportunities(undefined, rows));
    expect(summary.totalOpportunities).toBe(CONTENT_BACKLOG.length);
    expect(summary.inProgress).toBe(1);
    expect(summary.published).toBe(1);
    expect(summary.backlog).toBe(CONTENT_BACKLOG.length - 2);
    expect(summary.byCluster.length).toBe(Object.keys(CLUSTER_PRIORITY).length);
  });
});

describe("isContentStatus", () => {
  it("validates the four workflow statuses", () => {
    expect(isContentStatus("planned")).toBe(true);
    expect(isContentStatus("published")).toBe(true);
    expect(isContentStatus("nope")).toBe(false);
    expect(isContentStatus(5)).toBe(false);
  });
});
