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

// account payroll settings -> teachers row
export function teacherPay(employee: EmployeePayroll) {
  if (employee.payroll_type === "hourly") return { pay_type: "hourly", base_rate: Number(employee.hourly_rate ?? 0) };
  // per-session rate lives in hourly_rate
  if (employee.payroll_type === "per_session") return { pay_type: "per_session", base_rate: Number(employee.hourly_rate ?? 0) };
  if (employee.payroll_type === "monthly_wage") return { pay_type: "fixed", base_rate: Number(employee.monthly_wage ?? 0) };
  return { pay_type: "fixed", base_rate: Number(employee.monthly_salary ?? 0) };
}

// keeps the teachers row in sync with the login. updateExisting: false only creates missing rows
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
