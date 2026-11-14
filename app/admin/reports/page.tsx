import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/tables/data-table";
import { getCurrentUser } from "@/lib/auth";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { formatMoney } from "@/lib/utils";
import { ReportDataTools } from "@/components/forms/report-data-tools";
import { academyDate, academyDateOf, academyDayStartIso, academyMonthStart } from "@/lib/dates";


export default async function ReportsPage() {
  const { supabase } = await getCurrentUser("admin");
  const today = academyDate();
  const monthStart = academyMonthStart();
  const monthStartIso = academyDayStartIso(monthStart);
  const [treasury, attendance, teacherAttendance, interactions, leads, files, users, classes, createdAccounts, enrolments, bookedLeads, paidAccounts] = await Promise.all([
    fetchAll((from, to) => supabase.from("treasury_records").select("id,type,amount,date,category").gte("date", monthStart).order("id").range(from, to)),
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
  ]);
  // Paid rows count in the month they were paid (paid_at); everything else in the month it was created.
  const accounts = [...new Map([...(createdAccounts.data ?? []), ...(paidAccounts.data ?? [])].map((row) => [row.id, row])).values()].filter((row) => (row.status === "paid" ? (row.paid_at ?? row.created_at) : row.created_at) >= monthStartIso);

  const treasuryRows = treasury.data ?? [];
  const incomeToday = treasuryRows.filter((row) => row.type === "income" && row.date === today).reduce((sum, row) => sum + Number(row.amount), 0);
  const expenseToday = treasuryRows.filter((row) => row.type === "expense" && row.date === today).reduce((sum, row) => sum + Number(row.amount), 0);
  const incomeMonth = treasuryRows.filter((row) => row.type === "income" && row.date >= monthStart).reduce((sum, row) => sum + Number(row.amount), 0);
  const expenseMonth = treasuryRows.filter((row) => row.type === "expense" && row.date >= monthStart).reduce((sum, row) => sum + Number(row.amount), 0);

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

  const cards = [
    ["Daily revenue", formatMoney(incomeToday)],
    ["Daily expenses", formatMoney(expenseToday)],
    ["Daily profit", formatMoney(incomeToday - expenseToday)],
    ["Monthly revenue", formatMoney(incomeMonth)],
    ["Monthly expenses", formatMoney(expenseMonth)],
    ["Monthly profit", formatMoney(incomeMonth - expenseMonth)],
    ["Bookings today / month", `${dailyBookings.length} / ${monthlyBookings.length}`],
    ["Follow-ups today / month", `${dailyFollowups.length} / ${monthlyFollowups.length}`],
    ["Student attendance today", `${dailyAttendance.filter((row) => row.status === "present" || row.status === "late").length} / ${dailyAttendance.length}`],
    ["Teacher attendance today", `${(teacherAttendance.data ?? []).filter((row) => row.date === today && row.check_in).length}`],
  ];

  const reportData = {
    summary: cards.map(([label, value]) => ({ Metric: label, Value: value })),
    courses: courseRows.map((row) => ({ Course: row.course, Attendance: row.attendance_rate, Paid: row.accounts_paid, "Scheduled / unpaid": row.accounts_scheduled, "Payment records": row.payment_records, "New enrolments": row.enrolments })),
    sales: salesRows.map((row) => ({ "Sales employee": row.sales, "Daily follow-ups": row.daily_followups, "Monthly follow-ups": row.monthly_followups, "Monthly bookings": row.monthly_bookings, "Interested (leads created this month)": row.interested, "Not interested (leads created this month)": row.not_interested, "No answer (leads created this month)": row.no_answer })),
    campaigns: campaignRows.map((row) => ({ Campaign: row.campaign, "Total leads (all time)": row.total_leads, "Leads (created this month)": row.leads, "Interested (this month)": row.interested, "Booked (this month)": row.booked, "Not interested (this month)": row.not_interested, "No answer (this month)": row.no_answer })),
  };

  return (
    <div className="space-y-6">
      <ReportDataTools reportData={reportData} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {cards.map(([label, value]) => <Card key={label}><CardHeader><CardTitle className="text-sm text-muted-foreground">{label}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{value}</CardContent></Card>)}
      </div>
      <Card><CardHeader><CardTitle>Course and payment reports</CardTitle></CardHeader><CardContent><DataTable rows={courseRows} columns={[{ key: "course", header: "Course" }, { key: "attendance_rate", header: "Attendance" }, { key: "accounts_paid", header: "Paid" }, { key: "accounts_scheduled", header: "Scheduled / unpaid" }, { key: "payment_records", header: "Payment records" }, { key: "enrolments", header: "New enrolments (month)" }]} /></CardContent></Card>
      <Card><CardHeader><CardTitle>Sales KPIs</CardTitle></CardHeader><CardContent><DataTable rows={salesRows} columns={[{ key: "sales", header: "Sales employee" }, { key: "daily_followups", header: "Daily follow-ups" }, { key: "monthly_followups", header: "Monthly follow-ups" }, { key: "monthly_bookings", header: "Monthly bookings" }, { key: "interested", header: "Interested (new leads this month)" }, { key: "not_interested", header: "Not interested (new leads this month)" }, { key: "no_answer", header: "No answer (new leads this month)" }]} /></CardContent></Card>
      <Card><CardHeader><CardTitle>Campaign performance</CardTitle></CardHeader><CardContent><DataTable rows={campaignRows} columns={[{ key: "campaign", header: "Campaign" }, { key: "total_leads", header: "Total leads (all time)" }, { key: "leads", header: "Leads created this month" }, { key: "interested", header: "Interested (this month)" }, { key: "booked", header: "Booked (this month)" }, { key: "not_interested", header: "Not interested (this month)" }, { key: "no_answer", header: "No answer (this month)" }]} /></CardContent></Card>
      <Card><CardHeader><CardTitle>Needs client confirmation</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">KPI weights and exact employee performance formula are shown as raw counts for now. We can turn them into scored KPIs once the client confirms the rules.</CardContent></Card>
    </div>
  );
}
