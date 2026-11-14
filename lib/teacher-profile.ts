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

/** Account Center payroll settings -> teachers.pay_type / base_rate (payroll reads the teachers row). */
export function teacherPay(employee: EmployeePayroll) {
  if (employee.payroll_type === "hourly") return { pay_type: "hourly", base_rate: Number(employee.hourly_rate ?? 0) };
  // Per-session rate is stored in hourly_rate on the account.
  if (employee.payroll_type === "per_session") return { pay_type: "per_session", base_rate: Number(employee.hourly_rate ?? 0) };
  if (employee.payroll_type === "monthly_wage") return { pay_type: "fixed", base_rate: Number(employee.monthly_wage ?? 0) };
  return { pay_type: "fixed", base_rate: Number(employee.monthly_salary ?? 0) };
}

/**
 * Keep the login account and the teacher record in sync. Classes reference teachers, not users.
 * With `updateExisting: false` only missing teacher rows are created, so page loads never overwrite pay settings.
 */
export async function ensureTeacherProfile(supabase: SupabaseClient, employee: EmployeePayroll, { updateExisting = true } = {}) {
  if (employee.role !== "teacher") return { data: null, error: null };

  const pay = teacherPay(employee);
  const existing = await supabase.from("teachers").select("id").eq("user_id", employee.id).maybeSingle();
  if (existing.error) return existing;

  if (existing.data?.id) {
    if (!updateExisting) return existing;
    return supabase.from("teachers").update({ name: employee.full_name, ...pay }).eq("id", existing.data.id).select("id").single();
  }

  return supabase.from("teachers").insert({ user_id: employee.id, name: employee.full_name, ...pay }).select("id").single();
}
