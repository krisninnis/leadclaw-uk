// Resend email provider.
//
// Wraps the EXISTING email helper at src/lib/email.ts rather than re-implementing
// Resend access. That helper already owns the API-key check, the from-address
// resolution and the suppression-aware send path, so this adapter is a thin
// translation from the communications domain types to that helper's contract.
// No new Resend SDK usage is introduced here.

import { sendEmail as sendEmailViaResend } from "@/lib/email";
import type { EmailProvider } from "../provider";
import type { CommunicationResult, SendEmailInput } from "../types";

export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend" as const;

  isConfigured(): boolean {
    return Boolean(process.env.RESEND_API_KEY?.trim());
  }

  async sendEmail(input: SendEmailInput): Promise<CommunicationResult> {
    if (!this.isConfigured()) {
      return {
        ok: false,
        channel: "email",
        provider: this.name,
        error: "provider_not_configured",
        detail: "RESEND_API_KEY missing",
      };
    }

    const result = await sendEmailViaResend({
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      tags: input.tags,
    });

    if (result.ok) {
      return {
        ok: true,
        channel: "email",
        provider: this.name,
        providerMessageId: result.id ?? null,
      };
    }

    // Map the helper's string error onto a stable code without losing detail.
    const error =
      result.error === "resend_not_configured" ||
      result.error === "resend_from_not_configured"
        ? "provider_not_configured"
        : "send_failed";

    return {
      ok: false,
      channel: "email",
      provider: this.name,
      error,
      detail: result.error,
    };
  }
}
