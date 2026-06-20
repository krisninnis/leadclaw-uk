// V2.1c — regression tests for the audit false-positive fixes:
//  * robots.txt / sitemap.xml resolved against the POST-redirect origin
//  * sitemap presence honours robots.txt "Sitemap:" directives
//  * structured-data detection: array @type, @graph, and microdata
// All pure (no network, no DB).

import { deriveAuxOrigin, declaredSitemapPaths } from "@/lib/audit/run-audit";
import { parseHtml } from "@/lib/audit/parse-html";

describe("deriveAuxOrigin", () => {
  it("falls back to the entered origin when there is no final URL", () => {
    expect(deriveAuxOrigin(null, "https://example.com")).toBe("https://example.com");
  });

  it("uses the post-redirect origin (apex -> www)", () => {
    expect(deriveAuxOrigin("https://www.example.com/", "https://example.com")).toBe(
      "https://www.example.com",
    );
  });

  it("falls back when the final URL is unparseable", () => {
    expect(deriveAuxOrigin("not a url", "https://example.com")).toBe("https://example.com");
  });
});

describe("declaredSitemapPaths", () => {
  it("extracts a same-origin Sitemap: directive as a path", () => {
    const robots = "User-agent: *\nSitemap: https://example.com/sitemap_index.xml\n";
    expect(declaredSitemapPaths(robots, "https://example.com")).toEqual([
      "/sitemap_index.xml",
    ]);
  });

  it("resolves a relative Sitemap: directive against the origin", () => {
    expect(
      declaredSitemapPaths("Sitemap: /custom/sitemap.xml", "https://example.com"),
    ).toEqual(["/custom/sitemap.xml"]);
  });

  it("ignores cross-origin sitemap directives (SSRF-safe)", () => {
    const robots = "Sitemap: https://cdn.other-host.net/s.xml";
    expect(declaredSitemapPaths(robots, "https://example.com")).toEqual([]);
  });

  it("is case-insensitive and de-duplicates", () => {
    const robots = "sitemap: https://example.com/a.xml\nSITEMAP: https://example.com/a.xml";
    expect(declaredSitemapPaths(robots, "https://example.com")).toEqual(["/a.xml"]);
  });

  it("returns nothing for an empty robots body", () => {
    expect(declaredSitemapPaths("", "https://example.com")).toEqual([]);
  });
});

describe("parseHtml structured data", () => {
  const ld = (obj: unknown) =>
    `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;

  it("extracts array-valued @type", () => {
    const s = parseHtml(ld({ "@type": ["LocalBusiness", "Dentist"], name: "X" }), null);
    expect(s.jsonLdTypes).toEqual(expect.arrayContaining(["LocalBusiness", "Dentist"]));
    expect(s.structuredDataCount).toBe(1);
  });

  it("extracts types nested in an @graph wrapper", () => {
    const s = parseHtml(
      ld({ "@context": "https://schema.org", "@graph": [{ "@type": "WebSite" }, { "@type": "Organization" }] }),
      null,
    );
    expect(s.jsonLdTypes).toEqual(expect.arrayContaining(["WebSite", "Organization"]));
  });

  it("detects schema.org microdata when no JSON-LD is present", () => {
    const html = '<div itemscope itemtype="https://schema.org/LocalBusiness"><span>X</span></div>';
    const s = parseHtml(html, null);
    expect(s.microdataTypes).toContain("LocalBusiness");
    expect(s.structuredDataCount).toBeGreaterThanOrEqual(1);
    expect(s.structuredDataTypes).toContain("LocalBusiness");
  });

  it("reports zero structured data on a plain page", () => {
    const s = parseHtml("<html><body><p>hello</p></body></html>", null);
    expect(s.structuredDataCount).toBe(0);
    expect(s.jsonLdTypes).toEqual([]);
    expect(s.microdataTypes).toEqual([]);
  });

  it("falls back to regex when a JSON-LD block is not valid JSON", () => {
    // Trailing comma -> JSON.parse throws -> regex fallback still finds the type.
    const s = parseHtml(
      '<script type="application/ld+json">{ "@type": "Dentist", }</script>',
      null,
    );
    expect(s.jsonLdTypes).toContain("Dentist");
  });
});
