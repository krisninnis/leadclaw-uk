import { describe, expect, it, jest } from "@jest/globals";
import {
  assertPublicAuditTarget,
  fetchSite,
  normalizeAuditUrl,
  UrlValidationError,
  type AuditDnsLookup,
  type AuditPinnedRequest,
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
    const requestImpl = jest.fn(async () =>
      new Response("", {
        status: 302,
        headers: { location: "http://127.0.0.1/admin" },
      }),
    ) as unknown as AuditPinnedRequest;

    await expect(
      fetchSite("https://audit.example.com", { lookup, requestImpl }),
    ).rejects.toThrow(UrlValidationError);
    expect(requestImpl).toHaveBeenCalledTimes(1);
  });

  it("pins the validated DNS address into the outbound request", async () => {
    const lookup = jest.fn(async () => [
      { address: "93.184.216.34", family: 4 },
    ]) as unknown as AuditDnsLookup;
    const requestImpl = jest.fn(async () => new Response("<html>ok</html>")) as
      unknown as AuditPinnedRequest;

    await expect(
      fetchSite("https://audit.example.com", { lookup, requestImpl }),
    ).resolves.toMatchObject({ ok: true, finalUrl: "https://audit.example.com" });

    expect(lookup).toHaveBeenCalledTimes(1);
    expect(requestImpl).toHaveBeenCalledTimes(1);
    expect(requestImpl).toHaveBeenCalledWith(
      expect.objectContaining({
        address: "93.184.216.34",
        family: 4,
        url: expect.objectContaining({ hostname: "audit.example.com" }),
      }),
      expect.objectContaining({ method: "GET" }),
    );
  });

  it.each([22, 3306, 6379, 8080])("rejects non-web port %s", (port) => {
    expect(() => normalizeAuditUrl(`https://example.com:${port}`)).toThrow(
      "Only the standard website ports 80 and 443 can be audited",
    );
  });

  it.each([
    "https://example.com",
    "https://example.com:443",
    "https://example.com:80",
    "http://example.com:80",
  ])("allows the default web ports for %s", (target) => {
    expect(() => normalizeAuditUrl(target)).not.toThrow();
  });
});
