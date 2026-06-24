import { describe, it, expect, beforeEach, jest } from "@jest/globals";

jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: jest.fn() }));
jest.mock("@/lib/ops", () => ({ logSystemEvent: jest.fn() }));
jest.mock("@/lib/email", () => ({ sendFounderAlertEmail: jest.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { sendFounderAlertEmail } from "@/lib/email";
import { POST as voicePOST } from "@/app/api/webhooks/twilio/voice/route";
import { POST as smsPOST } from "@/app/api/webhooks/twilio/sms/route";

const mockedCreateAdminClient = jest.mocked(createAdminClient);
const mockedSendFounderAlertEmail = jest.mocked(sendFounderAlertEmail);

type Ctx = { table: string; op: "select" | "insert" | "update"; values: unknown };
type Resolver = (ctx: Ctx) => { data?: unknown; error?: unknown };

function makeAdmin(resolver: Resolver) {
  const writes: Ctx[] = [];
  function builder(table: string) {
    const ctx: Ctx = { table, op: "select", values: null };
    const result = () => resolver(ctx);
    const b: Record<string, unknown> = {};
    b.select = () => b;
    b.insert = (v: unknown) => {
      ctx.op = "insert";
      ctx.values = v;
      writes.push({ ...ctx });
      return b;
    };
    b.update = (v: unknown) => {
      ctx.op = "update";
      ctx.values = v;
      writes.push({ ...ctx });
      return b;
    };
    b.eq = () => b;
    b.order = () => b;
    b.limit = () => b;
    b.maybeSingle = () => Promise.resolve(result());
    b.single = () => Promise.resolve(result());
    b.then = (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
      Promise.resolve(result()).then(onF, onR);
    return b;
  }
  return {
    admin: { from: (t: string) => builder(t) },
    writes,
  };
}

const CLINIC_ROW = {
  id: "pn_1",
  clinic_id: "clinic_1",
  provider: "twilio",
  e164_number: "+441174960000",
  label: "Main line",
};

function formRequest(url: string, fields: Record<string, string>) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  // Twilio not configured in tests -> signature validation is skipped (allowed).
  delete process.env.TWILIO_ACCOUNT_SID;
  delete process.env.TWILIO_AUTH_TOKEN;
});

describe("POST /api/webhooks/twilio/voice", () => {
  it("records a missed call and does NOT text back when caller ID is withheld", async () => {
    const { admin, writes } = makeAdmin((ctx) => {
      if (ctx.table === "phone_numbers") return { data: CLINIC_ROW };
      if (ctx.table === "missed_calls" && ctx.op === "insert")
        return { data: { id: "mc_1" } };
      return { data: null };
    });
    mockedCreateAdminClient.mockReturnValue(
      admin as unknown as ReturnType<typeof createAdminClient>,
    );

    const req = formRequest("http://localhost/api/webhooks/twilio/voice", {
      CallSid: "CA_anon",
      From: "anonymous",
      To: "+441174960000",
      CallStatus: "ringing",
    });

    const res = await voicePOST(req);
    expect(res.status).toBe(200);

    const missedCall = writes.find((w) => w.table === "missed_calls");
    expect((missedCall?.values as { status: string }).status).toBe(
      "requiring_review",
    );
    // No text-back attempted -> no sms_messages written.
    expect(writes.some((w) => w.table === "sms_messages")).toBe(false);
  });

  it("records a missed call with status 'missed' when the caller is known", async () => {
    const { admin, writes } = makeAdmin((ctx) => {
      if (ctx.table === "phone_numbers") return { data: CLINIC_ROW };
      if (ctx.table === "missed_calls" && ctx.op === "insert")
        return { data: { id: "mc_1" } };
      if (ctx.table === "sms_conversations" && ctx.op === "insert")
        return {
          data: { id: "conv_1", clinic_id: "clinic_1", enquiry_id: null, status: "awaiting_reply" },
        };
      if (ctx.table === "clinics") return { data: { name: "Acme Plumbing" } };
      return { data: null };
    });
    mockedCreateAdminClient.mockReturnValue(
      admin as unknown as ReturnType<typeof createAdminClient>,
    );

    const req = formRequest("http://localhost/api/webhooks/twilio/voice", {
      CallSid: "CA_known",
      From: "+447700900123",
      To: "+441174960000",
      CallStatus: "ringing",
    });

    const res = await voicePOST(req);
    expect(res.status).toBe(200);
    const missedCall = writes.find((w) => w.table === "missed_calls");
    expect((missedCall?.values as { status: string }).status).toBe("missed");
    // A conversation is opened for the text-back.
    expect(
      writes.some((w) => w.table === "sms_conversations" && w.op === "insert"),
    ).toBe(true);
  });

  it("ignores calls to an unknown number", async () => {
    const { admin, writes } = makeAdmin(() => ({ data: null }));
    mockedCreateAdminClient.mockReturnValue(
      admin as unknown as ReturnType<typeof createAdminClient>,
    );

    const req = formRequest("http://localhost/api/webhooks/twilio/voice", {
      CallSid: "CA_x",
      From: "+447700900123",
      To: "+440000000000",
    });
    const res = await voicePOST(req);
    expect(res.status).toBe(200);
    expect(writes.some((w) => w.table === "missed_calls")).toBe(false);
  });
});

describe("POST /api/webhooks/twilio/sms", () => {
  it("creates an enquiry from an inbound reply and notifies the owner", async () => {
    const { admin, writes } = makeAdmin((ctx) => {
      if (ctx.table === "phone_numbers") return { data: CLINIC_ROW };
      if (ctx.table === "sms_conversations" && ctx.op === "insert")
        return {
          data: { id: "conv_1", clinic_id: "clinic_1", enquiry_id: null, status: "open" },
        };
      if (ctx.table === "clinics") return { data: { name: "Acme Plumbing" } };
      if (ctx.table === "enquiries" && ctx.op === "insert")
        return { data: { id: "enq_1" } };
      return { data: null };
    });
    mockedCreateAdminClient.mockReturnValue(
      admin as unknown as ReturnType<typeof createAdminClient>,
    );

    const req = formRequest("http://localhost/api/webhooks/twilio/sms", {
      MessageSid: "SM_in",
      From: "+447700900123",
      To: "+441174960000",
      Body: "Hi, my boiler is leaking, can you come today?",
    });

    const res = await smsPOST(req);
    expect(res.status).toBe(200);

    // Inbound message stored.
    expect(
      writes.some(
        (w) =>
          w.table === "sms_messages" &&
          w.op === "insert" &&
          (w.values as { direction: string }).direction === "inbound",
      ),
    ).toBe(true);
    // Enquiry created.
    const enquiry = writes.find(
      (w) => w.table === "enquiries" && w.op === "insert",
    );
    expect(enquiry).toBeDefined();
    expect((enquiry?.values as { phone: string }).phone).toBe("+447700900123");
    // Owner notified.
    expect(mockedSendFounderAlertEmail).toHaveBeenCalledTimes(1);
  });

  it("handles STOP without creating an enquiry", async () => {
    const { admin, writes } = makeAdmin((ctx) => {
      if (ctx.table === "phone_numbers") return { data: CLINIC_ROW };
      if (ctx.table === "sms_conversations" && ctx.op === "insert")
        return {
          data: { id: "conv_1", clinic_id: "clinic_1", enquiry_id: null, status: "open" },
        };
      return { data: null };
    });
    mockedCreateAdminClient.mockReturnValue(
      admin as unknown as ReturnType<typeof createAdminClient>,
    );

    const req = formRequest("http://localhost/api/webhooks/twilio/sms", {
      MessageSid: "SM_stop",
      From: "+447700900123",
      To: "+441174960000",
      Body: "STOP",
    });

    const res = await smsPOST(req);
    expect(res.status).toBe(200);
    expect(writes.some((w) => w.table === "enquiries")).toBe(false);
    expect(mockedSendFounderAlertEmail).not.toHaveBeenCalled();
    // Conversation marked opted_out.
    const optOut = writes.find(
      (w) =>
        w.table === "sms_conversations" &&
        w.op === "update" &&
        (w.values as { status?: string }).status === "opted_out",
    );
    expect(optOut).toBeDefined();
  });
});
