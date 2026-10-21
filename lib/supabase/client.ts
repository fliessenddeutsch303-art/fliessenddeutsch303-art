"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createLocalSupabaseClient } from "@/lib/local-db";
import { createOfflineFetch } from "@/lib/offline-write-queue";

export function createSupabaseBrowserClient(): SupabaseClient {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return createLocalSupabaseClient() as unknown as SupabaseClient;
  }
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { fetch: createOfflineFetch(window.fetch.bind(window)) },
  });
}
