import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/tables/data-table";
import { getCurrentUser } from "@/lib/auth";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { formatMoney } from "@/lib/utils";
import { ReportDataTools } from "@/components/forms/report-data-tools";
import { academyDate, academyDateOf, academyDayStartIso, academyMonthStart } from "@/lib/dates";
import { TreasuryForm } from "@/components/forms/simple-record-forms";
import { dictionaries } from "@/lib/i18n";
import { getCurrentLanguage } from "@/lib/i18n-server";
import { loadMoney, moneyTotals } from "@/lib/revenue";


const EN = {
  "dailyRevenue": "Daily revenue",
  "dailyExpenses": "Daily expenses",
  "dailyProfit": "Daily profit",
  "monthlyRevenue": "Monthly revenue",
  "monthlyExpenses": "Monthly expenses",
  "monthlyProfit": "Monthly profit",
  "waiting": "Students waiting",
  "trials": "Trial sessions this month",
  "books": "Books handed out this month",
  "bookings": "Bookings today / month",
  "followups": "Follow-ups today / month",
  "studentAttendance": "Student attendance today",
  "teacherAttendance": "Teachers checked in today",
  "treasury": "Treasury",
  "studentPayments": "Student payments",
  "bookPayments": "Books",
  "courseReports": "Course and payment reports",
  "course": "Course",
  "attendance": "Attendance",
  "paid": "Paid",
  "scheduled": "Scheduled / unpaid",
  "paymentRecords": "Payment records",
  "enrolments": "New enrolments (month)",
  "salesKpis": "Sales KPIs",
  "salesEmployee": "Sales employee",
  "dailyFollowups": "Daily follow-ups",
  "monthlyFollowups": "Monthly follow-ups",
  "monthlyBookings": "Monthly bookings",
  "interestedNew": "Interested (new leads this month)",
  "notInterestedNew": "Not interested (new leads this month)",
  "noAnswerNew": "No answer (new leads this month)",
  "campaigns": "Campaign performance",
  "campaign": "Campaign",
  "totalLeads": "Total leads (all time)",
  "leadsMonth": "Leads created this month",
  "interestedMonth": "Interested (this month)",
  "bookedMonth": "Booked (this month)",
  "notInterestedMonth": "Not interested (this month)",
  "noAnswerMonth": "No answer (this month)",
  "noteTitle": "Needs client confirmation",
  "note": "KPI weights and the exact employee performance formula are shown as raw counts for now. They can become scored KPIs once the rules are confirmed."
};

const AR: typeof EN = {
  "dailyRevenue": "إيرادات اليوم",
  "dailyExpenses": "مصروفات اليوم",
  "dailyProfit": "ربح اليوم",
  "monthlyRevenue": "إيرادات الشهر",
  "monthlyExpenses": "مصروفات الشهر",
  "monthlyProfit": "ربح الشهر",
  "waiting": "طلاب في قائمة الانتظار",
  "trials": "حصص تجريبية هذا الشهر",
  "books": "كتب تم تسليمها هذا الشهر",
  "bookings": "الحجوزات اليوم / الشهر",
  "followups": "المتابعات اليوم / الشهر",
  "studentAttendance": "حضور الطلاب اليوم",
  "teacherAttendance": "المدرسون الحاضرون اليوم",
  "treasury": "الخزينة",
  "studentPayments": "مدفوعات الطلاب",
  "bookPayments": "الكتب",
  "courseReports": "تقارير الفصول والمدفوعات",
  "course": "الفصل",
  "attendance": "الحضور",
  "paid": "مدفوع",
  "scheduled": "مجدول / غير مدفوع",
  "paymentRecords": "سجلات الدفع",
  "enrolments": "تسجيلات جديدة (الشهر)",
  "salesKpis": "مؤشرات أداء المبيعات",
  "salesEmployee": "موظف المبيعات",
  "dailyFollowups": "متابعات اليوم",
  "monthlyFollowups": "متابعات الشهر",
  "monthlyBookings": "حجوزات الشهر",
  "interestedNew": "مهتم (عملاء جدد هذا الشهر)",
  "notInterestedNew": "غير مهتم (عملاء جدد هذا الشهر)",
  "noAnswerNew": "لا يرد (عملاء جدد هذا الشهر)",
  "campaigns": "أداء الحملات",
  "campaign": "الحملة",
  "totalLeads": "إجمالي العملاء (كل الوقت)",
  "leadsMonth": "عملاء أُضيفوا هذا الشهر",
  "interestedMonth": "مهتم (هذا الشهر)",
  "bookedMonth": "حجز (هذا الشهر)",
  "notInterestedMonth": "غير مهتم (هذا الشهر)",
  "noAnswerMonth": "لا يرد (هذا الشهر)",
  "noteTitle": "بانتظار تأكيد العميل",
  "note": "أوزان مؤشرات الأداء ومعادلة تقييم الموظفين معروضة حاليًا كأعداد فقط، ويمكن تحويلها إلى درجات بعد تأكيد القواعد."
};

