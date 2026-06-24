import { describe, it, expect } from "@jest/globals";
import { normalisePhoneNumber, isValidE164 } from "@/lib/telephony/phone";

describe("normalisePhoneNumber", () => {
  it("normalises UK national (trunk 0) numbers to E.164", () => {
    expect(normalisePhoneNumber("07700 900123")).toBe("+447700900123");
    expect(normalisePhoneNumber("0117 496 0000")).toBe("+441174960000");
    expect(normalisePhoneNumber("(0117) 496-0000")).toBe("+441174960000");
  });

  it("keeps already-international numbers", () => {
    expect(normalisePhoneNumber("+44 7700 900123")).toBe("+447700900123");
    expect(normalisePhoneNumber("+1 (415) 867-5309")).toBe("+14158675309");
  });

  it("handles the 00 international access prefix", () => {
    expect(normalisePhoneNumber("0044 7700 900123")).toBe("+447700900123");
  });

  it("handles a country code with no plus", () => {
    expect(normalisePhoneNumber("447700900123")).toBe("+447700900123");
  });

  it("returns null for empty / anonymous / withheld callers", () => {
    expect(normalisePhoneNumber("")).toBeNull();
    expect(normalisePhoneNumber(null)).toBeNull();
    expect(normalisePhoneNumber(undefined)).toBeNull();
    expect(normalisePhoneNumber("Anonymous")).toBeNull();
    expect(normalisePhoneNumber("unavailable")).toBeNull();
    expect(normalisePhoneNumber("restricted")).toBeNull();
  });

  it("rejects junk that is too short", () => {
    expect(normalisePhoneNumber("123")).toBeNull();
    expect(normalisePhoneNumber("abc")).toBeNull();
  });

  it("respects a custom default calling code", () => {
    expect(normalisePhoneNumber("0123456789", "1")).toBe("+1123456789");
  });
});

describe("isValidE164", () => {
  it("accepts valid E.164", () => {
    expect(isValidE164("+447700900123")).toBe(true);
  });
  it("rejects invalid", () => {
    expect(isValidE164("07700900123")).toBe(false);
    expect(isValidE164("")).toBe(false);
    expect(isValidE164(null)).toBe(false);
  });
});
