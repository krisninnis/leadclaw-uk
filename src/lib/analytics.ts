// Canonical PostHog analytics wrapper for LeadClaw.
//
// Fail-silent by design: every function no-ops on the server, when PostHog is
// not loaded (e.g. NEXT_PUBLIC_POSTHOG_KEY is unset), or if posthog-js throws.
// Analytics must never break the app or the build.
//
// Privacy: event properties are scrubbed of sensitive keys (enquiry message
// contents, phone numbers, full personal data) before they are sent. Only the
// allow-listed, low-risk properties documented in the analytics task should be
// passed in (user id, email domain, plan, industry, platform, campaign source,
// route, event name, step number).

import posthog from "posthog-js";

export type AnalyticsEvent =
  // Marketing
  | "page_view"
  | "social_page_view"
  | "social_video_view"
  | "cta_clicked"
  | "pricing_viewed"
  | "free_trial_clicked"
  | "demo_clicked"
  | "free_audit_clicked"
  // Signup
  | "signup_started"
  | "signup_completed"
  | "legal_terms_accepted"
  | "marketing_consent_changed"
  // Onboarding
  | "onboarding_started"
  | "onboarding_step_viewed"
  | "onboarding_website_analyzed"
  | "onboarding_industry_selected"
  | "onboarding_platform_selected"
  | "onboarding_config_saved"
  | "widget_snippet_copied"
  | "widget_detected"
  | "test_enquiry_sent"
  | "onboarding_completed"
  // Product
  | "portal_viewed"
  | "leads_viewed"
  | "ai_readiness_generated"
  | "competitor_benchmark_started"
  | "competitor_benchmark_completed";

export type AnalyticsValue =
  | string
  | number
  | boolean
  | string[]
  | null
  | undefined;

export type AnalyticsProps = Record<string, AnalyticsValue>;

// Property keys that must never reach analytics, regardless of caller intent.
const BLOCKED_PROP_KEYS = new Set([
  "message",
  "enquiry",
  "enquiry_message",
  "body",
  "note",
  "notes",
  "phone",
  "contact_phone",
  "enquiry_phone",
  "tel",
  "email",
  "contact_email",
  "enquiry_email",
  "name",
  "full_name",
  "first_name",
  "last_name",
  "password",
  "address",
]);

function scrub(props: AnalyticsProps): Record<string, string | number | boolean | string[]> {
  const out: Record<string, string | number | boolean | string[]> = {};
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined) continue;
    if (BLOCKED_PROP_KEYS.has(key.toLowerCase())) continue;
    out[key] = value;
  }
  return out;
}

type LoadedPosthog = typeof posthog & { __loaded?: boolean };

// Returns the posthog client only when it is safe to use (browser + loaded).
function client(): LoadedPosthog | null {
  if (typeof window === "undefined") return null;
  const ph = posthog as LoadedPosthog;
  if (!ph.__loaded) return null;
  return ph;
}

/** Capture a funnel event. No-ops silently when analytics is unavailable. */
export function track(event: AnalyticsEvent, props: AnalyticsProps = {}): void {
  try {
    client()?.capture(event, scrub(props));
  } catch {
    /* analytics must never throw */
  }
}

/** Associate subsequent events with an authenticated user id. */
export function identifyAnalyticsUser(userId: string, props: AnalyticsProps = {}): void {
  try {
    client()?.identify(userId, scrub(props));
  } catch {
    /* no-op */
  }
}

/** Clear identity (e.g. on logout). */
export function resetAnalytics(): void {
  try {
    client()?.reset();
  } catch {
    /* no-op */
  }
}

/**
 * Returns just the domain part of an email (allow-listed, safe to send).
 * Never returns or transmits the local part / full address.
 */
export function emailDomain(email?: string | null): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return domain || null;
}

// ---- Attribution ----------------------------------------------------------

const ATTRIBUTION_KEY = "lc_attribution";
const UTM_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

export type Attribution = {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  referrer: string | null;
  landing_page: string | null;
  first_seen_at: string | null;
  current_page: string | null;
};

export function getStoredAttribution(): Attribution | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ATTRIBUTION_KEY);
    return raw ? (JSON.parse(raw) as Attribution) : null;
  } catch {
    return null;
  }
}

/**
 * Capture first-touch attribution (UTM params, referrer, landing page,
 * first_seen_at) and persist it in localStorage. Registers it as PostHog super
 * properties so it attaches to every subsequent event — preserving attribution
 * across signup and onboarding. `current_page` is refreshed on every call.
 *
 * Fail-silent: returns null and does nothing on the server or if storage /
 * posthog are unavailable.
 */
export function captureAttribution(): Attribution | null {
  if (typeof window === "undefined") return null;
  try {
    const url = new URL(window.location.href);
    const stored = getStoredAttribution();
    const currentPage = url.pathname;

    // First-touch wins: keep stored UTM if present, otherwise read from URL.
    const utm: Record<(typeof UTM_PARAMS)[number], string | null> = {
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_content: null,
      utm_term: null,
    };
    for (const key of UTM_PARAMS) {
      utm[key] = stored?.[key] ?? url.searchParams.get(key) ?? null;
    }

    const attribution: Attribution = {
      utm_source: utm.utm_source,
      utm_medium: utm.utm_medium,
      utm_campaign: utm.utm_campaign,
      utm_content: utm.utm_content,
      utm_term: utm.utm_term,
      referrer: stored?.referrer ?? (document.referrer || null),
      landing_page: stored?.landing_page ?? currentPage,
      first_seen_at: stored?.first_seen_at ?? new Date().toISOString(),
      current_page: currentPage,
    };

    try {
      window.localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
    } catch {
      /* storage may be unavailable (private mode) — continue */
    }

    // Register as super properties so all events (incl. across signup) carry
    // attribution. current_page changes per navigation, so use register().
    client()?.register({ ...attribution });

    return attribution;
  } catch {
    return null;
  }
}
