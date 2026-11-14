import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireApiUser } from "@/lib/api-auth";
import { academyDate, academyDayStartIso } from "@/lib/dates";
import { escapeHtml, formatMoney } from "@/lib/utils";

async function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  // Vercel cron sends Authorization: Bearer <CRON_SECRET>
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (secret && (bearer === secret || request.headers.get("x-cron-secret") === secret)) return true;
  return (await requireApiUser(["admin"])).ok;
}

export async function GET(request: Request) {
  return POST(request);
}

export async function POST(request: Request) {
  if (!(await authorized(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // cron calls have no user session, read with the service role
  const supabase = createSupabaseAdminClient();
  const today = academyDate();
  const dayStart = academyDayStartIso(today);
  const [teacherAttendance, teachers, users, employeeAttendance, studentAttendance, classes, treasury, interactions, bookings] = await Promise.all([
    supabase.from("teacher_attendance").select("check_in").eq("date", today),
    supabase.from("teachers").select("id,user_id"),
    supabase.from("users").select("id,role,is_active"),
    supabase.from("employee_attendance").select("check_in").eq("date", today),
    supabase.from("student_attendance").select("status,class_id").eq("date", today),
    supabase.from("classes").select("id,name"),
    supabase.from("treasury_records").select("type,amount").eq("date", today),
    supabase.from("lead_interactions").select("id", { count: "exact", head: true }).gte("created_at", dayStart),
    supabase.from("leads").select("id", { count: "exact", head: true }).gte("booked_at", dayStart),
  ]);
  const failed = [teacherAttendance, teachers, users, employeeAttendance, studentAttendance, classes, treasury, interactions, bookings].find((result) => result.error);
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });

  const activeTeacherUsers = new Set((users.data ?? []).filter((user) => user.is_active && user.role === "teacher").map((user) => user.id));
  const activeTeachers = (teachers.data ?? []).filter((teacher) => teacher.user_id && activeTeacherUsers.has(teacher.user_id)).length;
  const presentTeachers = (teacherAttendance.data ?? []).filter((row) => row.check_in).length;
  const presentEmployees = (employeeAttendance.data ?? []).filter((row) => row.check_in).length;
  const treasuryIncome = (treasury.data ?? []).filter((row) => row.type === "income").reduce((sum, row) => sum + Number(row.amount), 0);
  const treasuryExpense = (treasury.data ?? []).filter((row) => row.type === "expense").reduce((sum, row) => sum + Number(row.amount), 0);
  const classLines = (classes.data ?? []).flatMap((klass) => {
    const rows = (studentAttendance.data ?? []).filter((row) => row.class_id === klass.id);
    if (!rows.length) return [];
    const present = rows.filter((row) => row.status === "present" || row.status === "late").length;
    return [`<li>${escapeHtml(klass.name)}: ${present}/${rows.length} (${Math.round((present / rows.length) * 100)}%)</li>`];
  }).join("") || "<li>No student attendance recorded today.</li>";
  const html = `<div style="font-family:Inter,Arial;color:#0B0B0B"><h1 style="border-bottom:4px solid #DD0000;padding-bottom:8px">Fließend Deutsch Daily Report</h1><h2>Staff Attendance</h2><p>Teachers: ${presentTeachers} present, ${Math.max(0, activeTeachers - presentTeachers)} not checked in · Employees checked in: ${presentEmployees}</p><h2>Student Attendance</h2><ul>${classLines}</ul><h2>Treasury</h2><p>Income ${formatMoney(treasuryIncome)} · Expense ${formatMoney(treasuryExpense)} · Net ${formatMoney(treasuryIncome - treasuryExpense)}</p><h2>Sales</h2><p>${interactions.count ?? 0} follow-ups logged today · ${bookings.count ?? 0} bookings today</p><div style="height:6px;background:#FFCE00;margin-top:24px"></div></div>`;

  if (!process.env.RESEND_API_KEY || !process.env.REPORT_EMAIL || !process.env.FROM_EMAIL) {
    return NextResponse.json({ sent: false, date: today, reason: "Email is not configured. Set RESEND_API_KEY, FROM_EMAIL and REPORT_EMAIL." });
  }
  const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({ from: process.env.FROM_EMAIL, to: process.env.REPORT_EMAIL, subject: `Fließend Deutsch Daily Report - ${today}`, html });
  if (error) return NextResponse.json({ sent: false, date: today, reason: error.message }, { status: 502 });
  return NextResponse.json({ sent: true, date: today });
}
