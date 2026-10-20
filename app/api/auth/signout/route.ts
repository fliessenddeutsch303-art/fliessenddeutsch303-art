import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const sessionKey = (await cookies()).get("fd_session_key")?.value;
  if (auth.user && sessionKey) {
    await createSupabaseAdminClient().from("account_active_sessions").delete().eq("user_id", auth.user.id).eq("session_key", sessionKey);
  }
  (await cookies()).delete("fd_session_key");
  await supabase.auth.signOut();
  redirect("/login");
}
