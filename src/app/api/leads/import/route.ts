import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

const leadSchema = z.object({
  niche: z.string().min(2),
  company_name: z.string().min(2),
  website: z.string().optional(),
  contact_email: z.string().email().optional().or(z.literal("")),
  contact_phone: z.string().optional(),
  city: z.string().optional(),
  source: z.string().min(2),
  notes: z.string().optional(),
});

function scoreLead(input: z.infer<typeof leadSchema>) {
  let score = 0;
  if (input.website) score += 20;
  if (input.contact_email) score += 20;
  if (input.contact_phone) score += 20;
  if (input.city) score += 10;
  if (
    ["aesthetics", "trades", "estate"].some((n) =>
      input.niche.toLowerCase().includes(n),
    )
  )
    score += 20;
  if (input.source.toLowerCase().includes("google")) score += 10;
  return Math.min(score, 100);
}

export async function POST(req: Request) {
  const authed = await requireAdmin();
  if (!authed.ok) return authed.response;

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "supabase_not_configured" },
      { status: 400 },
    );
  }

  try {
    const body = (await req.json()) as { leads?: unknown[] };
    const rows = z.array(leadSchema).parse(body.leads || []);

    const payload = rows.map((r) => ({
      ...r,
      contact_email: r.contact_email || null,
      score: scoreLead(r),
    }));

    const { error } = await admin.from("leads").insert(payload);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, inserted: payload.length });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "invalid_payload";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
