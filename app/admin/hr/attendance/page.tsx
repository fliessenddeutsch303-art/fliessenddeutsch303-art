import { TeacherAttendanceForm } from "@/components/forms/attendance-forms";
import { getCurrentUser } from "@/lib/auth";

export default async function AdminTeacherAttendancePage() {
  const { supabase, profile } = await getCurrentUser("admin");
  const [teachers, employees, classes] = await Promise.all([
    supabase.from("teachers").select("id,name,pay_type").order("name"),
    supabase.from("employee_profiles").select("id,full_name,role,payroll_type,account_user_id").eq("is_active", true).neq("role", "teacher").order("full_name"),
    supabase.from("classes").select("id,name,teacher_id,session_hours,schedule").order("name"),
  ]);
  return <TeacherAttendanceForm teachers={teachers.data ?? []} employees={employees.data ?? []} classes={classes.data ?? []} recordedBy={profile.id} />;
}
