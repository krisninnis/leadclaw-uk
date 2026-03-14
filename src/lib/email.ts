import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";

export type EmailTag = {
  name: string;
  value: string;
};

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  tags?: EmailTag[];
};

export async function isSuppressed(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  const admin = createAdminClient();

  if (!admin) return false;

  const { data, error } = await admin
    .from("email_suppressions")
    .select("id")
    .eq("email", normalized)
    .maybeSingle();

  if (error) return false;
  return Boolean(data?.id);
}

export async function suppressEmail(email: string, reason = "unsubscribe") {
  const normalized = email.trim().toLowerCase();
  const admin = createAdminClient();

  if (!admin) {
    return {
      data: null,
      error: new Error("supabase_not_configured"),
    };
  }

  return admin.from("email_suppressions").upsert(
    {
      email: normalized,
      reason,
    },
    {
      onConflict: "email",
    },
  );
}

export async function sendEmail(
  input: SendEmailInput,
): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();

  if (!apiKey) return { ok: false, error: "resend_not_configured" };
  if (!from) return { ok: false, error: "resend_from_not_configured" };

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      tags: input.tags,
    });

    if (error) {
      return { ok: false, error: error.message || "send_failed" };
    }

    return {
      ok: true,
      id: data?.id ?? null,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "send_failed",
    };
  }
}
