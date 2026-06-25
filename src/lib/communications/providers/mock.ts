// Mock communications provider — development + tests.
//
// NEVER performs network I/O and NEVER sends a real message. It records safe
// metadata about each "send" in-memory so tests can assert what would have gone
// out, and logs a single redacted debug line. Used for email, SMS and WhatsApp
// when the corresponding COMMUNICATIONS_*_PROVIDER is set to "mock".

import { buildBodyPreview } from "../events";
import type {
  EmailProvider,
  SmsProvider,
  WhatsAppProvider,
} from "../provider";
import type {
  CommunicationChannel,
  CommunicationResult,
  SendEmailInput,
  SendSmsInput,
  SendWhatsAppInput,
} from "../types";

export type RecordedSend = {
  channel: CommunicationChannel;
  to: string;
  preview: string | null;
  providerMessageId: string;
};

/**
 * Single mock implementing all three send interfaces. Exposes `sent` for test
 * assertions. Construction is side-effect free.
 */
export class MockProvider
  implements EmailProvider, SmsProvider, WhatsAppProvider
{
  readonly name = "mock" as const;
  readonly sent: RecordedSend[] = [];

  private counter = 0;

  isConfigured(): boolean {
    // The mock is always "configured" — it just doesn't send anything real.
    return true;
  }

  private record(
    channel: CommunicationChannel,
    to: string,
    body: string,
  ): CommunicationResult {
    const providerMessageId = `mock-${channel}-${++this.counter}`;
    const preview = buildBodyPreview(body);
    this.sent.push({ channel, to, preview, providerMessageId });
    // Safe metadata only — no recipient body, no PII beyond the redacted preview.
    console.info(
      `[communications:mock] would send ${channel} (id=${providerMessageId}, preview=${
        preview ?? "<empty>"
      })`,
    );
    return {
      ok: true,
      channel,
      provider: this.name,
      providerMessageId,
    };
  }

  async sendEmail(input: SendEmailInput): Promise<CommunicationResult> {
    return this.record("email", input.to, input.text ?? input.subject ?? "");
  }

  async sendSms(input: SendSmsInput): Promise<CommunicationResult> {
    return this.record("sms", input.to, input.body);
  }

  async sendWhatsApp(input: SendWhatsAppInput): Promise<CommunicationResult> {
    return this.record("whatsapp", input.to, input.body);
  }

  /** Test helper: forget everything recorded so far. */
  reset(): void {
    this.sent.length = 0;
    this.counter = 0;
  }
}
