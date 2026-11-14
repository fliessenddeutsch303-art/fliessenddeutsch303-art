import { StudentFollowUpManager } from "@/components/forms/student-follow-up-manager";
import { getCurrentUser } from "@/lib/auth";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { getCurrentLanguage } from "@/lib/i18n-server";

export default async function TeacherFollowUpPage() {
  const { supabase, user, profile } = await getCurrentUser("teacher");
  const lang = await getCurrentLanguage();
  const teachersResult = await supabase.from("teachers").select("id,name,user_id").order("name");
  const teacher = (teachersResult.data ?? []).find((item) => item.user_id === profile.id || item.user_id === user.id);
  if (!teacher) return <p className="rounded-md border bg-white p-6 text-sm text-muted-foreground">Your login is not linked to a teacher record yet. Ask the admin to open Account Center and save your account.</p>;
  // no prices or payments for teachers
  const [students, classes, teachers, exams, feedback, attendance] = await Promise.all([
    supabase.from("students").select("id,full_name,phone,email,level,tags,class_id,learning_mode,status,created_at").order("created_at", { ascending: false }),
    supabase.from("classes").select("id,name,teacher_id,level,learning_mode,schedule").eq("teacher_id", teacher.id),
    supabase.from("teachers").select("id,name").order("name"),
    supabase.from("exam_records").select("student_id,exam_type,scheduled_at,level_result,score_percent,result_comment").order("scheduled_at", { ascending: false }),
    supabase.from("feedback_records").select("id,student_id,teacher_id,source,rating,comment,created_at").order("created_at", { ascending: false }),
    fetchAll((from, to) => supabase.from("student_attendance").select("student_id,date,status").order("date", { ascending: false }).order("id").range(from, to)),
  ]);
  const classRows = classes.data ?? [];
  const classIds = new Set(classRows.map((item) => item.id));
  const teacherRows = teachers.data ?? [];
  const followUpRows = (students.data ?? []).filter((student) => classIds.has(student.class_id ?? "")).map((student) => {
    const klass = classRows.find((item) => item.id === student.class_id);
    const rowTeacher = teacherRows.find((item) => item.id === klass?.teacher_id);
    return {
      ...student,
      class_name: klass?.name ?? "",
      teacher_name: rowTeacher?.name ?? "",
      schedule: klass?.schedule ?? "",
      account_notes: [],
      exams: (exams.data ?? []).filter((item) => item.student_id === student.id).map((item) => ({
        type: item.exam_type,
        date: String(item.scheduled_at).slice(0, 10),
        level: item.level_result ?? "",
        score: item.score_percent == null ? "" : `${item.score_percent}%`,
        comment: item.result_comment ?? "",
      })),
      feedback: (feedback.data ?? []).filter((item) => item.student_id === student.id).map((item) => ({
        id: item.id,
        teacher_id: item.teacher_id,
        source: item.source,
        rating: item.rating == null ? "" : String(item.rating),
        comment: item.comment,
        date: String(item.created_at).slice(0, 10),
      })),
      attendance: (attendance.data ?? []).filter((item) => item.student_id === student.id).map((item) => ({
        date: item.date,
        status: item.status,
      })),
    };
  });

  return <StudentFollowUpManager initialStudents={followUpRows} classes={classRows.map((item) => ({ id: item.id, name: item.name }))} canEdit={false} mode="teacher" teacherId={teacher.id} lang={lang} />;
}
