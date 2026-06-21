import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  fetchSite,
  normalizeAuditUrl,
  UrlValidationError,
} from "@/lib/audit/fetch-site";
import { parseHtml } from "@/lib/audit/parse-html";
import { detectIndustry, detectPlatform } from "@/lib/onboarding-wizard";

export const runtime = "nodejs";

const schema = z.object({
  url: z.string().min(3).max(2048),
});

function decodeEntities(input: string): string {
  return input
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .trim();
}

function firstMatch(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m && m[1] ? decodeEntities(m[1].trim()) : null;
}

// Strip common "| Brand", "- Tagline" suffixes from <title> to get a name.
function cleanBusinessName(raw: string): string {
  let name = raw.split(/\s+[|–—\-:]\s+/)[0].trim();
  if (name.length < 2) name = raw.trim();
  return name.slice(0, 120);
}

function detectBusinessName(html: string): string | null {
  const ogSiteName = firstMatch(
    html,
    /<meta[^>]+property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i,
  );
  if (ogSiteName) return cleanBusinessName(ogSiteName);

  const schemaName = firstMatch(html, /"name"\s*:\s*"([^"]{2,120})"/i);
  const title = firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title) return cleanBusinessName(title);
  if (schemaName) return cleanBusinessName(schemaName);
  return null;
}

function detectEmail(html: string): string | null {
  const mailto = firstMatch(html, /mailto:([^"'?\s>]+@[^"'?\s>]+)/i);
  if (mailto) return mailto.toLowerCase();
  const inline = firstMatch(
    html,
    /([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i,
  );
  return inline ? inline.toLowerCase() : null;
}

// Pull candidate services from nav links + H2 headings.
function detectServices(html: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (raw: string) => {
    const value = decodeEntities(raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).trim();
    const key = value.toLowerCase();
    if (
      value.length >= 3 &&
      value.length <= 40 &&
      !seen.has(key) &&
      /[a-z]/i.test(value) &&
      !/^(home|about|contact|blog|news|login|menu|services|gallery|reviews|faq|book|booking|privacy|terms|cookie)s?$/i.test(value)
    ) {
      seen.add(key);
      out.push(value);
    }
  };

  // Headings first — usually the strongest signal.
  const h2Re = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  let m: RegExpExecArray | null;
  while ((m = h2Re.exec(html)) !== null && out.length < 12) push(m[1]);

  // Then nav anchor text.
  const navRe = /<a[^>]*href=["'][^"']*(?:service|treatment)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
  while ((m = navRe.exec(html)) !== null && out.length < 12) push(m[1]);

  return out.slice(0, 8);
}

export async function POST(req: Request) {
  // Require an authenticated user — this is part of signed-in onboarding.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "not_authenticated" },
      { status: 401 },
    );
  }

  let parsed: { url: string };
  try {
    parsed = schema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_request" },
      { status: 400 },
    );
  }

  let normalizedUrl: string;
  try {
    normalizedUrl = normalizeAuditUrl(parsed.url).url;
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_url",
        message:
          err instanceof UrlValidationError
            ? err.message
            : "That does not look like a valid website URL.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await fetchSite(normalizedUrl);

    if (!result.ok || !result.html) {
      // Graceful fallback: site unreachable / thin. User fills in manually.
      return NextResponse.json({
        ok: true,
        reachable: false,
        detected: {
          businessName: null,
          industry: null,
          platform: null,
          services: [],
          phone: null,
          email: null,
        },
      });
    }

    const signals = parseHtml(result.html, result.finalUrl);
    const text = result.html.replace(/<[^>]+>/g, " ");

    return NextResponse.json({
      ok: true,
      reachable: true,
      detected: {
        businessName: detectBusinessName(result.html),
        industry: detectIndustry(`${signals.title || ""} ${text}`),
        platform: detectPlatform(result.html),
        services: detectServices(result.html),
        phone: signals.phoneSample,
        email: detectEmail(result.html),
      },
    });
  } catch (err) {
    if (err instanceof UrlValidationError) {
      return NextResponse.json(
        { ok: false, error: "invalid_url", message: err.message },
        { status: 400 },
      );
    }
    console.error("[onboarding.analyze] failed", err);
    return NextResponse.json(
      { ok: true, reachable: false, detected: {
        businessName: null, industry: null, platform: null,
        services: [], phone: null, email: null,
      } },
    );
  }
}
