import { StudentManager } from "@/components/forms/student-manager";
import { getCurrentUser } from "@/lib/auth";
import { isPromotionCandidate } from "@/lib/level-progression";

export default async function AdminStudentsPage() {
  const { supabase } = await getCurrentUser("admin");
  const [students, classes, exams] = await Promise.all([
    supabase.from("students").select("id,full_name,phone,email,level,tags,class_id,learning_mode,status,total_price,amount_paid,payment_due_date,payment_comment,freeze_start_date,freeze_months,freeze_end_date,level_completed_stopped,enrolled_at,created_at,classes(name,teachers(name))").order("created_at", { ascending: false }),
    supabase.from("classes").select("id,name,level").order("name"),
    supabase.from("exam_records").select("student_id,exam_type,level_result,score_percent,scheduled_at").order("scheduled_at", { ascending: false }),
  ]);
  const latestExamByStudent = new Map<string, { level_result?: string | null; score_percent?: number | null }>();
  for (const exam of exams.data ?? []) {
    if (!latestExamByStudent.has(exam.student_id) && exam.exam_type !== "quiz") latestExamByStudent.set(exam.student_id, exam);
  }
  const rows = (students.data ?? []).map((student) => {
    const latestExam = latestExamByStudent.get(student.id);
    return {
      ...student,
      promotion_candidate: isPromotionCandidate(student.level, latestExam?.level_result, latestExam?.score_percent),
      next_level: latestExam?.level_result ?? null,
    };
  });
  return <StudentManager initialStudents={rows as never} classes={classes.data ?? []} />;
}
