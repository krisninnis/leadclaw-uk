// Communications provider adapter interfaces.
//
// Each channel has a narrow interface so a new vendor is a single new file under
// providers/ plus one line in the factory (index.ts) — never a change across
// routes. Phase 1 ships concrete Mock + Resend (email) adapters; SMS/WhatsApp/
// voice providers are represented by interfaces + config types only.

import type {
  CommunicationProvider,
  CommunicationResult,
  SendEmailInput,
  SendSmsInput,
  SendWhatsAppInput,
} from "./types";

/**
 * Base contract shared by every channel adapter. `isConfigured()` lets the
 * factory decide whether a provider can actually send, without throwing when
 * credentials are absent.
 */
export interface BaseProvider {
  /** Stable id persisted on communication_events rows. */
  readonly name: CommunicationProvider;
  /** True when the provider has the env/config it needs to send for real. */
  isConfigured(): boolean;
}

export interface EmailProvider extends BaseProvider {
  sendEmail(input: SendEmailInput): Promise<CommunicationResult>;
}

export interface SmsProvider extends BaseProvider {
  sendSms(input: SendSmsInput): Promise<CommunicationResult>;
}

export interface WhatsAppProvider extends BaseProvider {
  sendWhatsApp(input: SendWhatsAppInput): Promise<CommunicationResult>;
}