export default async function ReportsPage() {
  const { supabase } = await getCurrentUser("admin");
  const lang = await getCurrentLanguage();
  const L = lang === "ar" ? AR : EN;
  const today = academyDate();
  const monthStart = academyMonthStart();
  const monthStartIso = academyDayStartIso(monthStart);
  const [money, attendance, teacherAttendance, interactions, leads, files, users, classes, createdAccounts, enrolments, bookedLeads, paidAccounts, waitingStudents, trials, booksGiven] = await Promise.all([
    loadMoney(supabase, monthStart),
    fetchAll((from, to) => supabase.from("student_attendance").select("id,status,date,class_id").gte("date", monthStart).order("id").range(from, to)),
    fetchAll((from, to) => supabase.from("teacher_attendance").select("id,check_in,date").gte("date", monthStart).order("id").range(from, to)),
    fetchAll((from, to) => supabase.from("lead_interactions").select("id,created_by,created_at,lead_id").gte("created_at", monthStartIso).order("id").range(from, to)),
    fetchAll((from, to) => supabase.from("leads").select("id,status,assigned_to,file_id,created_at").gte("created_at", monthStartIso).order("id").range(from, to)),
    supabase.from("lead_files").select("id,name,total_leads"),
    supabase.from("users").select("id,full_name,role"),
    supabase.from("classes").select("id,name"),
    fetchAll((from, to) => supabase.from("student_account_records").select("id,amount,status,class_id,created_at,paid_at").gte("created_at", monthStartIso).order("id").range(from, to)),
    supabase.from("students").select("id,class_id").gte("enrolled_at", monthStartIso),
    fetchAll((from, to) => supabase.from("leads").select("id,assigned_to,booked_at").gte("booked_at", monthStartIso).order("id").range(from, to)),
    fetchAll((from, to) => supabase.from("student_account_records").select("id,amount,status,class_id,created_at,paid_at").gte("paid_at", monthStartIso).order("id").range(from, to)),
    supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "waiting"),
    supabase.from("students").select("id", { count: "exact", head: true }).gte("trial_date", monthStart),
    supabase.from("student_books").select("id", { count: "exact", head: true }).gte("received_at", monthStart),
  ]);
  // paid rows count in the month they were paid, the rest by created_at
  const accounts = [...new Map([...(createdAccounts.data ?? []), ...(paidAccounts.data ?? [])].map((row) => [row.id, row])).values()].filter((row) => (row.status === "paid" ? (row.paid_at ?? row.created_at) : row.created_at) >= monthStartIso);

  const day = moneyTotals(money.entries, (date) => date === today);
  const month = moneyTotals(money.entries, (date) => date >= monthStart);
  const breakdown = (totals: typeof day) => `${L.treasury} ${formatMoney(totals.treasuryIncome)} · ${L.studentPayments} ${formatMoney(totals.studentPayments)} · ${L.bookPayments} ${formatMoney(totals.books)}`;

  const dailyAttendance = (attendance.data ?? []).filter((row) => row.date === today);
  const monthlyAttendance = (attendance.data ?? []).filter((row) => row.date >= monthStart);
  const dailyFollowups = (interactions.data ?? []).filter((row) => academyDateOf(row.created_at) === today);
  const monthlyFollowups = interactions.data ?? [];
  const monthlyBookings = bookedLeads.data ?? [];
  const dailyBookings = monthlyBookings.filter((row) => academyDateOf(row.booked_at) === today);

  const salesRows = (users.data ?? []).filter((user) => user.role === "sales").map((user) => ({
    id: user.id,
    sales: user.full_name,
    daily_followups: dailyFollowups.filter((item) => item.created_by === user.id).length,
    monthly_followups: monthlyFollowups.filter((item) => item.created_by === user.id).length,
    monthly_bookings: monthlyBookings.filter((lead) => lead.assigned_to === user.id).length,
    interested: (leads.data ?? []).filter((lead) => lead.assigned_to === user.id && ["interested", "thinking", "booked"].includes(String(lead.status))).length,
    not_interested: (leads.data ?? []).filter((lead) => lead.assigned_to === user.id && lead.status === "not_interested").length,
    no_answer: (leads.data ?? []).filter((lead) => lead.assigned_to === user.id && lead.status === "no_answer").length,
  }));

  const campaignRows = (files.data ?? []).map((file) => {
    const fileLeads = (leads.data ?? []).filter((lead) => lead.file_id === file.id);
    return {
      id: file.id,
      campaign: file.name,
      total_leads: file.total_leads ?? 0,
      leads: fileLeads.length,
      interested: fileLeads.filter((lead) => ["interested", "thinking"].includes(String(lead.status))).length,
      booked: fileLeads.filter((lead) => lead.status === "booked").length,
      not_interested: fileLeads.filter((lead) => lead.status === "not_interested").length,
      no_answer: fileLeads.filter((lead) => lead.status === "no_answer").length,
    };
  });

  const courseRows = (classes.data ?? []).map((klass) => {
    const classAttendance = monthlyAttendance.filter((row) => row.class_id === klass.id);
    const present = classAttendance.filter((row) => row.status === "present" || row.status === "late").length;
    const courseAccounts = accounts.filter((row) => row.class_id === klass.id);
    return {
      id: klass.id,
      course: klass.name,
      attendance_rate: classAttendance.length ? `${Math.round((present / classAttendance.length) * 100)}%` : "0%",
      accounts_paid: formatMoney(courseAccounts.filter((row) => row.status === "paid").reduce((sum, row) => sum + Number(row.amount), 0)),
      accounts_scheduled: formatMoney(courseAccounts.filter((row) => row.status !== "paid").reduce((sum, row) => sum + Number(row.amount), 0)),
      payment_records: courseAccounts.length,
      enrolments: (enrolments.data ?? []).filter((student) => student.class_id === klass.id).length,
    };
  });

  const cards: Array<[string, string, string?]> = [
    [L.dailyRevenue, formatMoney(day.income), breakdown(day)],
    [L.dailyExpenses, formatMoney(day.expenses)],
    [L.dailyProfit, formatMoney(day.profit)],
    [L.monthlyRevenue, formatMoney(month.income), breakdown(month)],
    [L.monthlyExpenses, formatMoney(month.expenses)],
    [L.monthlyProfit, formatMoney(month.profit)],
    [L.waiting, String(waitingStudents.count ?? 0)],
    [L.trials, String(trials.count ?? 0)],
    [L.books, String(booksGiven.count ?? 0)],
    [L.bookings, `${dailyBookings.length} / ${monthlyBookings.length}`],
    [L.followups, `${dailyFollowups.length} / ${monthlyFollowups.length}`],
    [L.studentAttendance, `${dailyAttendance.filter((row) => row.status === "present" || row.status === "late").length} / ${dailyAttendance.length}`],
    [L.teacherAttendance, `${(teacherAttendance.data ?? []).filter((row) => row.date === today && row.check_in).length}`],
  ];

  const reportData = {
    summary: cards.map(([label, value]) => ({ Metric: label, Value: value })),
    courses: courseRows.map((row) => ({ Course: row.course, Attendance: row.attendance_rate, Paid: row.accounts_paid, "Scheduled / unpaid": row.accounts_scheduled, "Payment records": row.payment_records, "New enrolments": row.enrolments })),
    sales: salesRows.map((row) => ({ "Sales employee": row.sales, "Daily follow-ups": row.daily_followups, "Monthly follow-ups": row.monthly_followups, "Monthly bookings": row.monthly_bookings, "Interested (leads created this month)": row.interested, "Not interested (leads created this month)": row.not_interested, "No answer (leads created this month)": row.no_answer })),
    campaigns: campaignRows.map((row) => ({ Campaign: row.campaign, "Total leads (all time)": row.total_leads, "Leads (created this month)": row.leads, "Interested (this month)": row.interested, "Booked (this month)": row.booked, "Not interested (this month)": row.not_interested, "No answer (this month)": row.no_answer })),
  };

  return (
    <div className="space-y-6">
      <TreasuryForm labels={dictionaries[lang].treasuryPage} />
      <ReportDataTools reportData={reportData} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {cards.map(([label, value, note]) => <Card key={label}><CardHeader><CardTitle className="text-sm text-muted-foreground">{label}</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{value}</p>{note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}</CardContent></Card>)}
      </div>
      <Card><CardHeader><CardTitle>{L.courseReports}</CardTitle></CardHeader><CardContent><DataTable rows={courseRows} columns={[{ key: "course", header: L.course }, { key: "attendance_rate", header: L.attendance }, { key: "accounts_paid", header: L.paid }, { key: "accounts_scheduled", header: L.scheduled }, { key: "payment_records", header: L.paymentRecords }, { key: "enrolments", header: L.enrolments }]} /></CardContent></Card>
      <Card><CardHeader><CardTitle>{L.salesKpis}</CardTitle></CardHeader><CardContent><DataTable rows={salesRows} columns={[{ key: "sales", header: L.salesEmployee }, { key: "daily_followups", header: L.dailyFollowups }, { key: "monthly_followups", header: L.monthlyFollowups }, { key: "monthly_bookings", header: L.monthlyBookings }, { key: "interested", header: L.interestedNew }, { key: "not_interested", header: L.notInterestedNew }, { key: "no_answer", header: L.noAnswerNew }]} /></CardContent></Card>
      <Card><CardHeader><CardTitle>{L.campaigns}</CardTitle></CardHeader><CardContent><DataTable rows={campaignRows} columns={[{ key: "campaign", header: L.campaign }, { key: "total_leads", header: L.totalLeads }, { key: "leads", header: L.leadsMonth }, { key: "interested", header: L.interestedMonth }, { key: "booked", header: L.bookedMonth }, { key: "not_interested", header: L.notInterestedMonth }, { key: "no_answer", header: L.noAnswerMonth }]} /></CardContent></Card>
      <Card><CardHeader><CardTitle>{L.noteTitle}</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">{L.note}</CardContent></Card>
    </div>
  );
}
