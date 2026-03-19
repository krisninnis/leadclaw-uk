import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendFounderAlertEmail } from "@/lib/email";

const schema = z.object({
  source: z.string().trim().optional(),
  lead: z.string().trim().optional(),
  page: z.string().trim().optional(),
  visitedAt: z.string().trim().optional(),
  clinicName: z.string().trim().optional(),
  clinicCity: z.string().trim().optional(),
  clinicWebsite: z.string().trim().optional(),
  personalisedDemo: z.boolean().optional(),
  widgetReady: z.boolean().optional(),
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
    const clinicName = parsed.clinicName || null;
    const clinicCity = parsed.clinicCity || null;
    const clinicWebsite = parsed.clinicWebsite || null;
    const personalisedDemo = parsed.personalisedDemo ?? false;
    const widgetReady = parsed.widgetReady ?? false;

    if (!source && !leadId) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const nextStatus =
      personalisedDemo && widgetReady ? "hot_demo" : "clicked_demo";

    if (leadId) {
      const { data: leadRow, error: leadLookupError } = await admin
        .from("leads")
        .select("notes")
        .eq("id", leadId)
        .limit(1)
        .maybeSingle();

      if (leadLookupError) {
        console.error("[demo-visit] lead lookup failed", leadLookupError);

        return NextResponse.json(
          { ok: false, error: "lead_lookup_failed" },
          { status: 500 },
        );
      }

      const existingNotes = leadRow?.notes;
      const safeNotes = String(existingNotes || "").trim();

      const clickTag = `demo_visit_source=${source || "unknown"}`;
      const visitTag = `demo_visit_at=${visitedAt}`;
      const pageTag = `demo_visit_page=${page}`;
      const personalisedTag = `demo_personalised=${personalisedDemo}`;
      const widgetTag = `demo_widget_ready=${widgetReady}`;
      const clinicNameTag = clinicName ? `demo_clinic_name=${clinicName}` : "";
      const clinicCityTag = clinicCity ? `demo_clinic_city=${clinicCity}` : "";

      const nextNotes = [
        safeNotes,
        clickTag,
        visitTag,
        pageTag,
        personalisedTag,
        widgetTag,
        clinicNameTag,
        clinicCityTag,
      ]
        .filter(Boolean)
        .join(" | ");

      const { error: leadUpdateError } = await admin
        .from("leads")
        .update({
          notes: nextNotes,
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", leadId);

      if (leadUpdateError) {
        console.error("[demo-visit] lead update failed", leadUpdateError);

        return NextResponse.json(
          { ok: false, error: "lead_update_failed" },
          { status: 500 },
        );
      }

      const { error: eventInsertError } = await admin
        .from("outreach_events")
        .insert({
          lead_id: leadId,
          channel: "outreach",
          event_type: "demo_visit",
          payload: {
            source: source || "unknown",
            page,
            visitedAt,
            clinicName,
            clinicCity,
            clinicWebsite,
            personalisedDemo,
            widgetReady,
          },
        });

      if (eventInsertError) {
        console.error(
          "[demo-visit] outreach event insert failed",
          eventInsertError,
        );

        return NextResponse.json(
          { ok: false, error: "event_insert_failed" },
          { status: 500 },
        );
      }

      if (nextStatus === "hot_demo") {
        await sendFounderAlertEmail({
          title: "LeadClaw Alert: Hot Demo Lead",
          lines: [
            { label: "Clinic", value: clinicName || "Unknown clinic" },
            { label: "City", value: clinicCity || "-" },
            { label: "Website", value: clinicWebsite || "-" },
            { label: "Source", value: source || "unknown" },
            { label: "Lead ID", value: leadId },
          ],
          tags: [
            { name: "type", value: "founder_alert" },
            { name: "event", value: "hot_demo" },
            { name: "lead_id", value: leadId },
          ],
        });
      }
    }

    return NextResponse.json({
      ok: true,
      tracked: true,
      leadId,
      source,
      eventType: "demo_visit",
      leadStatus: nextStatus,
    });
  } catch (error) {
    console.error("[demo-visit] failed", error);

    return NextResponse.json(
      { ok: false, error: "invalid_request" },
      { status: 400 },
    );
  }
}
