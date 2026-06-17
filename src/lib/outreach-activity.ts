import { createAdminClient } from "@/lib/supabase/admin";

export type OutreachActivityAction =
  | "previewed"
  | "skipped"
  | "called"
  | "do_not_contact"
  | "email_sent"
  | "email_failed"
  | "replied"
  | "note";

export type OutreachActivity = {
  id: string;
  lead_id: string;
  action: OutreachActivityAction;
  user_id: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type RecordOutreachActivityInput = {
  leadId: string;
  action: OutreachActivityAction;
  userId?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Insert a single outreach_activity audit row using the admin client.
 *
 * This is logging/audit only — it never sends email. The caller receives a
 * clear ok/error result so API routes can decide how to react if logging fails
 * (we treat audit logging as required for the queue actions, so they surface
 * a failure rather than silently dropping it).
 */
export async function recordOutreachActivity(
  input: RecordOutreachActivityInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { leadId, action, userId, notes, metadata } = input;

  if (!leadId) {
    return { ok: false, error: "lead_id_required" };
  }

  const admin = createAdminClient();
  if (!admin) {
    return { ok: false, error: "supabase_not_configured" };
  }

  const { error } = await (admin as unknown as SupabaseUntypedClient)
    .from("outreach_activity")
    .insert({
      lead_id: leadId,
      action,
      user_id: userId ?? null,
      notes: notes ?? null,
      metadata: metadata ?? {},
    });

  if (error) {
    console.error("[outreach.activity] insert failed", {
      action,
      error: error.message,
    });
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
