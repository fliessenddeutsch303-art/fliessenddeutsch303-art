import { FeedbackRecordForm } from "@/components/forms/client-addition-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/tables/data-table";
import { getCurrentUser } from "@/lib/auth";
import { fetchAll } from "@/lib/supabase/fetch-all";

export default async function FeedbackPage() {
  const { supabase } = await getCurrentUser("admin");
  const [feedback, students, teachers] = await Promise.all([
    fetchAll((from, to) => supabase.from("feedback_records").select("*").order("created_at", { ascending: false }).order("id").range(from, to)),
    fetchAll((from, to) => supabase.from("students").select("id,full_name").order("full_name").order("id").range(from, to)),
    supabase.from("teachers").select("id,name"),
  ]);
  const rows = (feedback.data ?? []).map((item) => ({
    id: item.id,
    student: (students.data ?? []).find((student) => student.id === item.student_id)?.full_name ?? item.student_id,
    teacher: (teachers.data ?? []).find((teacher) => teacher.id === item.teacher_id)?.name ?? "",
    source: item.source === "teacher" ? "Teacher on student" : "Student feedback",
    rating: item.rating ?? "",
    comment: item.comment,
    date: String(item.created_at).slice(0, 10),
  }));
  return (
    <div className="space-y-6">
      <FeedbackRecordForm students={students.data ?? []} teachers={teachers.data ?? []} />
      <Card>
        <CardHeader><CardTitle>Feedback history</CardTitle></CardHeader>
        <CardContent>
          <DataTable rows={rows} columns={[{ key: "student", header: "Student" }, { key: "teacher", header: "Teacher" }, { key: "source", header: "Source" }, { key: "rating", header: "Rating" }, { key: "comment", header: "Comment" }, { key: "date", header: "Date" }]} />
        </CardContent>
      </Card>
    </div>
  );
}
