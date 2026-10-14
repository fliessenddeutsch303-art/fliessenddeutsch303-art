import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user) await createSupabaseAdminClient().from("account_active_sessions").delete().eq("user_id", auth.user.id);
  await supabase.auth.signOut();
  redirect("/login");
}
