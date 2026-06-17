import { describe, it, expect, jest, beforeEach } from "@jest/globals";

jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: jest.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { recordOutreachActivity } from "@/lib/outreach-activity";

const mockedCreateAdminClient = jest.mocked(createAdminClient);

function makeAdmin(insertResult: { error: { message: string } | null }) {
  const insert = jest.fn(async () => insertResult);
  const admin = {
    from: jest.fn(() => ({ insert })),
  } as unknown as ReturnType<typeof createAdminClient>;
  mockedCreateAdminClient.mockReturnValue(admin);
  return { admin, insert };
}

describe("recordOutreachActivity", () => {
  beforeEach(() => jest.clearAllMocks());

  it("inserts a single activity row with the expected shape", async () => {
    const { insert, admin } = makeAdmin({ error: null });

    const result = await recordOutreachActivity({
      leadId: "lead_1",
      action: "do_not_contact",
      userId: "admin-1",
      metadata: { email: "x@y.co.uk", suppression_reason: "do_not_contact" },
    });

    expect(result).toEqual({ ok: true });
    expect((admin as unknown as { from: jest.Mock }).from).toHaveBeenCalledWith(
      "outreach_activity",
    );
    expect(insert).toHaveBeenCalledWith({
      lead_id: "lead_1",
      action: "do_not_contact",
      user_id: "admin-1",
      notes: null,
      metadata: { email: "x@y.co.uk", suppression_reason: "do_not_contact" },
    });
  });

  it("defaults user_id/notes to null and metadata to {}", async () => {
    const { insert } = makeAdmin({ error: null });

    await recordOutreachActivity({ leadId: "lead_2", action: "skipped" });

    expect(insert).toHaveBeenCalledWith({
      lead_id: "lead_2",
      action: "skipped",
      user_id: null,
      notes: null,
      metadata: {},
    });
  });

  it("requires a lead_id", async () => {
    makeAdmin({ error: null });
    const result = await recordOutreachActivity({
      leadId: "",
      action: "skipped",
    });
    expect(result).toEqual({ ok: false, error: "lead_id_required" });
  });

  it("returns an error result when the insert fails", async () => {
    const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    makeAdmin({ error: { message: "insert boom" } });

    const result = await recordOutreachActivity({
      leadId: "lead_3",
      action: "called",
    });

    expect(result).toEqual({ ok: false, error: "insert boom" });
    errSpy.mockRestore();
  });
});
