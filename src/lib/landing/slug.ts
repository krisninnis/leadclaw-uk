// ClawLabsLocal — Landing Page Builder (Phase A)
// Slug generation + validation. Slugs are the public URL segment under /lp/.
// Rule (mirrors planning doc §10): lowercase, [a-z0-9] words joined by single
// hyphens, no leading/trailing hyphen.

// A well-formed slug: one or more [a-z0-9] groups joined by single hyphens.
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const MAX_SLUG_LENGTH = 96;

// Turn arbitrary text into a candidate slug. Strips accents, lowercases,
// replaces any run of non-alphanumerics with a single hyphen, and trims
// leading/trailing hyphens. Always returns a SLUG_PATTERN-valid string (or "").
export function slugify(input: string): string {
  return (input || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // drop combining accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, ""); // re-trim if slice landed on a hyphen
}

// Build a slug from the local targeting fields, e.g.
// ("aesthetic-clinic", "Nottingham") -> "aesthetic-clinic-nottingham".
export function generateSlug(
  niche: string | null | undefined,
  city: string | null | undefined,
): string {
  const parts = [niche, city]
    .map((p) => slugify(p || ""))
    .filter(Boolean);
  return slugify(parts.join("-"));
}

export function isValidSlug(slug: string | null | undefined): boolean {
  if (!slug) return false;
  if (slug.length > MAX_SLUG_LENGTH) return false;
  return SLUG_PATTERN.test(slug);
}

// Normalise a user-supplied slug and report whether it was already valid.
// Used by the API to accept an explicit slug or coerce a near-miss.
export function normalizeSlug(input: string | null | undefined): {
  slug: string;
  valid: boolean;
} {
  const raw = (input || "").trim();
  if (isValidSlug(raw)) return { slug: raw, valid: true };
  const coerced = slugify(raw);
  return { slug: coerced, valid: isValidSlug(coerced) };
}
