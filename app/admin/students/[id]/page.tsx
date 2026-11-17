import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/tables/data-table";
import { PrintButton } from "@/components/ui/print-button";
import { getCurrentUser } from "@/lib/auth";
import { academyDateOf } from "@/lib/dates";
import { formatMoney } from "@/lib/utils";
import { AccountRecordForm } from "@/components/forms/client-addition-forms";

export default async function StudentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await getCurrentUser("admin");
  const [studentResult, accounts, exams, feedback, attendance, classes, teachers, users] = await Promise.all([
    supabase.from("students").select("*").eq("id", id).single(),
    supabase.from("student_account_records").select("*").eq("student_id", id).order("created_at", { ascending: false }),
    supabase.from("exam_records").select("*").eq("student_id", id).order("scheduled_at", { ascending: false }),
    supabase.from("feedback_records").select("*").eq("student_id", id).order("created_at", { ascending: false }),
    supabase.from("student_attendance").select("*").eq("student_id", id).order("date", { ascending: false }),
    supabase.from("classes").select("id,name,teacher_id,level,learning_mode,schedule"),
    supabase.from("teachers").select("id,name"),
    supabase.from("users").select("id,full_name").eq("is_active", true).order("full_name"),
  ]);
  const student = studentResult.data;
  if (!student) return <div className="rounded-lg border bg-white p-6">Student not found.</div>;
  const klass = (classes.data ?? []).find((item) => item.id === student.class_id);
  const teacher = (teachers.data ?? []).find((item) => item.id === klass?.teacher_id);
  const balance = Math.max(0, Number(student.total_price ?? 0) - Number(student.amount_paid ?? 0));
  return (
    <div className="print-sheet space-y-6">
      <Card className="print-card">
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle>{student.full_name}</CardTitle>
          <div className="flex gap-2 print:hidden">
            <PrintButton label="Print/PDF Profile" />
            <Button asChild variant="outline"><Link href={`/receipts/student/${student.id}`}>Print Receipt</Link></Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-x-8 gap-y-3 md:grid-cols-2 print:grid-cols-2">
          {[
            ["Phone", student.phone],
            ["Level", student.level],
            ["Class", klass?.name ?? ""],
            ["Teacher", teacher?.name ?? ""],
            ["Mode", student.learning_mode],
            ["Price", formatMoney(Number(student.total_price ?? 0))],
            ["Paid", formatMoney(Number(student.amount_paid ?? 0))],
            ["Not paid", formatMoney(balance)],
            ["Tags", Array.isArray(student.tags) ? student.tags.join(", ") : ""],
            ["Payment arrangement", `${student.payment_due_date ?? ""} ${student.payment_comment ?? ""}`],
          ].map(([label, value]) => (
            <p key={label} className="flex justify-between gap-4 border-b py-1 text-sm">
              <span className="font-medium text-muted-foreground">{label}</span>
              <span className="text-right print:text-left">{value}</span>
            </p>
          ))}
        </CardContent>
      </Card>
      <div className="print:hidden"><AccountRecordForm students={[{ id: student.id, full_name: student.full_name }]} classes={classes.data ?? []} teachers={teachers.data ?? []} users={users.data ?? []} defaultStudentId={student.id} defaultClassId={student.class_id} defaultTeacherId={klass?.teacher_id} /></div>
      <Card className="print-card print-table"><CardHeader><CardTitle>Accounts</CardTitle></CardHeader><CardContent><DataTable rows={(accounts.data ?? []).map((item) => ({ id: item.id, amount: formatMoney(Number(item.amount)), due_date: item.due_date ?? "", status: item.status, paid_on: item.paid_at ? academyDateOf(item.paid_at) : "", receipt_no: item.receipt_no ?? "", notes: item.notes ?? "", _edit: { amount: item.amount, status: item.status, due_date: item.due_date, paid_at: item.paid_at ? academyDateOf(item.paid_at) : null, receipt_no: item.receipt_no, notes: item.notes } }))} columns={[{ key: "amount", header: "Amount" }, { key: "due_date", header: "Due date" }, { key: "status", header: "Status" }, { key: "paid_on", header: "Paid on" }, { key: "receipt_no", header: "Receipt" }, { key: "notes", header: "Notes" }]} edit={{ table: "student_account_records", canDelete: true, fields: [{ key: "amount", label: "Amount", type: "number", required: true }, { key: "status", label: "Status", type: "select", required: true, options: ["paid", "scheduled", "due", "overdue"].map((value) => ({ value, label: value })) }, { key: "due_date", label: "Due date", type: "date" }, { key: "paid_at", label: "Paid on", type: "date" }, { key: "receipt_no", label: "Receipt" }, { key: "notes", label: "Notes", type: "textarea" }] }} /></CardContent></Card>
      <Card className="print-card print-table"><CardHeader><CardTitle>Exams and level assessment</CardTitle></CardHeader><CardContent><DataTable rows={(exams.data ?? []).map((item) => ({ id: item.id, type: item.exam_type, date: academyDateOf(item.scheduled_at), result_level: item.level_result ?? "", score: item.score_percent == null ? "" : `${item.score_percent}%`, comment: item.result_comment ?? "", _edit: { exam_type: item.exam_type, scheduled_at: item.scheduled_at ? academyDateOf(item.scheduled_at) : null, level_result: item.level_result, score_percent: item.score_percent, result_comment: item.result_comment } }))} columns={[{ key: "type", header: "Type" }, { key: "date", header: "Date" }, { key: "result_level", header: "Level" }, { key: "score", header: "%" }, { key: "comment", header: "Comment" }]} edit={{ table: "exam_records", canDelete: true, fields: [{ key: "exam_type", label: "Type", type: "select", required: true, options: ["placement", "quiz", "main", "internal", "osd"].map((value) => ({ value, label: value })) }, { key: "scheduled_at", label: "Date", type: "date" }, { key: "level_result", label: "Level" }, { key: "score_percent", label: "%", type: "number" }, { key: "result_comment", label: "Comment", type: "textarea" }] }} /></CardContent></Card>
      <Card className="print-card print-table"><CardHeader><CardTitle>Feedback</CardTitle></CardHeader><CardContent><DataTable rows={(feedback.data ?? []).map((item) => ({ id: item.id, source: item.source, rating: item.rating ?? "", comment: item.comment, date: academyDateOf(item.created_at), _edit: { source: item.source, rating: item.rating, comment: item.comment } }))} columns={[{ key: "source", header: "Source" }, { key: "rating", header: "Rating" }, { key: "comment", header: "Comment" }, { key: "date", header: "Date" }]} edit={{ table: "feedback_records", canDelete: true, fields: [{ key: "source", label: "Source", type: "select", required: true, options: [{ value: "teacher", label: "Teacher on student" }, { value: "student", label: "Student feedback" }] }, { key: "rating", label: "Rating", type: "number" }, { key: "comment", label: "Comment", type: "textarea", required: true }] }} /></CardContent></Card>
      <Card className="print-card print-table"><CardHeader><CardTitle>Attendance</CardTitle></CardHeader><CardContent><DataTable rows={(attendance.data ?? []).map((item) => ({ id: item.id, date: item.date, status: item.status }))} columns={[{ key: "date", header: "Date" }, { key: "status", header: "Status" }]} edit={{ table: "student_attendance", canDelete: true, fields: [{ key: "status", label: "Status", type: "select", required: true, options: ["present", "late", "absent", "excused"].map((value) => ({ value, label: value })) }] }} /></CardContent></Card>
    </div>
  );
}
