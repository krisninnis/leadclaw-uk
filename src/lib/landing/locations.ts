// ClawLabsLocal — Landing Page Builder (UX improvement)
// Static location catalogues for the Landing Page Builder inputs. These power
// the country / region / city dropdowns in the structured editor. Everything
// here is plain data + pure helpers (no DB / network / AI), so the editor stays
// deterministic and the lists are fully unit-testable.
//
// IMPORTANT: these are *convenience defaults* only. Admins can always type a
// custom region/city, and the values are stored exactly as the landing page
// system already expects (country is the ISO code, e.g. "GB"; region/city are
// free-text strings). Nothing here changes validation or the stored shape.

export type LandingCountry = {
  code: string; // ISO-3166 alpha-2 — stored value (matches existing "GB" default)
  label: string;
};

// MVP country set. GB is first and is the default.
export const LANDING_COUNTRIES: LandingCountry[] = [
  { code: "GB", label: "United Kingdom" },
  { code: "IE", label: "Ireland" },
  { code: "US", label: "United States" },
  { code: "CA", label: "Canada" },
  { code: "AU", label: "Australia" },
];

export const DEFAULT_COUNTRY = "GB";

// Sentinel used by the editor's <select> to switch a field into manual entry.
export const CUSTOM_OPTION = "__custom__";

// Regions per country. GB is the full planning-doc list; the others are short,
// useful starter lists. Any country can also fall back to a manual "Other"
// entry in the UI, so these need not be exhaustive.
export const LANDING_REGIONS: Record<string, string[]> = {
  GB: [
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
  ],
  IE: [
    "Leinster",
    "Munster",
    "Connacht",
    "Ulster",
  ],
  US: [
    "California",
    "Texas",
    "Florida",
    "New York",
    "Illinois",
    "Pennsylvania",
    "Ohio",
    "Georgia",
    "Washington",
    "Massachusetts",
  ],
  CA: [
    "Ontario",
    "Quebec",
    "British Columbia",
    "Alberta",
    "Manitoba",
    "Saskatchewan",
    "Nova Scotia",
    "New Brunswick",
  ],
  AU: [
    "New South Wales",
    "Victoria",
    "Queensland",
    "Western Australia",
    "South Australia",
    "Tasmania",
    "Australian Capital Territory",
    "Northern Territory",
  ],
};

// Common cities per country. Starter lists only — admins can always type a
// custom city that is not listed.
export const LANDING_CITIES: Record<string, string[]> = {
  GB: [
    "London",
    "Birmingham",
    "Manchester",
    "Leeds",
    "Liverpool",
    "Bristol",
    "Nottingham",
    "Leicester",
    "Sheffield",
    "Newcastle",
    "Coventry",
    "Derby",
    "Cardiff",
    "Edinburgh",
    "Glasgow",
    "Belfast",
    "Southampton",
    "Cambridge",
    "Oxford",
    "York",
  ],
  IE: [
    "Dublin",
    "Cork",
    "Limerick",
    "Galway",
    "Waterford",
  ],
  US: [
    "New York",
    "Los Angeles",
    "Chicago",
    "Houston",
    "Phoenix",
    "Philadelphia",
    "San Antonio",
    "San Diego",
    "Dallas",
    "Austin",
  ],
  CA: [
    "Toronto",
    "Montreal",
    "Vancouver",
    "Calgary",
    "Edmonton",
    "Ottawa",
    "Winnipeg",
    "Halifax",
  ],
  AU: [
    "Sydney",
    "Melbourne",
    "Brisbane",
    "Perth",
    "Adelaide",
    "Gold Coast",
    "Canberra",
    "Newcastle",
  ],
};

export function isKnownCountry(code: string | null | undefined): boolean {
  if (!code) return false;
  return LANDING_COUNTRIES.some((c) => c.code === code);
}

export function getCountryLabel(code: string | null | undefined): string {
  const match = LANDING_COUNTRIES.find((c) => c.code === code);
  return match ? match.label : code || "";
}

// Region options for a country. Unknown countries return an empty list (the UI
// still offers the manual "Other" fallback).
export function getRegionsForCountry(code: string | null | undefined): string[] {
  if (!code) return [];
  return LANDING_REGIONS[code] ?? [];
}

// City options for a country. Unknown countries return an empty list (the UI
// still offers the "Custom city" fallback).
export function getCitiesForCountry(code: string | null | undefined): string[] {
  if (!code) return [];
  return LANDING_CITIES[code] ?? [];
}
