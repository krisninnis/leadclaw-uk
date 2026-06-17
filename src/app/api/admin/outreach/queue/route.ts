import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLeadEligibleForOutreach } from "@/lib/outreach-eligibility";
import { buildOutreachDraft } from "@/lib/outreach-drafts";
import { listOutreachTemplates } from "@/lib/outreach-templates";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

// Only select columns that are known to exist on the leads table.
// `outreach_status`, `unsubscribed_at` and `do_not_contact` are not part of the
// current leads schema, so they are intentionally omitted to avoid query errors.
// The eligibility helper treats them as optional/undefined.
// TODO: include those columns here once they are added to the leads table.
const LEAD_SELECT =
  "id,company_name,contact_email,contact_phone,website,city,niche,lead_quality_score,pecr_classification,status,created_at";

type QueueLeadRow = {
  id: string;
  company_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  city: string | null;
  niche: string | null;
  lead_quality_score: number | null;
  pecr_classification: string | null;
  status: string | null;
  created_at: string | null;
};

function parseLimit(value: string | null): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

export async function GET(req: NextRequest) {
  const authed = await requireAdmin();
  if (!authed.ok) return authed.response;

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "supabase_not_configured" },
      { status: 400 },
    );
  }

  const { searchParams } = new URL(req.url);
  const limit = parseLimit(searchParams.get("limit"));
  const includeIneligible = searchParams.get("includeIneligible") === "true";
  const minScoreRaw = searchParams.get("minScore");
  const minScore =
    minScoreRaw != null && Number.isFinite(Number.parseInt(minScoreRaw, 10))
      ? Number.parseInt(minScoreRaw, 10)
      : null;

  let query = (admin as unknown as SupabaseUntypedClient)
    .from("leads")
    .select(LEAD_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (minScore != null) {
    query = query.gte("lead_quality_score", minScore);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  const rows = (data as QueueLeadRow[] | null) || [];

  // TODO: load suppressed emails in bulk once a suppression source is wired up.
  const suppressedEmails: string[] = [];

  // Use the first active template, if one exists.
  let activeTemplate = null;
  let templateMissing = false;
  try {
    const templates = await listOutreachTemplates();
    activeTemplate = templates.find((t) => t.status === "active") ?? null;
  } catch (err) {
    console.error("[outreach.queue] failed to load templates", err);
  }
  if (!activeTemplate) templateMissing = true;

  let totalChecked = 0;
  let totalEligible = 0;
  const leads: Array<Record<string, unknown>> = [];

  for (const lead of rows) {
    totalChecked += 1;

    const eligibility = isLeadEligibleForOutreach(lead, suppressedEmails);
    if (eligibility.eligible) totalEligible += 1;

    if (!eligibility.eligible && !includeIneligible) continue;

    let draftSubject: string | null = null;
    let draftBody: string | null = null;
    if (activeTemplate) {
      const draft = buildOutreachDraft(lead, activeTemplate, suppressedEmails);
      draftSubject = draft.subject;
      draftBody = draft.body;
    }

    const entry: Record<string, unknown> = {
      id: lead.id,
      company_name: lead.company_name,
      contact_email: lead.contact_email,
      contact_phone: lead.contact_phone,
      website: lead.website,
      city: lead.city,
      niche: lead.niche,
      lead_quality_score: lead.lead_quality_score,
      pecr_classification: lead.pecr_classification,
      email_quality: eligibility.email_quality,
      draft_subject: draftSubject,
      draft_body: draftBody,
    };

    if (includeIneligible) {
      entry.eligible = eligibility.eligible;
      entry.eligibility_reasons = eligibility.reasons;
    }

    leads.push(entry);
  }

  return NextResponse.json({
    ok: true,
    leads,
    totalChecked,
    totalEligible,
    templateMissing,
  });
}
