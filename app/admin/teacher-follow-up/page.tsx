import { StudentFollowUpManager } from "@/components/forms/student-follow-up-manager";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentLanguage } from "@/lib/i18n-server";
import { fetchAll } from "@/lib/supabase/fetch-all";

// Read-only preview of what teachers see. Comments are written by teachers from their own account.
export default async function AdminTeacherFollowUpPage() {
  const { supabase } = await getCurrentUser("admin");
  const lang = await getCurrentLanguage();
  const [students, classes, teachers, exams, feedback, attendance] = await Promise.all([
    fetchAll((from, to) => supabase.from("students").select("id,full_name,phone,email,level,tags,class_id,learning_mode,status,created_at").order("created_at", { ascending: false }).order("id").range(from, to)),
    supabase.from("classes").select("id,name,teacher_id,schedule").order("name"),
    supabase.from("teachers").select("id,name").order("name"),
    fetchAll((from, to) => supabase.from("exam_records").select("student_id,exam_type,scheduled_at,level_result,score_percent,result_comment").order("scheduled_at", { ascending: false }).order("id").range(from, to)),
    fetchAll((from, to) => supabase.from("feedback_records").select("id,student_id,teacher_id,source,rating,comment,created_at").order("created_at", { ascending: false }).order("id").range(from, to)),
    fetchAll((from, to) => supabase.from("student_attendance").select("student_id,date,status").order("date", { ascending: false }).order("id").range(from, to)),
  ]);
  const classRows = classes.data ?? [];
  const teacherRows = teachers.data ?? [];
  const rows = (students.data ?? []).map((student) => {
    const klass = classRows.find((item) => item.id === student.class_id);
    return {
      ...student,
      class_name: klass?.name ?? "",
      teacher_name: teacherRows.find((teacher) => teacher.id === klass?.teacher_id)?.name ?? "",
      schedule: klass?.schedule ?? "",
      account_notes: [],
      exams: (exams.data ?? []).filter((item) => item.student_id === student.id).map((item) => ({ type: item.exam_type, date: String(item.scheduled_at).slice(0, 10), level: item.level_result ?? "", score: item.score_percent == null ? "" : `${item.score_percent}%`, comment: item.result_comment ?? "" })),
      feedback: (feedback.data ?? []).filter((item) => item.student_id === student.id).map((item) => ({ id: item.id, teacher_id: item.teacher_id, source: item.source, rating: item.rating == null ? "" : String(item.rating), comment: item.comment, date: String(item.created_at).slice(0, 10) })),
      attendance: (attendance.data ?? []).filter((item) => item.student_id === student.id).map((item) => ({ date: item.date, status: item.status })),
    };
  });
  return <StudentFollowUpManager initialStudents={rows} classes={classRows.map((item) => ({ id: item.id, name: item.name }))} canEdit={false} mode="teacher" lang={lang} />;
}
