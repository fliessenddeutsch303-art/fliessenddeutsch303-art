import type { SupabaseClient } from "@supabase/supabase-js";

export type PayslipRow = {
  kind: "teacher" | "worker";
  id: string;
  name: string;
  role: string;
  payType: string;
  hours: number;
  sessions: number;
  basePay: number;
  bonuses: number;
  deductions: number;
  net: number;
  notes: string[];
};

function hoursBetween(checkIn: string | null | undefined, checkOut: string | null | undefined) {
  if (!checkIn || !checkOut) return 0;
  const [ih, im] = checkIn.split(":").map(Number);
  const [oh, om] = checkOut.split(":").map(Number);
  return Math.max(0, ((oh * 60 + om) - (ih * 60 + im)) / 60);
}

export async function calculatePayslips(supabase: SupabaseClient, start: string, end: string): Promise<PayslipRow[]> {
  const [{ data: teachers }, { data: teacherAttendance }, { data: teacherAdjustments }, { data: users }, { data: profiles }, { data: employeeAdjustments }, { data: employeeAttendance }] = await Promise.all([
    supabase.from("teachers").select("*"),
    supabase.from("teacher_attendance").select("*").gte("date", start).lte("date", end),
    supabase.from("teacher_adjustments").select("*").gte("period_start", start).lte("period_end", end),
    supabase.from("users").select("id,full_name,role,payroll_type,monthly_salary,monthly_wage,hourly_rate,is_active").eq("is_active", true),
    supabase.from("employee_profiles").select("id,account_user_id,full_name,role,payroll_type,monthly_salary,monthly_wage,hourly_rate,is_active").eq("is_active", true),
    supabase.from("employee_adjustments").select("*").gte("period_start", start).lte("period_end", end),
    supabase.from("employee_attendance").select("*").gte("date", start).lte("date", end),
  ]);

  const teacherRows: PayslipRow[] = (teachers ?? []).map((teacher) => {
    const rows = (teacherAttendance ?? []).filter((row) => row.teacher_id === teacher.id);
    const hours = rows.reduce((sum, row) => sum + hoursBetween(row.check_in, row.check_out), 0);
    const sessions = rows.reduce((sum, row) => sum + Number(row.sessions_count ?? 0), 0);
    const basePay = teacher.pay_type === "hourly"
      ? hours * Number(teacher.base_rate)
      : teacher.pay_type === "per_session"
        ? sessions * Number(teacher.base_rate)
        : Number(teacher.base_rate);
    const adjustments = (teacherAdjustments ?? []).filter((row) => row.teacher_id === teacher.id);
    const bonuses = adjustments.filter((row) => row.type === "bonus").reduce((sum, row) => sum + Number(row.amount), 0);
    const deductions = adjustments.filter((row) => row.type === "deduction").reduce((sum, row) => sum + Number(row.amount), 0);
    return {
      kind: "teacher",
      id: teacher.id,
      name: teacher.name,
      role: "teacher",
      payType: teacher.pay_type,
      hours,
      sessions,
      basePay,
      bonuses,
      deductions,
      net: basePay + bonuses - deductions,
      notes: adjustments.map((row) => `${row.type}: ${row.reason} (${Number(row.amount)})`),
    };
  });

  const workerSource = (profiles?.length ? profiles : users ?? []).filter((worker) => worker.role !== "teacher");
  const workerRows: PayslipRow[] = workerSource.map((worker) => {
      const attendanceRows = (employeeAttendance ?? []).filter((row) => row.employee_profile_id === worker.id || (!row.employee_profile_id && row.user_id === worker.id));
      const hours = attendanceRows.reduce((sum, row) => sum + hoursBetween(row.check_in, row.check_out), 0);
      const basePay = worker.payroll_type === "hourly"
        ? hours * Number(worker.hourly_rate ?? 0)
        : worker.payroll_type === "monthly_wage"
          ? Number(worker.monthly_wage ?? 0)
          : Number(worker.monthly_salary ?? 0);
      const adjustments = (employeeAdjustments ?? []).filter((row) => row.employee_profile_id === worker.id || (!row.employee_profile_id && row.user_id === worker.id));
      const bonuses = adjustments.filter((row) => row.type === "bonus").reduce((sum, row) => sum + Number(row.amount), 0);
      const deductions = adjustments.filter((row) => row.type === "deduction").reduce((sum, row) => sum + Number(row.amount), 0);
      return {
        kind: "worker",
        id: worker.id,
        name: worker.full_name,
        role: worker.role,
        payType: worker.payroll_type ?? "monthly_salary",
        hours,
        sessions: 0,
        basePay,
        bonuses,
        deductions,
        net: basePay + bonuses - deductions,
        notes: adjustments.map((row) => `${row.type}: ${row.reason} (${Number(row.amount)})`),
      };
    });

  return [...workerRows, ...teacherRows].sort((a, b) => a.name.localeCompare(b.name));
}
