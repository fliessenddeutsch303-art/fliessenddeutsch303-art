import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const cookieStore = await cookies();
  const sessionKey = cookieStore.get("fd_session_key")?.value;
  if (auth.user && sessionKey) {
    await createSupabaseAdminClient().from("account_active_sessions").delete().eq("user_id", auth.user.id).eq("session_key", sessionKey);
  }
  cookieStore.delete("fd_session_key");
  cookieStore.delete("fd_local_user_id");
  cookieStore.delete("fd_local_user_email");
  cookieStore.delete("fd_local_role");
  await supabase.auth.signOut();
  // 303 turns the POST into a GET for the login page.
  return NextResponse.redirect(new URL("/login", request.url), 303);
}
