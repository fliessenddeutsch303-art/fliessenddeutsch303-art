import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LeadBoard } from "@/components/forms/lead-board";
import { getCurrentUser } from "@/lib/auth";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { academyDayStartIso, academyDaysAgo, academyMonthStart } from "@/lib/dates";

export default async function AdminSalesPage() {
  const { supabase, profile } = await getCurrentUser("admin");
  const weekStart = academyDayStartIso(academyDaysAgo(6));
  const monthStart = academyDayStartIso(academyMonthStart());
  const [leads, reps, interactions, bookings] = await Promise.all([
    fetchAll((from, to) => supabase.from("leads").select("id,full_name,phone,source,tags,status,assigned_to,created_at,converted_to_student_id,crm_data,lead_interactions(id,note,created_at,users(full_name))").order("created_at", { ascending: false }).order("created_at", { referencedTable: "lead_interactions", ascending: false }).order("id").range(from, to)),
    supabase.from("users").select("id,full_name,is_active").eq("role", "sales").order("full_name"),
    fetchAll<{ created_by: string | null }>((from, to) => supabase.from("lead_interactions").select("created_by,created_at").gte("created_at", weekStart).order("id").range(from, to)),
    fetchAll<{ assigned_to: string | null }>((from, to) => supabase.from("leads").select("assigned_to,booked_at").gte("booked_at", monthStart).order("id").range(from, to)),
  ]);
  // Inactive reps only appear while leads are still assigned to them.
  const withLeads = new Set(((leads.data ?? []) as Array<{ assigned_to?: string | null }>).map((lead) => lead.assigned_to));
  const shownReps = ((reps.data ?? []) as Array<{ id: string; full_name: string; is_active: boolean }>).filter((rep) => rep.is_active || withLeads.has(rep.id)).map((rep) => ({ ...rep, full_name: rep.is_active ? rep.full_name : `${rep.full_name} (inactive)` }));
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">{shownReps.map((rep) => <Card key={rep.id}><CardHeader><CardTitle className="text-base">{rep.full_name}</CardTitle></CardHeader><CardContent className="text-sm"><p>{interactions.data?.filter((i) => i.created_by === rep.id).length ?? 0} interactions this week</p><p>{bookings.data?.filter((b) => b.assigned_to === rep.id).length ?? 0} bookings this month</p></CardContent></Card>)}</div>
      <LeadBoard initialLeads={(leads.data ?? []) as never} currentUserId={profile.id} canAssign reps={shownReps as never} />
    </div>
  );
}
