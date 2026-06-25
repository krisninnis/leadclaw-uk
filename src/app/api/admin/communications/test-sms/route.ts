import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  sendSms,
  type CommunicationProvider,
  type CommunicationResult,
} from "@/lib/communications";
import { getSmsProviderName, smsProviderId } from "@/lib/communications/config";
import { isValidE164, normalisePhoneNumber } from "@/lib/telephony/phone";

export const runtime = "nodejs";

const DEFAULT_TEST_MESSAGE =
  "LeadClaw SMS test: your communications layer is working.";

type TestSmsBody = {
  to?: unknown;
  message?: unknown;
};

function currentSmsProvider(): CommunicationProvider {
  return smsProviderId(getSmsProviderName()) ?? "mock";
}

function invalidRecipientResult(): CommunicationResult {
  return {
    ok: false,
    channel: "sms",
    provider: currentSmsProvider(),
    error: "invalid_recipient",
  };
}

function sanitiseResult(result: CommunicationResult): CommunicationResult {
  if (result.ok) return result;

  return {
    ok: false,
    channel: result.channel,
    provider: result.provider,
    error: result.error,
  };
}

async function readBody(request: Request): Promise<TestSmsBody | null> {
  try {
    const body = (await request.json()) as unknown;
    return body && typeof body === "object" ? (body as TestSmsBody) : {};
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const authed = await requireAdmin();
  if (!authed.ok) return authed.response;

  const body = await readBody(request);
  if (body === null) {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    );
  }

  const to = normalisePhoneNumber(
    typeof body.to === "string" ? body.to : null,
  );

  if (!to || !isValidE164(to)) {
    return NextResponse.json(invalidRecipientResult(), { status: 400 });
  }

  const message =
    typeof body.message === "string" && body.message.trim()
      ? body.message.trim().slice(0, 500)
      : DEFAULT_TEST_MESSAGE;

  const result = await sendSms({
    to,
    body: message,
    context: {
      metadata: {
        source: "admin_sms_test",
        requestedBy: authed.user.id,
      },
    },
  });

  return NextResponse.json(sanitiseResult(result));
}
