import Link from "next/link";
import { ArrowUpRight, BookOpen, CalendarCheck2, CircleDollarSign, ClipboardList, Send, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentLanguage } from "@/lib/i18n-server";
import { formatMoney } from "@/lib/utils";

function dateOnly(date = new Date()) { return date.toISOString().slice(0, 10); }
function isPositiveAttendance(status: string) { return status === "present" || status === "late"; }

export default async function AdminDashboard() {
  const lang = await getCurrentLanguage();
  const ar = lang === "ar";
  const { supabase } = await getCurrentUser("admin");
  const today = dateOnly();
  const monthStart = dateOnly(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const weekStart = new Date(Date.now() - 6 * 86400000).toISOString();
  const weekday = new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
  const [students, classes, studentAttendance, teacherAttendance, teachers, employeeAttendance, treasury, leads, interactions, exams, books, accounts] = await Promise.all([
    supabase.from("students").select("id,status"), supabase.from("classes").select("id,name,schedule,class_status,sessions_done,total_sessions"),
    supabase.from("student_attendance").select("id,status,date"), supabase.from("teacher_attendance").select("id,check_in,date"),
    supabase.from("teachers").select("id"), supabase.from("employee_attendance").select("id,user_id,check_in,date"),
    supabase.from("treasury_records").select("type,amount,date"), supabase.from("leads").select("id,status,created_at"),
    supabase.from("lead_interactions").select("id,created_at"), supabase.from("exam_records").select("id,exam_type,scheduled_at,booking_status"),
    supabase.from("textbook_inventory").select("id,quantity_on_hand,quantity_needed,quantity_ordered"), supabase.from("student_account_records").select("id,status,due_date,amount"),
  ]);
  const studentRows = students.data ?? [], classRows = classes.data ?? [], studentAttendanceRows = studentAttendance.data ?? [], teacherAttendanceRows = teacherAttendance.data ?? [], employeeAttendanceRows = employeeAttendance.data ?? [], treasuryRows = treasury.data ?? [], leadRows = leads.data ?? [], interactionRows = interactions.data ?? [], examRows = exams.data ?? [], bookRows = books.data ?? [], accountRows = accounts.data ?? [];
  const sum = (rows: typeof treasuryRows, type: string) => rows.filter((row) => row.type === type).reduce((total, row) => total + Number(row.amount), 0);
  const todayTreasury = treasuryRows.filter((row) => row.date === today), monthTreasury = treasuryRows.filter((row) => row.date >= monthStart);
  const incomeToday = sum(todayTreasury, "income"), expensesToday = sum(todayTreasury, "expense"), incomeMonth = sum(monthTreasury, "income"), expensesMonth = sum(monthTreasury, "expense");
  const todayStudents = studentAttendanceRows.filter((row) => row.date === today), todayTeachers = teacherAttendanceRows.filter((row) => row.date === today && row.check_in).length, todayEmployees = employeeAttendanceRows.filter((row) => row.date === today && row.check_in);
  const newLeads = leadRows.filter((row) => String(row.created_at).startsWith(today)), waitingLeads = leadRows.filter((row) => row.status === "waiting"), bookingsToday = leadRows.filter((row) => row.status === "booked" && String(row.created_at).startsWith(today)), bookingsWeek = leadRows.filter((row) => row.status === "booked" && String(row.created_at) >= weekStart);
  const followupsToday = interactionRows.filter((row) => String(row.created_at).startsWith(today)), followupsMonth = interactionRows.filter((row) => String(row.created_at).slice(0, 10) >= monthStart), upcomingExams = examRows.filter((row) => String(row.scheduled_at).slice(0, 10) >= today);
  const booksNeedingOrder = bookRows.filter((row) => Math.max(0, Number(row.quantity_needed) - Number(row.quantity_on_hand)) > Number(row.quantity_ordered ?? 0)), overdueAccounts = accountRows.filter((row) => row.status !== "paid" && row.due_date && row.due_date < today), todaysClasses = classRows.filter((row) => String(row.schedule).toLowerCase().includes(weekday)).length;
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
    [labels.activeStudents, studentRows.filter((row) => row.status === "active").length, "/admin/students", Users], [labels.classesToday, todaysClasses, "/admin/classes", CalendarCheck2], [labels.studentAttendance, `${todayStudents.filter((row) => isPositiveAttendance(row.status)).length} / ${todayStudents.length}`, "/admin/student-attendance", ClipboardList], [labels.employeesCheckedIn, `${todayEmployees.length}`, "/admin/hr/attendance", Users], [labels.teachersPresent, `${todayTeachers} / ${teachers.data?.length ?? 0}`, "/admin/hr/attendance", Users], [labels.incomeToday, formatMoney(incomeToday), "/admin/treasury", CircleDollarSign], [labels.expensesToday, formatMoney(expensesToday), "/admin/treasury", Wallet], [labels.profitToday, formatMoney(incomeToday - expensesToday), "/admin/reports", CircleDollarSign], [labels.incomeMonth, formatMoney(incomeMonth), "/admin/reports", CircleDollarSign], [labels.monthlyProfit, formatMoney(incomeMonth - expensesMonth), "/admin/reports", CircleDollarSign], [labels.newLeads, newLeads.length, "/admin/sales", Users], [labels.waitingLeads, waitingLeads.length, "/admin/sales", ClipboardList], [labels.bookings, `${bookingsToday.length} / ${bookingsWeek.length}`, "/admin/sales", CalendarCheck2], [labels.followups, `${followupsToday.length} / ${followupsMonth.length}`, "/admin/reports", ClipboardList], [labels.upcomingExams, upcomingExams.length, "/admin/exams-management", BookOpen],
  ] as const;
  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#DD0000] pb-4"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#DD0000]">Fließend Deutsch</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">{labels.panel}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.overview}</p></div><span className="text-sm text-muted-foreground">{today}</span></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{cards.map(([label, value, href, Icon]) => <Link key={label} prefetch={false} href={href} className="group"><Card className="h-full transition hover:-translate-y-0.5 hover:border-[#DD0000]"><CardHeader className="flex-row items-start justify-between pb-2"><CardTitle className="text-sm text-muted-foreground">{label}</CardTitle><Icon size={18} className="text-[#DD0000]" /></CardHeader><CardContent className="flex items-end justify-between text-2xl font-semibold text-primary"><span>{value}</span><ArrowUpRight size={16} className="text-muted-foreground opacity-0 transition group-hover:opacity-100" /></CardContent></Card></Link>)}</div>
    <div className="grid gap-4 lg:grid-cols-3"><Card><CardHeader><CardTitle>{labels.alerts}</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><Link prefetch={false} className="flex justify-between border-b pb-2 hover:text-[#DD0000]" href="/admin/students"><span>{labels.overdue}</span><strong>{overdueAccounts.length}</strong></Link><Link prefetch={false} className="flex justify-between border-b pb-2 hover:text-[#DD0000]" href="/admin/textbooks"><span>{labels.books}</span><strong>{booksNeedingOrder.length}</strong></Link><Link prefetch={false} className="flex justify-between hover:text-[#DD0000]" href="/admin/classes"><span>{labels.notStarted}</span><strong>{classRows.filter((row) => row.class_status === "not_started").length}</strong></Link></CardContent></Card><Card><CardHeader><CardTitle>{labels.progress}</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">{classRows.slice(0, 5).map((row) => <div key={row.id} className="flex justify-between border-b pb-2"><span>{row.name}</span><span className="font-semibold">{row.sessions_done ?? 0} / {row.total_sessions ?? 0}</span></div>)}</CardContent></Card><Card><CardHeader><CardTitle>{labels.actions}</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2"><Button asChild><Link prefetch={false} href="/admin/students">{labels.addStudent}</Link></Button><Button asChild variant="outline"><Link prefetch={false} href="/admin/treasury">{labels.addTreasury}</Link></Button><Button asChild variant="outline"><Link prefetch={false} href="/admin/account-center">{labels.accountCenter}</Link></Button><form action="/api/reports/daily" method="post"><Button variant="accent"><Send size={16} /> {labels.sendReport}</Button></form></CardContent></Card></div>
  </div>;
}
