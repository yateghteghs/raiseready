import { createClient } from "@supabase/supabase-js";

import { isSupabaseConfigured } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Anonymous Supabase client for public pages. Uses no cookies, so pages that
 * read with it can be cached; RLS limits it to public data.
 */
export function createPublicClient() {
  if (!isSupabaseConfigured()) return null;
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
