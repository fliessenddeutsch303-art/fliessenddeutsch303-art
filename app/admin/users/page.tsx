import { EmployeeForm } from "@/components/forms/employee-form";
import { EmployeeProfilesManager } from "@/components/forms/employee-profiles-manager";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentLanguage } from "@/lib/i18n-server";

export default async function UsersPage() {
  const { supabase } = await getCurrentUser("admin");
  const lang = await getCurrentLanguage();
  const [employees, files, profiles] = await Promise.all([
    supabase.from("users").select("id,full_name,email,role,is_active,permissions,payroll_type,monthly_salary,monthly_wage,hourly_rate").order("created_at", { ascending: false }),
    supabase.from("lead_files").select("id,name").order("upload_date", { ascending: false }),
    supabase.from("employee_profiles").select("*").order("created_at", { ascending: false }),
  ]);
  return <div className="space-y-8"><EmployeeForm employees={employees.data ?? []} leadFiles={files.data ?? []} /><EmployeeProfilesManager initialProfiles={profiles.data ?? []} accounts={employees.data ?? []} lang={lang} /></div>;
}
