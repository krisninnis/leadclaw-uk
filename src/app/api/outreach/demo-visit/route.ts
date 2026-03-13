import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  source: z.string().trim().optional(),
  lead: z.string().trim().optional(),
  page: z.string().trim().optional(),
  visitedAt: z.string().trim().optional(),
});

export async function POST(req: Request) {
  const admin = createAdminClient();

  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "supabase_not_configured" },
      { status: 500 },
    );
  }

  try {
    const body = await req.json();
    const parsed = schema.parse(body);

    const source = parsed.source || null;
    const leadId = parsed.lead || null;
    const page = parsed.page || "/demo";
    const visitedAt = parsed.visitedAt || new Date().toISOString();

    if (!source && !leadId) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    if (leadId) {
      const existingNotes = (
        await admin
          .from("leads")
          .select("notes")
          .eq("id", leadId)
          .limit(1)
          .maybeSingle()
      ).data?.notes;

      const safeNotes = String(existingNotes || "").trim();
      const clickTag = `demo_visit_source=${source || "unknown"}`;
      const visitTag = `demo_visit_at=${visitedAt}`;
      const pageTag = `demo_visit_page=${page}`;

      const nextNotes = [safeNotes, clickTag, visitTag, pageTag]
        .filter(Boolean)
        .join(" | ");

      await admin
        .from("leads")
        .update({
          notes: nextNotes,
          status: "clicked_demo",
          updated_at: new Date().toISOString(),
        })
        .eq("id", leadId);
    }

    return NextResponse.json({
      ok: true,
      tracked: true,
      leadId,
      source,
    });
  } catch (error) {
    console.error("[demo-visit] failed", error);

    return NextResponse.json(
      { ok: false, error: "invalid_request" },
      { status: 400 },
    );
  }
}
