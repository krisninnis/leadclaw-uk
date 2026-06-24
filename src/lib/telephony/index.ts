// Telephony provider factory + webhook helpers.
//
// Phase 1 ships a single live provider (Twilio). The factory exists so that
// adding Telnyx later is a one-line change here, not a change across routes.

import { getAppUrl } from "@/lib/config";
import { TwilioProvider } from "./twilio";
import type { TelephonyProvider, WebhookParams } from "./types";

export * from "./types";
export { normalisePhoneNumber, isValidE164 } from "./phone";
export { TwilioProvider } from "./twilio";
export { TestTelephonyProvider } from "./test-provider";

let cached: TelephonyProvider | null = null;

/**
 * Returns the active telephony provider. Selected via TELEPHONY_PROVIDER
 * (defaults to "twilio"). Never throws on missing credentials — the provider
 * reports configuration state via isConfigured() and returns clear runtime
 * errors from sendSms().
 */
export function getTelephonyProvider(): TelephonyProvider {
  if (cached) return cached;

  const name = (process.env.TELEPHONY_PROVIDER || "twilio").trim().toLowerCase();

  switch (name) {
    case "twilio":
    default:
      cached = new TwilioProvider();
      break;
  }

  return cached;
}

/** Test-only: reset the cached provider between tests. */
export function __resetTelephonyProvider(): void {
  cached = null;
}

/**
 * Read a Twilio (x-www-form-urlencoded) webhook body into a plain params map.
 * The body can only be read once, so the route calls this and passes the
 * result to both validateWebhookSignature() and the parse methods.
 */
export async function readWebhookParams(req: Request): Promise<WebhookParams> {
  const params: WebhookParams = {};
  try {
    const form = await req.formData();
    for (const [key, value] of form.entries()) {
      params[key] = typeof value === "string" ? value : "";
    }
  } catch {
    // Fall back to URL-encoded text parsing if formData() is unavailable.
    try {
      const text = await req.text();
      const search = new URLSearchParams(text);
      for (const [key, value] of search.entries()) {
        params[key] = value;
      }
    } catch {
      // Leave params empty; caller handles missing data gracefully.
    }
  }
  return params;
}

/**
 * Build the absolute URL the provider used to reach a webhook path, for
 * signature validation. Honours TWILIO_WEBHOOK_BASE_URL when set, otherwise
 * derives from the configured app URL.
 */
export function webhookUrl(path: string): string {
  const base = (process.env.TWILIO_WEBHOOK_BASE_URL || getAppUrl()).replace(
    /\/$/,
    "",
  );
  return `${base}${path}`;
}
