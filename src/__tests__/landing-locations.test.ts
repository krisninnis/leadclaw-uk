// ClawLabsLocal — Landing Page Builder (UX improvement)
// Pure data/helpers for the country / region / city dropdowns. No DB / network.

import { describe, it, expect } from "@jest/globals";
import {
  DEFAULT_COUNTRY,
  LANDING_COUNTRIES,
  LANDING_REGIONS,
  LANDING_CITIES,
  getCitiesForCountry,
  getRegionsForCountry,
  getCountryLabel,
  isKnownCountry,
} from "@/lib/landing/locations";

describe("country catalogue", () => {
  it("defaults to GB and lists the five MVP countries", () => {
    expect(DEFAULT_COUNTRY).toBe("GB");
    expect(LANDING_COUNTRIES.map((c) => c.code)).toEqual([
      "GB",
      "IE",
      "US",
      "CA",
      "AU",
    ]);
    // GB is first so it is the natural default in the dropdown.
    expect(LANDING_COUNTRIES[0].code).toBe("GB");
    expect(getCountryLabel("GB")).toBe("United Kingdom");
  });

  it("recognises known and unknown country codes", () => {
    expect(isKnownCountry("GB")).toBe(true);
    expect(isKnownCountry("ZZ")).toBe(false);
    expect(isKnownCountry(null)).toBe(false);
  });
});

describe("region options", () => {
  it("returns the full GB region list", () => {
    const gb = getRegionsForCountry("GB");
    expect(gb).toEqual(LANDING_REGIONS.GB);
    for (const expected of [
      "England",
      "Scotland",
      "Wales",
      "Northern Ireland",
      "East Midlands",
      "West Midlands",
      "North West",
      "North East",
      "Yorkshire and the Humber",
      "South East",
      "South West",
      "East of England",
      "London",
    ]) {
      expect(gb).toContain(expected);
    }
  });

  it("changing country changes the region options", () => {
    const gb = getRegionsForCountry("GB");
    const us = getRegionsForCountry("US");
    expect(us.length).toBeGreaterThan(0);
    expect(us).not.toEqual(gb);
    expect(us).toContain("California");
  });

  it("returns an empty list for an unknown country", () => {
    expect(getRegionsForCountry("ZZ")).toEqual([]);
    expect(getRegionsForCountry(null)).toEqual([]);
  });
});

describe("city options", () => {
  it("returns a useful GB starter list", () => {
    const gb = getCitiesForCountry("GB");
    expect(gb).toEqual(LANDING_CITIES.GB);
    for (const expected of [
      "London",
      "Birmingham",
      "Manchester",
      "Nottingham",
      "Cardiff",
      "Edinburgh",
      "Belfast",
      "York",
    ]) {
      expect(gb).toContain(expected);
    }
  });

  it("changing country changes the city options", () => {
    const gb = getCitiesForCountry("GB");
    const au = getCitiesForCountry("AU");
    expect(au.length).toBeGreaterThan(0);
    expect(au).not.toEqual(gb);
    expect(au).toContain("Sydney");
  });

  it("returns an empty list for an unknown country", () => {
    expect(getCitiesForCountry("ZZ")).toEqual([]);
    expect(getCitiesForCountry(undefined)).toEqual([]);
  });
});
