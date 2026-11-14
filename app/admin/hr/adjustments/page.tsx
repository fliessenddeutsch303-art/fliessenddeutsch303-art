import { AdjustmentForm } from "@/components/forms/simple-record-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/tables/data-table";
import { getCurrentUser } from "@/lib/auth";
import { fetchAll } from "@/lib/supabase/fetch-all";

export default async function AdjustmentsPage() {
  const { supabase } = await getCurrentUser("admin");
  const [teachers, profiles, users, teacherAdjustments, employeeAdjustments, allProfiles, allUsers] = await Promise.all([
    supabase.from("teachers").select("id,name").order("name"),
    supabase.from("employee_profiles").select("id,full_name,role,account_user_id").eq("is_active", true).neq("role", "teacher").order("full_name"),
    supabase.from("users").select("id,full_name,role").eq("is_active", true).neq("role", "teacher").order("full_name"),
    fetchAll((from, to) => supabase.from("teacher_adjustments").select("id,teacher_id,type,amount,reason,period_start,period_end,created_at").order("created_at", { ascending: false }).order("id").range(from, to)),
    fetchAll((from, to) => supabase.from("employee_adjustments").select("id,user_id,employee_profile_id,type,amount,reason,period_start,period_end,created_at").order("created_at", { ascending: false }).order("id").range(from, to)),
    supabase.from("employee_profiles").select("id,full_name"),
    supabase.from("users").select("id,full_name"),
  ]);
  const profileRows = profiles.data ?? [];
  const profiledAccounts = new Set(profileRows.map((profile) => profile.account_user_id));
  const targets = [
    ...profileRows.map((profile) => ({ id: profile.id, name: profile.full_name, kind: "profile" as const, account_user_id: profile.account_user_id })),
    ...(users.data ?? []).filter((user) => !profiledAccounts.has(user.id)).map((user) => ({ id: user.id, name: user.full_name, kind: "user" as const })),
    ...(teachers.data ?? []).map((teacher) => ({ id: teacher.id, name: teacher.name, kind: "teacher" as const })),
  ];
  const nameOf = (row: { teacher_id?: string | null; employee_profile_id?: string | null; user_id?: string | null }) =>
    (teachers.data ?? []).find((item) => item.id === row.teacher_id)?.name
    ?? (allProfiles.data ?? []).find((item) => item.id === row.employee_profile_id)?.full_name
    ?? (allUsers.data ?? []).find((item) => item.id === row.user_id)?.full_name
    ?? "";
  const rows = [...(teacherAdjustments.data ?? []), ...(employeeAdjustments.data ?? [])]
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .map((row) => ({ id: row.id, employee: nameOf(row), type: row.type, amount: row.amount, reason: row.reason, period_start: row.period_start, period_end: row.period_end }));
  return <div className="space-y-6"><AdjustmentForm targets={targets} /><Card><CardHeader><CardTitle>Adjustments</CardTitle></CardHeader><CardContent><DataTable rows={rows} columns={[{ key: "employee", header: "Employee" }, { key: "type", header: "Type" }, { key: "amount", header: "Amount" }, { key: "reason", header: "Reason" }, { key: "period_start", header: "Start" }, { key: "period_end", header: "End" }]} /></CardContent></Card></div>;
}
