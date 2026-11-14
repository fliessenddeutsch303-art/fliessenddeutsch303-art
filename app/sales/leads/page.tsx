import { LeadBoard } from "@/components/forms/lead-board";
import { getCurrentUser } from "@/lib/auth";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { hasSupabaseEnv } from "@/lib/env";

export default async function SalesLeadsPage() {
  const { supabase, profile } = await getCurrentUser("sales");
  const files = (profile.permissions?.assigned_files ?? []).filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  // Leads without a file stay visible; the demo store has no .or().
  const { data } = await fetchAll((from, to) => { const base = supabase.from("leads").select("id,full_name,phone,source,tags,status,assigned_to,created_at,converted_to_student_id,crm_data,lead_interactions(id,note,created_at,users(full_name))").eq("assigned_to", profile.id); return (hasSupabaseEnv() ? base.or(files.length ? `file_id.is.null,file_id.in.(${files.join(",")})` : "file_id.is.null") : base.in("file_id", profile.permissions?.assigned_files ?? [])).order("created_at", { ascending: false }).order("created_at", { referencedTable: "lead_interactions", ascending: false }).order("id").range(from, to); });
  return <LeadBoard initialLeads={(data ?? []) as never} currentUserId={profile.id} />;
}
