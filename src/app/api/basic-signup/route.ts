// src/app/api/basic-signup/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { provisionClinicWorkspace } from "@/lib/provision-clinic";
import { logSystemEvent } from "@/lib/ops";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "missing_email" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json(
        { error: "supabase_not_configured" },
        { status: 400 },
      );
    }

    // ✅ Create user (magic link)
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      normalizedEmail,
      {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/portal/basic`, // Updated to redirect to the Basic portal
      },
    );

    if (inviteError) {
      return NextResponse.json({ error: inviteError.message }, { status: 500 });
    }

    // ✅ Create BASIC subscription (no trial)
    await admin.from("subscriptions").insert({
      email: normalizedEmail,
      plan: "basic", // The user's plan is set to "basic"
      status: "active",
      trial_end: null,
      current_period_end: null,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    });

    // ✅ Provision workspace for the clinic (if applicable)
    let provisionResult = null;

    try {
      provisionResult = await provisionClinicWorkspace({
        email: normalizedEmail,
      });
    } catch (e) {
      await logSystemEvent({
        level: "warn",
        category: "onboarding",
        message: "Basic signup provision failed",
        meta: {
          email: normalizedEmail,
          error: e instanceof Error ? e.message : "unknown",
        },
      });
    }

    await logSystemEvent({
      level: "info",
      category: "billing_basic",
      message: `Basic plan started for ${normalizedEmail}`,
      meta: {
        email: normalizedEmail,
        siteId: provisionResult?.siteId || null,
        clinicId: provisionResult?.clinicId || null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "basic_signup_failed" }, { status: 500 });
  }
}
