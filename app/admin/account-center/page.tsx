import { EmployeeForm } from "@/components/forms/employee-form";
import { getCurrentUser } from "@/lib/auth";
import { ensureTeacherProfile } from "@/lib/teacher-profile";

export default async function AccountCenterPage() {
  const { supabase } = await getCurrentUser("admin");
  const [employees, files] = await Promise.all([
    supabase.from("users").select("id,full_name,email,role,is_active,permissions,payroll_type,monthly_salary,monthly_wage,hourly_rate").order("created_at", { ascending: false }),
    supabase.from("lead_files").select("id,name").order("upload_date", { ascending: false }),
  ]);
  await Promise.all((employees.data ?? []).filter((employee) => employee.role === "teacher").map((employee) => ensureTeacherProfile(supabase, employee)));
  return <EmployeeForm employees={employees.data ?? []} leadFiles={files.data ?? []} />;
}
