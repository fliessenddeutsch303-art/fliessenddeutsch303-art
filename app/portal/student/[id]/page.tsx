import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/tables/data-table";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { extractPortalToken } from "@/lib/portal-token";

export default async function StudentPortalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: link } = await params;
  const token = extractPortalToken(link);
  const supabase = createSupabaseAdminClient();
  const studentResult = await supabase.from("students").select("id,full_name,level,class_id,learning_mode").eq("portal_token", token).single();
  const student = studentResult.data;
  if (!student) return <main className="p-8">Student link not found.</main>;
  const [classes, exams, feedback, attendance] = await Promise.all([
    supabase.from("classes").select("id,name,schedule,level,learning_mode").eq("id", student.class_id),
    supabase.from("exam_records").select("exam_type,scheduled_at,level_result,score_percent,result_comment").eq("student_id", student.id).order("scheduled_at", { ascending: false }),
    supabase.from("feedback_records").select("source,rating,comment,created_at").eq("student_id", student.id).order("created_at", { ascending: false }),
    supabase.from("student_attendance").select("date,status").eq("student_id", student.id).order("date", { ascending: false }),
  ]);
  const klass = (classes.data ?? []).find((item) => item.id === student.class_id);
  return (
    <main className="min-h-screen bg-[#FCFAF6] p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <Card><CardHeader className="flex-row items-center gap-4"><Image src="/fliessend-logo-transparent.png" alt="Fließend Deutsch" width={120} height={70} /><div><CardTitle>{student.full_name}</CardTitle><p className="text-sm text-muted-foreground">{student.level} · {student.learning_mode}</p></div></CardHeader><CardContent><p><strong>Class:</strong> {klass?.name ?? ""}</p><p><strong>Schedule:</strong> {klass?.schedule ?? ""}</p></CardContent></Card>
        <Card><CardHeader><CardTitle>Exams</CardTitle></CardHeader><CardContent><DataTable rows={(exams.data ?? []).map((item, index) => ({ id: index, type: item.exam_type, date: String(item.scheduled_at).slice(0, 10), level: item.level_result ?? "", score: item.score_percent ?? "", comment: item.result_comment ?? "" }))} columns={[{ key: "type", header: "Type" }, { key: "date", header: "Date" }, { key: "level", header: "Level" }, { key: "score", header: "%" }, { key: "comment", header: "Comment" }]} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Attendance</CardTitle></CardHeader><CardContent><DataTable rows={(attendance.data ?? []).map((item, index) => ({ id: index, date: item.date, status: item.status }))} columns={[{ key: "date", header: "Date" }, { key: "status", header: "Status" }]} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Feedback</CardTitle></CardHeader><CardContent><DataTable rows={(feedback.data ?? []).map((item, index) => ({ id: index, source: item.source, rating: item.rating ?? "", comment: item.comment, date: String(item.created_at).slice(0, 10) }))} columns={[{ key: "source", header: "Source" }, { key: "rating", header: "Rating" }, { key: "comment", header: "Comment" }, { key: "date", header: "Date" }]} /></CardContent></Card>
      </div>
    </main>
  );
}
