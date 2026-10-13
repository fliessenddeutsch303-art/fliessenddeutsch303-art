import type { SupabaseClient } from "@supabase/supabase-js";

type EmployeePayroll = {
  id: string;
  full_name: string;
  role: string;
  payroll_type?: string | null;
  monthly_salary?: number | null;
  monthly_wage?: number | null;
  hourly_rate?: number | null;
};

/** Keep the login account and the teacher record in sync. Classes reference teachers, not users. */
export async function ensureTeacherProfile(supabase: SupabaseClient, employee: EmployeePayroll) {
  if (employee.role !== "teacher") return { data: null, error: null };

  const payType = employee.payroll_type === "hourly" ? "hourly" : "fixed";
  const baseRate = employee.payroll_type === "hourly"
    ? Number(employee.hourly_rate ?? 0)
    : Number(employee.monthly_salary ?? employee.monthly_wage ?? 0);
  const existing = await supabase.from("teachers").select("id").eq("user_id", employee.id).maybeSingle();
  if (existing.error) return existing;

  if (existing.data?.id) {
    return supabase.from("teachers").update({ name: employee.full_name, pay_type: payType, base_rate: baseRate }).eq("id", existing.data.id).select("id").single();
  }

  return supabase.from("teachers").insert({ user_id: employee.id, name: employee.full_name, pay_type: payType, base_rate: baseRate }).select("id").single();
}
