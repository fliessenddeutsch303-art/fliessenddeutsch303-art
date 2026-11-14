import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAll } from "@/lib/supabase/fetch-all";

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

/** Days with a check-in but no usable check-out (missing or earlier than the check-in): they count as 0 hours. */
function unusableDays(rows: { check_in?: string | null; check_out?: string | null }[]) {
  return rows.filter((row) => row.check_in && hoursBetween(row.check_in, row.check_out) === 0 && !(row.check_out && row.check_out === row.check_in)).length;
}

async function load<T>(label: string, build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const { data, error } = await fetchAll<T>(build);
  if (error) throw new Error(`Payroll could not load ${label}: ${error.message}`);
  return data ?? [];
}

export async function calculatePayslips(supabase: SupabaseClient, start: string, end: string): Promise<PayslipRow[]> {
  const [teachers, teacherAttendance, teacherAdjustments, users, profiles, employeeAdjustments, employeeAttendance, penalties] = await Promise.all([
    load("teachers", (from, to) => supabase.from("teachers").select("*").order("id").range(from, to)),
    load("teacher attendance", (from, to) => supabase.from("teacher_attendance").select("*").gte("date", start).lte("date", end).order("id").range(from, to)),
    load("teacher adjustments", (from, to) => supabase.from("teacher_adjustments").select("*").gte("period_start", start).lte("period_start", end).order("id").range(from, to)),
    load("users", (from, to) => supabase.from("users").select("id,full_name,role,payroll_type,monthly_salary,monthly_wage,hourly_rate,is_active").order("id").range(from, to)),
    load("employee profiles", (from, to) => supabase.from("employee_profiles").select("id,account_user_id,full_name,role,payroll_type,monthly_salary,monthly_wage,hourly_rate,is_active").order("id").range(from, to)),
    load("employee adjustments", (from, to) => supabase.from("employee_adjustments").select("*").gte("period_start", start).lte("period_start", end).order("id").range(from, to)),
    load("employee attendance", (from, to) => supabase.from("employee_attendance").select("*").gte("date", start).lte("date", end).order("id").range(from, to)),
    load("employee events", (from, to) => supabase.from("employee_events").select("id,user_id,teacher_id,employee_profile_id,amount,notes,event_date").eq("type", "penalty").gte("event_date", start).lte("event_date", end).order("id").range(from, to)),
  ]);
  const penaltyRows = penalties.filter((row) => Number(row.amount ?? 0) > 0);
  const userById = new Map(users.map((user) => [user.id, user]));

  const teacherRows: PayslipRow[] = teachers.flatMap((teacher) => {
    const rows = teacherAttendance.filter((row) => row.teacher_id === teacher.id);
    const linked = teacher.user_id ? userById.get(teacher.user_id) : undefined;
    const activeTeacher = Boolean(linked && linked.is_active && linked.role === "teacher");
    if (!activeTeacher && !rows.length) return [];
    const hours = rows.reduce((sum, row) => sum + hoursBetween(row.check_in, row.check_out), 0);
    const sessions = rows.reduce((sum, row) => sum + Number(row.sessions_count ?? 0), 0);
    const basePay = teacher.pay_type === "hourly"
      ? hours * Number(teacher.base_rate)
      : teacher.pay_type === "per_session"
        ? sessions * Number(teacher.base_rate)
        : Number(teacher.base_rate);
    const adjustments = teacherAdjustments.filter((row) => row.teacher_id === teacher.id);
    const bonuses = adjustments.filter((row) => row.type === "bonus").reduce((sum, row) => sum + Number(row.amount), 0);
    const teacherPenalties = penaltyRows.filter((row) => row.teacher_id === teacher.id || (activeTeacher && !row.teacher_id && row.user_id === teacher.user_id));
    const deductions = adjustments.filter((row) => row.type === "deduction").reduce((sum, row) => sum + Number(row.amount), 0)
      + teacherPenalties.reduce((sum, row) => sum + Number(row.amount), 0);
    const notes = [...adjustments.map((row) => `${row.type}: ${row.reason} (${Number(row.amount)})`), ...teacherPenalties.map((row) => `penalty ${row.event_date}: ${row.notes} (${Number(row.amount)})`)];
    if (!activeTeacher) notes.push("Included only because of attendance in this period: the teacher's login is deactivated, deleted or no longer a teacher account.");
    const missing = teacher.pay_type === "fixed" ? 0 : unusableDays(rows);
    if (missing) notes.push(`${missing} day${missing === 1 ? "" : "s"} without check-out ${missing === 1 ? "was" : "were"} counted as 0 hours.`);
    return [{
      kind: "teacher" as const,
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
      notes,
    }];
  });

  // People are employee profiles; login accounts without any profile (e.g. individual accounts) are paid as themselves.
  const profiledAccounts = new Set(profiles.map((profile) => profile.account_user_id));
  const workerSource = [...profiles, ...users.filter((user) => !profiledAccounts.has(user.id))].filter((worker) => worker.role !== "teacher");
  const workerRows: PayslipRow[] = workerSource.flatMap((worker) => {
      const attendanceRows = employeeAttendance.filter((row) => row.employee_profile_id === worker.id || (!row.employee_profile_id && row.user_id === worker.id));
      // A deactivated person is still paid for a period they actually worked in.
      if (!worker.is_active && !attendanceRows.length) return [];
      const hours = attendanceRows.reduce((sum, row) => sum + hoursBetween(row.check_in, row.check_out), 0);
      const invalidPerSession = worker.payroll_type === "per_session";
      const basePay = invalidPerSession
        ? 0
        : worker.payroll_type === "hourly"
        ? hours * Number(worker.hourly_rate ?? 0)
        : worker.payroll_type === "monthly_wage"
          ? Number(worker.monthly_wage ?? 0)
          : Number(worker.monthly_salary ?? 0);
      const adjustments = employeeAdjustments.filter((row) => row.employee_profile_id === worker.id || (!row.employee_profile_id && row.user_id === worker.id));
      const bonuses = adjustments.filter((row) => row.type === "bonus").reduce((sum, row) => sum + Number(row.amount), 0);
      const workerPenalties = penaltyRows.filter((row) => row.employee_profile_id === worker.id || (!row.employee_profile_id && row.user_id === worker.id));
      const deductions = adjustments.filter((row) => row.type === "deduction").reduce((sum, row) => sum + Number(row.amount), 0)
        + workerPenalties.reduce((sum, row) => sum + Number(row.amount), 0);
      const notes = [...adjustments.map((row) => `${row.type}: ${row.reason} (${Number(row.amount)})`), ...workerPenalties.map((row) => `penalty ${row.event_date}: ${row.notes} (${Number(row.amount)})`)];
      if (!worker.is_active) notes.push("Included only because of attendance in this period: this person is deactivated.");
      if (invalidPerSession) notes.push("Pay type per session is only valid for teachers: base pay was counted as 0. Fix the pay type.");
      const missing = worker.payroll_type === "hourly" ? unusableDays(attendanceRows) : 0;
      if (missing) notes.push(`${missing} day${missing === 1 ? "" : "s"} without check-out ${missing === 1 ? "was" : "were"} counted as 0 hours.`);
      return [{
        kind: "worker" as const,
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
        notes,
      }];
    });

  return [...workerRows, ...teacherRows].sort((a, b) => a.name.localeCompare(b.name));
}
