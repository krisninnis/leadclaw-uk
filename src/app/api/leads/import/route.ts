import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

type ExistingLeadRow = {
  id: string;
  company_name: string | null;
  city: string | null;
  website: string | null;
  contact_email: string | null;
};

const leadSchema = z.object({
  niche: z.string().min(2),
  company_name: z.string().min(2),
  website: z.string().optional().or(z.literal("")),
  contact_email: z.string().email().optional().or(z.literal("")),
  contact_phone: z.string().optional(),
  city: z.string().optional(),
  source: z.string().min(2),
  notes: z.string().optional(),
});

function normalizeEmail(raw: unknown) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/^mailto:/, "");
}

function normalizeWebsite(raw: unknown) {
  const value = String(raw || "").trim();
  if (!value) return "";

  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function normalizeText(raw: unknown) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function leadKey(input: {
  company_name?: string | null;
  city?: string | null;
  website?: string | null;
  contact_email?: string | null;
}) {
  const website = normalizeWebsite(input.website);
  const email = normalizeEmail(input.contact_email);

  if (website) return `website:${website}`;
  if (email) return `email:${email}`;
  return `name_city:${normalizeText(input.company_name)}|${normalizeText(input.city)}`;
}

function tokenFromRequest(req: Request) {
  const explicitToken = req.headers.get("x-lead-import-token")?.trim();
  if (explicitToken) return explicitToken;

  const auth = req.headers.get("authorization")?.trim() || "";
  const bearer = auth.match(/^Bearer\s+(.+)$/i);
  return bearer?.[1]?.trim() || "";
}

async function authorizeImport(req: Request) {
  const suppliedToken = tokenFromRequest(req);
  const expectedToken = process.env.LEAD_IMPORT_TOKEN?.trim();

  if (suppliedToken || req.headers.get("x-lead-import-token")) {
    if (expectedToken && suppliedToken === expectedToken) {
      return { ok: true as const, method: "token" };
    }

    console.warn("[leads.import] unauthorized token import attempt", {
      tokenConfigured: expectedToken ? "yes" : "no",
      authHeaderPresent: req.headers.get("authorization") ? "yes" : "no",
      importTokenHeaderPresent: req.headers.get("x-lead-import-token")
        ? "yes"
        : "no",
    });

    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 },
      ),
    };
  }

  const authed = await requireAdmin();
  if (!authed.ok) return authed;

  return { ok: true as const, method: "admin" };
}

function scoreLead(input: z.infer<typeof leadSchema>) {
  let score = 0;
  if (input.website) score += 20;
  if (input.contact_email) score += 20;
  if (input.contact_phone) score += 20;
  if (input.city) score += 10;
  if (
    ["operations", "services", "trades", "estate", "agency", "consult"].some((n) =>
      input.niche.toLowerCase().includes(n),
    )
  )
    score += 20;
  if (input.source.toLowerCase().includes("google")) score += 10;
  return Math.min(score, 100);
}

export async function POST(req: Request) {
  const authed = await authorizeImport(req);
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

    const { data: existingRows, error: existingError } = await (
      admin as unknown as SupabaseUntypedClient
    )
      .from("leads")
      .select("id,company_name,city,website,contact_email")
      .limit(10000);

    if (existingError) {
      return NextResponse.json(
        { ok: false, error: existingError.message },
        { status: 500 },
      );
    }

    const seenKeys = new Set(
      ((existingRows || []) as ExistingLeadRow[]).map((lead) => leadKey(lead)),
    );
    const skipped: Array<{ company_name: string; reason: string }> = [];
    const payload = [];

    for (const row of rows) {
      const companyName = row.company_name.trim();
      const website = normalizeWebsite(row.website);
      const contactEmail = normalizeEmail(row.contact_email);
      const key = leadKey({
        ...row,
        company_name: companyName,
        website,
        contact_email: contactEmail,
      });

      if (!companyName) {
        skipped.push({ company_name: row.company_name, reason: "missing_company_name" });
        continue;
      }

      if (row.website && !website) {
        skipped.push({ company_name: companyName, reason: "invalid_website" });
        continue;
      }

      if (row.contact_email && !contactEmail) {
        skipped.push({ company_name: companyName, reason: "invalid_contact_email" });
        continue;
      }

      if (seenKeys.has(key)) {
        skipped.push({ company_name: companyName, reason: "duplicate" });
        continue;
      }

      seenKeys.add(key);
      payload.push({
        ...row,
        company_name: companyName,
        website: website || null,
        contact_email: contactEmail || null,
        score: scoreLead({ ...row, website, contact_email: contactEmail }),
        status: "new",
      });
    }

    if (payload.length === 0) {
      return NextResponse.json({
        ok: true,
        inserted: 0,
        skipped: skipped.length,
        skippedLeads: skipped,
        auth: authed.method,
      });
    }

    const { error } = await (admin as unknown as SupabaseUntypedClient).from("leads").insert(payload);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      inserted: payload.length,
      skipped: skipped.length,
      skippedLeads: skipped,
      auth: authed.method,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "invalid_payload";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
