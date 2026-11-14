import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/tables/data-table";
import { getCurrentUser } from "@/lib/auth";
import { academyDateOf } from "@/lib/dates";

// basic info only, no financial data
export default async function TeacherStudentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, profile } = await getCurrentUser("teacher");
  const [studentResult, exams, feedback, attendance, classes, teachers] = await Promise.all([
    supabase.from("students").select("id,full_name,phone,level,class_id,learning_mode,tags").eq("id", id).single(),
    supabase.from("exam_records").select("*").eq("student_id", id).order("scheduled_at", { ascending: false }),
    supabase.from("feedback_records").select("*").eq("student_id", id).order("created_at", { ascending: false }),
    supabase.from("student_attendance").select("*").eq("student_id", id).order("date", { ascending: false }),
    supabase.from("classes").select("id,name,teacher_id,level,learning_mode,schedule"),
    supabase.from("teachers").select("id,name,user_id"),
  ]);
  const student = studentResult.data;
  if (!student) return <div className="rounded-lg border bg-white p-6">Student not found.</div>;
  const klass = (classes.data ?? []).find((item) => item.id === student.class_id);
  const teacher = (teachers.data ?? []).find((item) => item.id === klass?.teacher_id);
  if (!teacher || (teacher.user_id !== profile.id && teacher.user_id !== user.id)) return <div className="rounded-lg border bg-white p-6">Student not found.</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>{student.full_name}</CardTitle></CardHeader>
        <CardContent className="grid gap-x-8 gap-y-3 md:grid-cols-2">
          {[
            ["Phone", student.phone],
            ["Level", student.level],
            ["Class", klass?.name ?? ""],
            ["Schedule", klass?.schedule ?? ""],
            ["Mode", student.learning_mode],
            ["Tags", Array.isArray(student.tags) ? student.tags.join(", ") : ""],
          ].map(([label, value]) => (
            <p key={label} className="flex justify-between gap-4 border-b py-1 text-sm">
              <span className="font-medium text-muted-foreground">{label}</span>
              <span className="text-right">{value}</span>
            </p>
          ))}
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle>Exams and level assessment</CardTitle></CardHeader><CardContent><DataTable rows={(exams.data ?? []).map((item) => ({ id: item.id, type: item.exam_type, date: academyDateOf(item.scheduled_at), result_level: item.level_result ?? "", score: item.score_percent == null ? "" : `${item.score_percent}%`, comment: item.result_comment ?? "" }))} columns={[{ key: "type", header: "Type" }, { key: "date", header: "Date" }, { key: "result_level", header: "Level" }, { key: "score", header: "%" }, { key: "comment", header: "Comment" }]} /></CardContent></Card>
      <Card><CardHeader><CardTitle>Feedback</CardTitle></CardHeader><CardContent><DataTable rows={(feedback.data ?? []).map((item) => ({ id: item.id, source: item.source, rating: item.rating ?? "", comment: item.comment, date: academyDateOf(item.created_at) }))} columns={[{ key: "source", header: "Source" }, { key: "rating", header: "Rating" }, { key: "comment", header: "Comment" }, { key: "date", header: "Date" }]} /></CardContent></Card>
      <Card><CardHeader><CardTitle>Attendance</CardTitle></CardHeader><CardContent><DataTable rows={(attendance.data ?? []).map((item) => ({ id: item.id, date: item.date, status: item.status }))} columns={[{ key: "date", header: "Date" }, { key: "status", header: "Status" }]} /></CardContent></Card>
    </div>
  );
}
