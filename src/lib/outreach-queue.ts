export type OutreachQueueStatus =
  | "draft"
  | "skipped"
  | "called"
  | "do_not_contact";

export const ACTIONED_QUEUE_STATUSES: OutreachQueueStatus[] = [
  "skipped",
  "called",
  "do_not_contact",
];

type QueueAdminClient = {
  from(table: string): {
    upsert(
      values: Record<string, unknown>,
      options?: { onConflict?: string },
    ): {
      select(columns?: string): {
        maybeSingle(): Promise<{
          data: unknown;
          error: { message: string } | null;
        }>;
      };
    };
  };
};

/**
 * Map a queue status to the timestamp column it stamps.
 */
function timestampColumnFor(status: OutreachQueueStatus): string | null {
  if (status === "skipped") return "skipped_at";
  if (status === "called") return "called_at";
  if (status === "do_not_contact") return "do_not_contact_at";
  return null;
}

/**
 * Create or update the outreach_queue row for a lead, stamping the
 * status-specific timestamp. Columns not included in the payload are left
 * untouched on conflict, so prior action timestamps are preserved.
 */
export async function setOutreachQueueStatus(
  admin: unknown,
  params: {
    leadId: string;
    status: OutreachQueueStatus;
    userId?: string | null;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { leadId, status, userId } = params;
  const now = new Date().toISOString();

  const payload: Record<string, unknown> = {
    lead_id: leadId,
    status,
    updated_at: now,
    updated_by: userId ?? null,
    created_by: userId ?? null,
  };

  const stampColumn = timestampColumnFor(status);
  if (stampColumn) {
    payload[stampColumn] = now;
  }

  const { error } = await (admin as QueueAdminClient)
    .from("outreach_queue")
    .upsert(payload, { onConflict: "lead_id" })
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
