import { describe, expect, it, jest } from "@jest/globals";
import {
  assertPublicAuditTarget,
  fetchSite,
  normalizeAuditUrl,
  UrlValidationError,
  type AuditDnsLookup,
} from "@/lib/audit/fetch-site";

describe("public audit SSRF protection", () => {
  it.each([
    "http://localhost",
    "http://localhost.",
    "http://127.0.0.1",
    "http://10.1.2.3",
    "http://172.16.0.1",
    "http://172.31.255.255",
    "http://192.168.1.1",
    "http://[::1]",
    "http://[fc00::1]",
    "http://printer.internal",
    "http://router.lan",
    "http://intranet",
  ])("rejects internal target %s", (target) => {
    expect(() => normalizeAuditUrl(target)).toThrow(UrlValidationError);
  });

  it("rejects a public hostname when DNS resolves to a private address", async () => {
    const lookup: AuditDnsLookup = async () => [
      { address: "192.168.20.5", family: 4 },
    ];

    await expect(
      assertPublicAuditTarget("https://audit.example.com", lookup),
    ).rejects.toThrow("Private IP addresses cannot be audited");
  });

  it("rejects a hostname if any DNS answer is private", async () => {
    const lookup: AuditDnsLookup = async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.2", family: 4 },
    ];

    await expect(
      assertPublicAuditTarget("https://audit.example.com", lookup),
    ).rejects.toThrow(UrlValidationError);
  });

  it("revalidates redirects and never fetches a private redirect target", async () => {
    const lookup: AuditDnsLookup = async () => [
      { address: "93.184.216.34", family: 4 },
    ];
    const fetchImpl = jest.fn(async () =>
      new Response("", {
        status: 302,
        headers: { location: "http://127.0.0.1/admin" },
      }),
    ) as unknown as typeof fetch;

    await expect(
      fetchSite("https://audit.example.com", { lookup, fetchImpl }),
    ).rejects.toThrow(UrlValidationError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
