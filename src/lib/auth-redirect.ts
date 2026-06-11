const REDIRECT_BASE = "https://leadclaw.local";

export function normalizeAuthRedirectPath(
  value: string | null | undefined,
  fallback = "/portal",
) {
  const next = String(value || "").trim();

  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return fallback;
  }

  try {
    const parsed = new URL(next, REDIRECT_BASE);

    if (parsed.origin !== REDIRECT_BASE) {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
