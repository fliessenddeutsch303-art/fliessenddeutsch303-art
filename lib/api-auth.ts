import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/env";
import { createLocalSupabaseClient, localProfile } from "@/lib/local-db";
import type { Role, UserProfile } from "@/lib/types";

type ApiAuth =
  | { ok: true; supabase: SupabaseClient; profile: UserProfile }
  | { ok: false; response: NextResponse };

// like getCurrentUser, but returns JSON 401/403 instead of redirecting
export async function requireApiUser(roles?: Role[]): Promise<ApiAuth> {
  if (!hasSupabaseEnv()) {
    const cookieStore = await cookies();
    const role = (cookieStore.get("fd_local_role")?.value as Role | undefined) ?? roles?.[0] ?? "admin";
    const profile = localProfile(role, cookieStore.get("fd_local_user_id")?.value);
    if (roles && !roles.includes(profile.role)) return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    return { ok: true, supabase: createLocalSupabaseClient() as unknown as SupabaseClient, profile };
  }
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: profile } = await supabase.from("users").select("*").eq("id", auth.user.id).maybeSingle();
  if (!profile || !profile.is_active) return { ok: false, response: NextResponse.json({ error: "This account is deactivated." }, { status: 401 }) };
  const typed = profile as UserProfile;
  if (roles && !roles.includes(typed.role)) return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { ok: true, supabase, profile: typed };
}
