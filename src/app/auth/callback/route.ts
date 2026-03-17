import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function normalizeNext(value: string | null) {
  if (!value || !value.startsWith("/")) return "/portal";
  return value;
}

function normalizePlan(value: string | null) {
  if (value === "starter") return "starter";
  if (value === "pro") return "pro";
  return "growth";
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = normalizeNext(searchParams.get("next"));

  const supabase = await createClient();

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  const nextUrl = new URL(next, origin);
  const shouldStartTrial = nextUrl.searchParams.get("startTrial") === "1";
  const selectedPlan = normalizePlan(nextUrl.searchParams.get("plan"));

  if (shouldStartTrial) {
    try {
      await fetch(`${origin}/api/trial/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: request.headers.get("cookie") || "",
        },
        body: JSON.stringify({ plan: selectedPlan }),
      });
    } catch {
      // fail quietly and continue redirecting
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
