import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type AuthedUser = {
  id: string;
  email: string | null;
};

function jsonError(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function requireUser(): Promise<
  { ok: true; user: AuthedUser } | { ok: false; response: NextResponse }
> {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      ok: false,
      response: jsonError("unauthorized", 401),
    };
  }

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email ?? null,
    },
  };
}

export async function requireAdmin(): Promise<
  { ok: true; user: AuthedUser } | { ok: false; response: NextResponse }
> {
  const authed = await requireUser();

  if (!authed.ok) {
    return authed;
  }

  const adminEmails = getAdminEmails();
  const email = authed.user.email?.toLowerCase() ?? "";

  if (!email || !adminEmails.includes(email)) {
    return {
      ok: false,
      response: jsonError("forbidden", 403),
    };
  }

  return authed;
}
