import Link from "next/link";
import { ArrowUpRight, BookOpen, CalendarCheck2, CircleDollarSign, ClipboardList, Users, Wallet } from "lucide-react";
import { SendReportButton } from "@/components/forms/send-report-button";
import { academyDate, academyDateOf, academyDayStartIso, academyDaysAgo, academyMonthStart, academyWeekday } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { getCurrentLanguage } from "@/lib/i18n-server";
import { formatMoney } from "@/lib/utils";

function isPositiveAttendance(status: string) { return status === "present" || status === "late"; }

export default async function AdminDashboard() {
  const lang = await getCurrentLanguage();
  const ar = lang === "ar";
  const { supabase } = await getCurrentUser("admin");
  const today = academyDate();
  const monthStart = academyMonthStart();
  const monthStartIso = academyDayStartIso(monthStart);
  const weekStartIso = academyDayStartIso(academyDaysAgo(6));
  const weekday = academyWeekday();
  const [activeStudents, classes, studentAttendance, teacherAttendance, teachers, teacherUsers, employeeAttendance, treasury, newLeads, waitingLeads, bookings, interactions, exams, books, accounts] = await Promise.all([
    supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("classes").select("id,name,schedule,class_status,sessions_done,total_sessions").order("created_at", { ascending: false }),
    supabase.from("student_attendance").select("id,status").eq("date", today),
    supabase.from("teacher_attendance").select("id,check_in").eq("date", today),
    supabase.from("teachers").select("id,user_id"),
    supabase.from("users").select("id").eq("role", "teacher").eq("is_active", true),
    supabase.from("employee_attendance").select("id,check_in").eq("date", today),
    supabase.from("treasury_records").select("type,amount,date").gte("date", monthStart),
    supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", academyDayStartIso(today)),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "waiting"),
    fetchAll((from, to) => supabase.from("leads").select("id,booked_at").gte("booked_at", weekStartIso < monthStartIso ? weekStartIso : monthStartIso).order("id").range(from, to)),
    fetchAll((from, to) => supabase.from("lead_interactions").select("id,created_at").gte("created_at", monthStartIso).order("id").range(from, to)),
    supabase.from("exam_records").select("id", { count: "exact", head: true }).gte("scheduled_at", academyDayStartIso(today)),
    supabase.from("textbook_inventory").select("id,quantity_on_hand,quantity_needed,quantity_ordered"),
    supabase.from("student_account_records").select("id", { count: "exact", head: true }).neq("status", "paid").lt("due_date", today),
  ]);
  const activeTeacherIds = new Set((teacherUsers.data ?? []).map((user) => user.id));
  const activeTeacherCount = (teachers.data ?? []).filter((teacher) => teacher.user_id && activeTeacherIds.has(teacher.user_id)).length;
  const classRows = classes.data ?? [], treasuryRows = treasury.data ?? [], bookRows = books.data ?? [];
  const sum = (rows: typeof treasuryRows, type: string) => rows.filter((row) => row.type === type).reduce((total, row) => total + Number(row.amount), 0);
  const todayTreasury = treasuryRows.filter((row) => row.date === today);
  const incomeToday = sum(todayTreasury, "income"), expensesToday = sum(todayTreasury, "expense"), incomeMonth = sum(treasuryRows, "income"), expensesMonth = sum(treasuryRows, "expense");
  const todayStudents = studentAttendance.data ?? [], todayTeachers = (teacherAttendance.data ?? []).filter((row) => row.check_in).length, todayEmployees = (employeeAttendance.data ?? []).filter((row) => row.check_in);
  const bookingRows = bookings.data ?? [], interactionRows = interactions.data ?? [];
  const bookingsToday = bookingRows.filter((row) => academyDateOf(row.booked_at) === today), bookingsWeek = bookingRows.filter((row) => new Date(row.booked_at) >= new Date(weekStartIso));
  const followupsToday = interactionRows.filter((row) => academyDateOf(row.created_at) === today);
  const booksNeedingOrder = bookRows.filter((row) => Math.max(0, Number(row.quantity_needed) - Number(row.quantity_on_hand)) > Number(row.quantity_ordered ?? 0)), todaysClasses = classRows.filter((row) => row.class_status !== "finished" && String(row.schedule).toLowerCase().includes(weekday)).length;
  const labels = ar ? {
    panel: "لوحة التحكم", overview: "نظرة مباشرة على الطلاب والتشغيل والمبيعات والمالية والموظفين.",
    activeStudents: "الطلاب النشطون", classesToday: "فصول اليوم", studentAttendance: "حضور الطلاب اليوم", employeesCheckedIn: "الموظفون الحاضرون", teachersPresent: "المدرسون الحاضرون",
    incomeToday: "إيرادات اليوم", expensesToday: "مصروفات اليوم", profitToday: "ربح اليوم", incomeMonth: "إيرادات الشهر", monthlyProfit: "ربح الشهر", newLeads: "عملاء محتملون جدد اليوم", waitingLeads: "قائمة الانتظار", bookings: "حجوزات اليوم / الأسبوع", followups: "المتابعات اليوم / الشهر", upcomingExams: "الاختبارات القادمة",
    alerts: "تنبيهات التشغيل", overdue: "مدفوعات الطلاب المتأخرة", books: "كتب تحتاج إلى طلب", notStarted: "فصول لم تبدأ", progress: "تقدم الفصول", actions: "إجراءات سريعة", addStudent: "إضافة طالب", addTreasury: "إضافة سجل خزينة", accountCenter: "مركز الحسابات", sendReport: "إرسال التقرير اليومي",
  } : {
    panel: "Control panel", overview: "Live overview of students, operations, sales, finance, and staff.",
    activeStudents: "Active students", classesToday: "Classes today", studentAttendance: "Student attendance today", employeesCheckedIn: "Employees checked in", teachersPresent: "Teachers present",
    incomeToday: "Income today", expensesToday: "Expenses today", profitToday: "Profit today", incomeMonth: "Income this month", monthlyProfit: "Monthly profit", newLeads: "New leads today", waitingLeads: "Waiting leads", bookings: "Bookings today / week", followups: "Follow-ups today / month", upcomingExams: "Upcoming exams",
    alerts: "Operational alerts", overdue: "Overdue student payments", books: "Books needing order", notStarted: "Classes not started", progress: "Class progress", actions: "Quick actions", addStudent: "Add student", addTreasury: "Add treasury record", accountCenter: "Account Center", sendReport: "Send daily report",
  };
  const cards = [
    [labels.activeStudents, activeStudents.count ?? 0, "/admin/students", Users], [labels.classesToday, todaysClasses, "/admin/classes", CalendarCheck2], [labels.studentAttendance, `${todayStudents.filter((row) => isPositiveAttendance(row.status)).length} / ${todayStudents.length}`, "/admin/student-attendance", ClipboardList], [labels.employeesCheckedIn, `${todayEmployees.length}`, "/admin/hr/attendance", Users], [labels.teachersPresent, `${todayTeachers} / ${activeTeacherCount}`, "/admin/hr/attendance", Users], [labels.incomeToday, formatMoney(incomeToday), "/admin/treasury", CircleDollarSign], [labels.expensesToday, formatMoney(expensesToday), "/admin/treasury", Wallet], [labels.profitToday, formatMoney(incomeToday - expensesToday), "/admin/reports", CircleDollarSign], [labels.incomeMonth, formatMoney(incomeMonth), "/admin/reports", CircleDollarSign], [labels.monthlyProfit, formatMoney(incomeMonth - expensesMonth), "/admin/reports", CircleDollarSign], [labels.newLeads, newLeads.count ?? 0, "/admin/sales", Users], [labels.waitingLeads, waitingLeads.count ?? 0, "/admin/sales", ClipboardList], [labels.bookings, `${bookingsToday.length} / ${bookingsWeek.length}`, "/admin/sales", CalendarCheck2], [labels.followups, `${followupsToday.length} / ${interactionRows.length}`, "/admin/reports", ClipboardList], [labels.upcomingExams, exams.count ?? 0, "/admin/exams-management", BookOpen],
  ] as const;
  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#DD0000] pb-4"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#DD0000]">Fließend Deutsch</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">{labels.panel}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.overview}</p></div><span className="text-sm text-muted-foreground">{today}</span></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{cards.map(([label, value, href, Icon]) => <Link key={label} prefetch={false} href={href} className="group"><Card className="h-full transition hover:-translate-y-0.5 hover:border-[#DD0000]"><CardHeader className="flex-row items-start justify-between pb-2"><CardTitle className="text-sm text-muted-foreground">{label}</CardTitle><Icon size={18} className="text-[#DD0000]" /></CardHeader><CardContent className="flex items-end justify-between text-2xl font-semibold text-primary"><span>{value}</span><ArrowUpRight size={16} className="text-muted-foreground opacity-0 transition group-hover:opacity-100" /></CardContent></Card></Link>)}</div>
    <div className="grid gap-4 lg:grid-cols-3"><Card><CardHeader><CardTitle>{labels.alerts}</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><Link prefetch={false} className="flex justify-between border-b pb-2 hover:text-[#DD0000]" href="/admin/students"><span>{labels.overdue}</span><strong>{accounts.count ?? 0}</strong></Link><Link prefetch={false} className="flex justify-between border-b pb-2 hover:text-[#DD0000]" href="/admin/textbooks"><span>{labels.books}</span><strong>{booksNeedingOrder.length}</strong></Link><Link prefetch={false} className="flex justify-between hover:text-[#DD0000]" href="/admin/classes"><span>{labels.notStarted}</span><strong>{classRows.filter((row) => row.class_status === "not_started").length}</strong></Link></CardContent></Card><Card><CardHeader><CardTitle>{labels.progress}</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">{classRows.slice(0, 5).map((row) => <div key={row.id} className="flex justify-between border-b pb-2"><span>{row.name}</span><span className="font-semibold">{row.sessions_done ?? 0} / {row.total_sessions ?? 0}</span></div>)}</CardContent></Card><Card><CardHeader><CardTitle>{labels.actions}</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2"><Button asChild><Link prefetch={false} href="/admin/students">{labels.addStudent}</Link></Button><Button asChild variant="outline"><Link prefetch={false} href="/admin/treasury">{labels.addTreasury}</Link></Button><Button asChild variant="outline"><Link prefetch={false} href="/admin/account-center">{labels.accountCenter}</Link></Button><SendReportButton label={labels.sendReport} /></CardContent></Card></div>
  </div>;
}
