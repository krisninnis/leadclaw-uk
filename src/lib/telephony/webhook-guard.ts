// Shared signature-enforcement for Twilio webhook routes.
//
// Policy:
//   * provider configured + valid signature      -> allow
//   * provider configured + invalid/missing sig   -> reject (403)
//   * provider NOT configured (no auth token)      -> allow, but log a warning
//     (so local/dev testing works without secrets; production should always
//     have TWILIO_AUTH_TOKEN set).

import { getTelephonyProvider, readWebhookParams, webhookUrl } from "./index";
import type { TelephonyProvider, WebhookParams } from "./types";

export type WebhookGuardResult = {
  allowed: boolean;
  params: WebhookParams;
  provider: TelephonyProvider;
};

export async function guardTwilioWebhook(
  req: Request,
  path: string,
): Promise<WebhookGuardResult> {
  const provider = getTelephonyProvider();
  const params = await readWebhookParams(req);
  const signature = req.headers.get("x-twilio-signature");

  const check = provider.validateWebhookSignature({
    url: webhookUrl(path),
    params,
    signature,
  });

  if (check.reason === "not_configured") {
    console.warn(
      `[telephony] ${path}: signature validation skipped (provider not configured)`,
    );
    return { allowed: true, params, provider };
  }

  if (!check.valid) {
    console.warn(`[telephony] ${path}: rejected webhook (${check.reason})`);
    return { allowed: false, params, provider };
  }

  return { allowed: true, params, provider };
}
