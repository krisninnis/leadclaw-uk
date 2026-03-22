import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClientIp } from "@/lib/rate-limit";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const schema = z.object({
  email: z.string().email().max(255),
  plan: z.enum(["growth", "pro"]),
  source: z.string().max(50).optional().default("pricing"),
});

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, "1 h"),
});

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const { success } = await ratelimit.limit(`early-access:${ip}`);

  if (!success) {
    return NextResponse.json(
      { ok: false, error: "rate_limit_exceeded" },
      { status: 429 },
    );
  }

  try {
    const body = await req.json();
    const parsed = schema.parse(body);

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: "db_not_configured" },
        { status: 500 },
      );
    }

    // Upsert — don't create duplicates
    const { error } = await admin.from("early_access_signups").upsert(
      {
        email: parsed.email.toLowerCase().trim(),
        requested_plan: parsed.plan,
        source: parsed.source,
      },
      { onConflict: "email" },
    );

    if (error) {
      return NextResponse.json(
        { ok: false, error: "db_error" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: "invalid_request" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { ok: false, error: "unexpected_error" },
      { status: 500 },
    );
  }
}
