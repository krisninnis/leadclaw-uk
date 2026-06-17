const {
  buildLeadFinderArgs,
  defaultLeadFinderConfig,
  parseLeadFinderConfig,
  parseLeadFinderStdout,
} = require("@/lib/lead-finder");

describe("Lead Finder helpers", () => {
  it("normalizes config input for the scraper CLI", () => {
    const config = parseLeadFinderConfig({
      niche_mode: "custom",
      niches: "plumber electrician",
      locations: "Coventry, Birmingham",
      limit: "12",
      discover_emails: true,
      email_discovery_max_pages: "7",
      dry_run: true,
    });

    expect(config).toEqual(
      expect.objectContaining({
        niche_mode: "custom",
        niches: ["plumber", "electrician"],
        locations: ["Coventry", "Birmingham"],
        limit: 12,
        email_discovery_max_pages: 7,
        dry_run: true,
      }),
    );
  });

  it("rejects custom mode without custom niches", () => {
    expect(() =>
      parseLeadFinderConfig({
        niche_mode: "custom",
        locations: "Coventry",
      }),
    ).toThrow("Custom mode requires at least one niche.");
  });

  it("builds a safe dry-run command without outreach flags", () => {
    const args = buildLeadFinderArgs({
      ...defaultLeadFinderConfig(),
      niche_mode: "custom",
      niches: ["plumber"],
      locations: ["London"],
      limit: 2,
      discover_emails: true,
      email_discovery_max_pages: 7,
      dry_run: true,
    });

    expect(args).toEqual(
      expect.arrayContaining([
        "--limit",
        "2",
        "--niche-mode",
        "custom",
        "--locations",
        "London",
        "--niches",
        "plumber",
        "--discover-emails",
        "--email-discovery-max-pages",
        "7",
        "--dry-run",
      ]),
    );
    expect(args).not.toContain("--live");
    expect(args).not.toContain("--send-outreach");
  });

  it("parses JSON-line scraper output into an admin summary", () => {
    const stdout = [
      JSON.stringify({
        event: "scraper_discovery_complete",
        discovered: 3,
        skipped: 1,
      }),
      JSON.stringify({ event: "email_discovery_email_found" }),
      JSON.stringify({ event: "email_discovery_email_found" }),
      JSON.stringify({
        event: "scraper_import_complete",
        discovered: 3,
        skipped: 1,
        result: { would_import: 2, skipped: 1 },
      }),
    ].join("\n");

    expect(parseLeadFinderStdout(stdout)).toEqual({
      discovered: 3,
      imported: null,
      would_import: 2,
      skipped: 2,
      emails_found: 2,
      errors: [],
    });
  });
});
