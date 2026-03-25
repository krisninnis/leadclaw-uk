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

export type FounderAlertInput = {
  title: string;
  lines: Array<{ label: string; value: string | null | undefined }>;
  tags?: EmailTag[];
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function isSuppressed(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  const admin = createAdminClient();

  if (!admin) {
    console.error("[email] supabase_not_configured during suppression lookup");
    return false;
  }

  const { data, error } = await admin
    .from("email_suppressions")
    .select("id")
    .eq("email", normalized)
    .maybeSingle();

  if (error) {
    console.error("[email] suppression lookup failed", error);
    return false;
  }

  return Boolean(data?.id);
}

export async function suppressEmail(email: string, reason = "unsubscribe") {
  const normalized = normalizeEmail(email);
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
      source: "leadclaw_app",
      suppressed_at: new Date().toISOString(),
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

export async function sendFounderAlertEmail(
  input: FounderAlertInput,
): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
  const founderEmail =
    process.env.FOUNDER_ALERT_EMAIL?.trim() || "krisninnis@gmail.com";

  const safeLines = input.lines.filter(
    (line) =>
      line.value !== null &&
      line.value !== undefined &&
      String(line.value).trim() !== "",
  );

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2 style="margin-bottom:16px;">${input.title}</h2>
      <table style="border-collapse:collapse;width:100%;max-width:640px;">
        <tbody>
          ${safeLines
            .map(
              (line) => `
                <tr>
                  <td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;width:180px;background:#f8fafc;">
                    ${line.label}
                  </td>
                  <td style="padding:8px 12px;border:1px solid #e2e8f0;">
                    ${String(line.value)}
                  </td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;

  const text = [
    input.title,
    ...safeLines.map((line) => `${line.label}: ${line.value}`),
  ].join("\n");

  return sendEmail({
    to: founderEmail,
    subject: input.title,
    html,
    text,
    tags: input.tags,
  });
}
