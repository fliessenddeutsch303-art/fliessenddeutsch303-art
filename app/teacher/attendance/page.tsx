import { DataTable } from "@/components/tables/data-table";
import { getCurrentUser } from "@/lib/auth";

export default async function TeacherAttendanceSelfPage() {
  const { supabase, profile } = await getCurrentUser("teacher");
  const { data: teacher } = await supabase.from("teachers").select("id").eq("user_id", profile.id).maybeSingle();
  if (!teacher) return <p className="rounded-md border bg-white p-6 text-sm text-muted-foreground">Your login is not linked to a teacher record yet. Ask the admin to open Account Center and save your account.</p>;
  const { data } = await supabase.from("teacher_attendance").select("id,date,check_in,check_out,sessions_count,notes").eq("teacher_id", teacher.id).order("date", { ascending: false });
  return <DataTable rows={(data ?? []) as unknown as Record<string, unknown>[]} columns={[{ key: "date", header: "Date" }, { key: "check_in", header: "Check in" }, { key: "check_out", header: "Check out" }, { key: "sessions_count", header: "Sessions" }, { key: "notes", header: "Notes" }]} />;
}
