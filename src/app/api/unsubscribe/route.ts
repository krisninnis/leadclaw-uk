import { NextResponse } from "next/server";
import { suppressEmail } from "@/lib/email";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isValidEmail(value: string) {
  return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawEmail = searchParams.get("email");

  if (!rawEmail) {
    return NextResponse.json(
      { ok: false, error: "missing_email" },
      { status: 400 },
    );
  }

  const email = normalizeEmail(rawEmail);

  if (!isValidEmail(email)) {
    return NextResponse.json(
      { ok: false, error: "invalid_email" },
      { status: 400 },
    );
  }

  try {
    await suppressEmail(email, "unsubscribe_link");

    return new NextResponse(
      `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Unsubscribed | LeadClaw</title>
  </head>
  <body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="max-width:640px;margin:48px auto;padding:24px;">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:32px;">
        <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;">You’re unsubscribed</h1>
        <p style="margin:0 0 12px;font-size:16px;line-height:1.6;">
          <strong>${escapeHtml(email)}</strong> has been removed from future LeadClaw outreach emails.
        </p>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#475569;">
          If this was a mistake, contact
          <a href="mailto:privacy@leadclaw.uk" style="color:#2563eb;text-decoration:none;">privacy@leadclaw.uk</a>.
        </p>
      </div>
    </div>
  </body>
</html>`,
      {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("[unsubscribe] failed", error);

    return new NextResponse(
      `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Error | LeadClaw</title>
  </head>
  <body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="max-width:640px;margin:48px auto;padding:24px;">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:32px;">
        <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;">Unable to process unsubscribe</h1>
        <p style="margin:0 0 12px;font-size:16px;line-height:1.6;">
          We could not process your request right now.
        </p>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#475569;">
          Please email
          <a href="mailto:privacy@leadclaw.uk" style="color:#2563eb;text-decoration:none;">privacy@leadclaw.uk</a>
          and we’ll handle it manually.
        </p>
      </div>
    </div>
  </body>
</html>`,
      {
        status: 500,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
