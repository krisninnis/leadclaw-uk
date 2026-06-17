// ClawLabsLocal — Landing Page Builder (Phase A)
// Server-only page guard for the admin landing-page screens. Mirrors the exact
// admin check used by src/app/admin/lead-finder/page.tsx (ADMIN_EMAILS
// allowlist OR profiles.role = 'admin'). Not a route — just a colocated module.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type ProfileRow = { role: string | null };

export type AdminPageUser = { id: string; email: string | null };

export async function requireAdminPageUser(): Promise<AdminPageUser> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const emailIsAdmin =
    !!user.email && adminEmails.includes(user.email.toLowerCase());
  const role = (profile as ProfileRow | null)?.role;

  if (role !== "admin" && !emailIsAdmin) redirect("/portal");

  return { id: user.id, email: user.email ?? null };
}
