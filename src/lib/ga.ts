"use client";

export type GaEventName =
  | "trial_start_clicked"
  | "signup_started"
  | "signup_completed"
  | "contact_form_submitted"
  | "demo_viewed"
  | "pricing_viewed"
  | "checkout_started"
  | "portal_reached";

export type GaEventParams = Record<
  string,
  string | number | boolean | null | undefined
>;

type PendingGaEvent = {
  name: GaEventName;
  params?: GaEventParams;
  dedupeKey?: string;
};

type GtagEvent = (
  command: "event",
  eventName: string,
  eventParams?: Record<string, string | number | boolean>,
) => void;

declare global {
  interface Window {
    gtag?: GtagEvent;
  }
}

const PENDING_EVENTS_KEY = "leadclaw_pending_ga_events";
const SENT_EVENT_PREFIX = "leadclaw_ga_sent:";

function cleanParams(params: GaEventParams = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== null && value !== undefined),
  ) as Record<string, string | number | boolean>;
}

function hasSent(dedupeKey?: string) {
  if (!dedupeKey || typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(`${SENT_EVENT_PREFIX}${dedupeKey}`) === "1";
  } catch {
    return false;
  }
}

function markSent(dedupeKey?: string) {
  if (!dedupeKey || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(`${SENT_EVENT_PREFIX}${dedupeKey}`, "1");
  } catch {}
}

export function trackGaEvent(
  name: GaEventName,
  params?: GaEventParams,
  options?: { dedupeKey?: string },
) {
  if (typeof window === "undefined" || hasSent(options?.dedupeKey)) return;

  if (typeof window.gtag !== "function") return;

  window.gtag("event", name, cleanParams(params));
  markSent(options?.dedupeKey);
}

export function queueGaEvent(
  name: GaEventName,
  params?: GaEventParams,
  options?: { dedupeKey?: string },
) {
  if (typeof window === "undefined") return;

  try {
    const current = window.sessionStorage.getItem(PENDING_EVENTS_KEY);
    const pending = current ? (JSON.parse(current) as PendingGaEvent[]) : [];
    pending.push({ name, params, dedupeKey: options?.dedupeKey });
    window.sessionStorage.setItem(PENDING_EVENTS_KEY, JSON.stringify(pending));
  } catch {}
}

export function flushQueuedGaEvents(extraParams?: GaEventParams) {
  if (typeof window === "undefined") return;

  try {
    const current = window.sessionStorage.getItem(PENDING_EVENTS_KEY);
    if (!current) return;

    const pending = JSON.parse(current) as PendingGaEvent[];
    window.sessionStorage.removeItem(PENDING_EVENTS_KEY);

    pending.forEach((event) => {
      trackGaEvent(
        event.name,
        { ...extraParams, ...event.params },
        { dedupeKey: event.dedupeKey },
      );
    });
  } catch {
    window.sessionStorage.removeItem(PENDING_EVENTS_KEY);
  }
}

export function safePlanParam(value: string | null | undefined) {
  if (value === "basic" || value === "growth" || value === "pro") return value;
  return undefined;
}

export function safePathFromHref(href: string) {
  try {
    return new URL(href, window.location.origin).pathname;
  } catch {
    return href.split("?")[0] || href;
  }
}

export function safePlanFromHref(href: string) {
  try {
    const url = new URL(href, window.location.origin);
    return safePlanParam(url.searchParams.get("plan"));
  } catch {
    return undefined;
  }
}
