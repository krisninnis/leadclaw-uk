import { createBrowserClient } from "@supabase/ssr";

// Store the client globally to avoid re-creating it on every call
let client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  // If the client already exists, return it
  if (client) return client;

  // Initialize Supabase client with URL and Anon key
  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  // Return the initialized client
  return client;
}
