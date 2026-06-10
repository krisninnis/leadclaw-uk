import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type AdminClient = ReturnType<typeof createClient>;

export function createAdminClient(): AdminClient;
export function createAdminClient(options: { optional: true }): AdminClient | null;
export function createAdminClient(options?: { optional?: boolean }) {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    if (options?.optional) return null;
    return null as unknown as AdminClient;
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey);
}
