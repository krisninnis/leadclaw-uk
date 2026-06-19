import { describe, expect, it, jest } from "@jest/globals";
import type { Ratelimit } from "@upstash/ratelimit";
import {
  checkRateLimitStrict,
  getPublicAuditClientIp,
} from "@/lib/rate-limit";

function request(headers: Record<string, string>) {
  return new Request("https://leadclaw.uk/api/audit/public", { headers });
}

describe("public audit client IP", () => {
  it("prefers Vercel's protected forwarded header", () => {
    expect(
      getPublicAuditClientIp(
        request({
          "x-vercel-forwarded-for": "6.6.6.6, 198.51.100.22",
          "x-forwarded-for": "1.1.1.1, 203.0.113.55",
          "x-real-ip": "192.0.2.9",
        }),
      ),
    ).toBe("198.51.100.22");
  });

  it("uses the right-most valid XFF hop rather than a spoofed left-most value", () => {
    expect(
      getPublicAuditClientIp(
        request({ "x-forwarded-for": "6.6.6.6, 203.0.113.55" }),
      ),
    ).toBe("203.0.113.55");
  });

  it("ignores malformed forwarded values", () => {
    expect(
      getPublicAuditClientIp(
        request({
          "x-vercel-forwarded-for": "attacker-controlled",
          "x-real-ip": "203.0.113.77",
        }),
      ),
    ).toBe("203.0.113.77");
  });
});

describe("strict public audit limiter", () => {
  it("fails closed when the limiter throws", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const limiter = {
      limit: jest.fn(async () => {
        throw new Error("redis unavailable");
      }),
    } as unknown as Ratelimit;

    await expect(checkRateLimitStrict(limiter, "203.0.113.10")).resolves.toBe(
      false,
    );
    expect(errorSpy).toHaveBeenCalledWith(
      "[rate-limit] limiter unavailable, failing closed",
      expect.any(Error),
    );
    errorSpy.mockRestore();
  });
});
