import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  TERMS_VERSION,
  PRIVACY_VERSION,
  WEBSITE_PRIVACY_ACK_VERSION,
  type ConsentRecord,
} from "@/lib/legal-consent";

export const runtime = "nodejs";

// Account-holder consent is the durable record for the customer (Controller of
// their own account data). It is stored in Supabase auth user_metadata — the
// same mechanism already used by /api/account/profile — which works without any
// schema change. When the additive migration 20260621_add_consent_tracking.sql
// has been applied, a best-effort copy is also written to public.profiles for
// relational querying; a missing column there never blocks the request.

type ConsentMetadata = {
  accepted_terms_at?: string | null;
  accepted_privacy_at?: string | null;
  terms_version?: string | null;
  privacy_version?: string | null;
  marketing_consent?: boolean;
  marketing_consent_updated_at?: string | null;
  website_privacy_ack_at?: string | null;
  website_privacy_ack_version?: string | null;
  consent_user_agent?: string | null;
  consent_ip?: string | null;
};

function readConsent(meta: Record<string, unknown> | undefined): ConsentRecord {
  const m = (meta || {}) as ConsentMetadata;
  return {
    acceptedTermsAt: m.accepted_terms_at ?? null,
    acceptedPrivacyAt: m.accepted_privacy_at ?? null,
    termsVersion: m.terms_version ?? null,
    privacyVersion: m.privacy_version ?? null,
    marketingConsent: m.marketing_consent === true,
    marketingConsentUpdatedAt: m.marketing_consent_updated_at ?? null,
    websitePrivacyAckAt: m.website_privacy_ack_at ?? null,
    websitePrivacyAckVersion: m.website_privacy_ack_version ?? null,
  };
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ ok: true, consent: readConsent(user.user_metadata) });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    acceptTerms?: boolean;
    acceptPrivacy?: boolean;
    marketingConsent?: boolean;
    websitePrivacyAck?: boolean;
  };

  const now = new Date().toISOString();
  const existing = (user.user_metadata || {}) as Record<string, unknown>;
  const patch: ConsentMetadata = {};

  if (body?.acceptTerms === true) {
    patch.accepted_terms_at = now;
    patch.terms_version = TERMS_VERSION;
  }
  if (body?.acceptPrivacy === true) {
    patch.accepted_privacy_at = now;
    patch.privacy_version = PRIVACY_VERSION;
  }
  if (typeof body?.marketingConsent === "boolean") {
    patch.marketing_consent = body.marketingConsent;
    patch.marketing_consent_updated_at = now;
  }
  if (body?.websitePrivacyAck === true) {
    patch.website_privacy_ack_at = now;
    patch.website_privacy_ack_version = WEBSITE_PRIVACY_ACK_VERSION;
  }

  // Optional provenance — recorded on every consent action.
  const userAgent = req.headers.get("user-agent");
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  patch.consent_user_agent = userAgent;
  patch.consent_ip = ip;

  const { error } = await supabase.auth.updateUser({
    data: { ...existing, ...patch },
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  // Best-effort durable copy into profiles (requires the additive migration).
  // Never blocks: if the columns are not present yet, log and continue.
  try {
    const admin = createAdminClient({ optional: true });
    if (admin) {
      const profileUpdate: Record<string, unknown> = {
        consent_user_agent: userAgent,
        consent_ip: ip,
      };
      if (patch.accepted_terms_at) {
        profileUpdate.accepted_terms_at = patch.accepted_terms_at;
        profileUpdate.terms_version = patch.terms_version;
      }
      if (patch.accepted_privacy_at) {
        profileUpdate.accepted_privacy_at = patch.accepted_privacy_at;
        profileUpdate.privacy_version = patch.privacy_version;
      }
      if (patch.marketing_consent !== undefined) {
        profileUpdate.marketing_consent = patch.marketing_consent;
        profileUpdate.marketing_consent_updated_at = patch.marketing_consent_updated_at;
      }
      if (patch.website_privacy_ack_at) {
        profileUpdate.website_privacy_ack_at = patch.website_privacy_ack_at;
        profileUpdate.website_privacy_ack_version = patch.website_privacy_ack_version;
      }

      const { error: profileError } = await (admin as unknown as SupabaseUntypedClient)
        .from("profiles")
        .update(profileUpdate)
        .eq("id", user.id);

      if (profileError) {
        console.warn(
          "[account.consent] profiles persist skipped (apply 20260621_add_consent_tracking.sql):",
          profileError.message,
        );
      }
    }
  } catch (persistError) {
    console.warn("[account.consent] profiles persist error", persistError);
  }

  const {
    data: { user: refreshed },
  } = await supabase.auth.getUser();

  return NextResponse.json({ ok: true, consent: readConsent(refreshed?.user_metadata) });
}
