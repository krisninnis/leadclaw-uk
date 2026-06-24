import { describe, it, expect } from "@jest/globals";
import { TestTelephonyProvider } from "@/lib/telephony/test-provider";
import {
  buildTextBackMessage,
  classifyInboundKeyword,
  createOrUpdateEnquiryFromSms,
  estimateTelephonyCost,
  recordMissedCall,
  resolveClinicByPhoneNumber,
  sendMissedCallTextBack,
  COST_PENCE,
  type Conversation,
} from "@/lib/telephony/orchestration";

// --- Flexible fake Supabase admin client -------------------------------------
// Records every write and resolves reads/writes via a per-test resolver keyed
// on { table, op }. Supports the chaining the orchestration code uses.

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

  const admin = { from: (t: string) => builder(t) } as unknown as SupabaseUntypedClient;
  return { admin, writes };
}

describe("estimateTelephonyCost", () => {
  it("prices SMS and calls in pence", () => {
    expect(estimateTelephonyCost({})).toBe(0);
    expect(estimateTelephonyCost({ smsOutbound: 1 })).toBe(COST_PENCE.smsOutbound);
    expect(
      estimateTelephonyCost({ smsOutbound: 10, smsInbound: 5, missedCalls: 3 }),
    ).toBe(
      10 * COST_PENCE.smsOutbound +
        5 * COST_PENCE.smsInbound +
        3 * COST_PENCE.missedCall,
    );
  });
});

describe("buildTextBackMessage", () => {
  it("includes the business name", () => {
    expect(buildTextBackMessage("Acme Plumbing")).toContain("Acme Plumbing");
  });
  it("falls back to a generic name", () => {
    expect(buildTextBackMessage("")).toContain("the team");
  });
});

describe("classifyInboundKeyword", () => {
  it("detects STOP / HELP / START / replies", () => {
    expect(classifyInboundKeyword("STOP")).toBe("stop");
    expect(classifyInboundKeyword(" stop ")).toBe("stop");
    expect(classifyInboundKeyword("unsubscribe")).toBe("stop");
    expect(classifyInboundKeyword("HELP")).toBe("help");
    expect(classifyInboundKeyword("START")).toBe("start");
    expect(classifyInboundKeyword("My tap is leaking")).toBe("reply");
  });
});

describe("resolveClinicByPhoneNumber", () => {
  it("maps a phone_numbers row to a resolved tenant", async () => {
    const { admin } = makeAdmin((ctx) => {
      if (ctx.table === "phone_numbers") {
        return {
          data: {
            id: "pn_1",
            clinic_id: "clinic_1",
            provider: "twilio",
            e164_number: "+441174960000",
            label: "Main line",
          },
        };
      }
      return { data: null };
    });

    const resolved = await resolveClinicByPhoneNumber(admin, "+441174960000");
    expect(resolved).toEqual({
      phoneNumberId: "pn_1",
      clinicId: "clinic_1",
      provider: "twilio",
      e164Number: "+441174960000",
      label: "Main line",
    });
  });

  it("returns null for an unknown number", async () => {
    const { admin } = makeAdmin(() => ({ data: null }));
    expect(await resolveClinicByPhoneNumber(admin, "+440000000000")).toBeNull();
    expect(await resolveClinicByPhoneNumber(admin, null)).toBeNull();
  });
});

describe("recordMissedCall", () => {
  it("inserts a missed call and returns its id", async () => {
    const { admin, writes } = makeAdmin((ctx) =>
      ctx.table === "missed_calls" && ctx.op === "insert"
        ? { data: { id: "mc_1" } }
        : { data: null },
    );

    const id = await recordMissedCall(admin, {
      clinicId: "clinic_1",
      phoneNumberId: "pn_1",
      provider: "twilio",
      providerCallId: "CA1",
      fromE164: "+447700900123",
      toE164: "+441174960000",
      status: "missed",
    });

    expect(id).toBe("mc_1");
    const insert = writes.find((w) => w.table === "missed_calls");
    expect((insert?.values as { status: string }).status).toBe("missed");
  });
});

describe("createOrUpdateEnquiryFromSms", () => {
  it("creates a new enquiry and links it to the conversation", async () => {
    const { admin, writes } = makeAdmin((ctx) =>
      ctx.table === "enquiries" && ctx.op === "insert"
        ? { data: { id: "enq_1" } }
        : { data: null },
    );

    const conversation: Conversation = {
      id: "conv_1",
      clinic_id: "clinic_1",
      enquiry_id: null,
      status: "replied",
    };

    const enquiryId = await createOrUpdateEnquiryFromSms(admin, {
      clinicId: "clinic_1",
      conversation,
      customerE164: "+447700900123",
      body: "Leaking tap in the kitchen",
    });

    expect(enquiryId).toBe("enq_1");

    const enquiryInsert = writes.find((w) => w.table === "enquiries");
    expect((enquiryInsert?.values as { phone: string }).phone).toBe(
      "+447700900123",
    );
    expect((enquiryInsert?.values as { status: string }).status).toBe("new");

    // Conversation linked back to the new enquiry.
    const convoUpdate = writes.find(
      (w) => w.table === "sms_conversations" && w.op === "update",
    );
    expect((convoUpdate?.values as { enquiry_id: string }).enquiry_id).toBe(
      "enq_1",
    );
  });

  it("updates the existing enquiry when the conversation already has one", async () => {
    const { admin, writes } = makeAdmin(() => ({ data: null }));
    const conversation: Conversation = {
      id: "conv_1",
      clinic_id: "clinic_1",
      enquiry_id: "enq_existing",
      status: "replied",
    };

    const enquiryId = await createOrUpdateEnquiryFromSms(admin, {
      clinicId: "clinic_1",
      conversation,
      customerE164: "+447700900123",
      body: "Following up",
    });

    expect(enquiryId).toBe("enq_existing");
    expect(writes.some((w) => w.table === "enquiries" && w.op === "update")).toBe(
      true,
    );
    expect(writes.some((w) => w.table === "enquiries" && w.op === "insert")).toBe(
      false,
    );
  });
});

describe("sendMissedCallTextBack", () => {
  it("opens a conversation, sends the SMS, and records it", async () => {
    const { admin, writes } = makeAdmin((ctx) => {
      if (ctx.table === "sms_conversations" && ctx.op === "insert") {
        return {
          data: {
            id: "conv_1",
            clinic_id: "clinic_1",
            enquiry_id: null,
            status: "awaiting_reply",
          },
        };
      }
      if (ctx.table === "clinics") {
        return { data: { name: "Acme Plumbing" } };
      }
      return { data: null };
    });

    const provider = new TestTelephonyProvider();

    const result = await sendMissedCallTextBack(admin, provider, {
      clinicId: "clinic_1",
      customerE164: "+447700900123",
      phoneNumberId: "pn_1",
      fromE164: "+441174960000",
      missedCallId: "mc_1",
    });

    expect(result.ok).toBe(true);
    // One SMS sent through the provider, to the caller, mentioning the business.
    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0].to).toBe("+447700900123");
    expect(provider.sent[0].body).toContain("Acme Plumbing");
    // Outbound message persisted.
    expect(
      writes.some((w) => w.table === "sms_messages" && w.op === "insert"),
    ).toBe(true);
  });
});
