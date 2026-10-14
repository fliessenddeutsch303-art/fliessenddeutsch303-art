import { ClassManager } from "@/components/forms/class-manager";
import { getCurrentUser } from "@/lib/auth";
import { refreshClassSessionProgress } from "@/lib/class-progress";
import { isPromotionCandidate } from "@/lib/level-progression";

export default async function ClassesPage() {
  const { supabase } = await getCurrentUser("admin");
  const [classes, teachers, exams] = await Promise.all([
    supabase.from("classes").select("id,name,level,learning_mode,schedule,capacity,teacher_id,total_sessions,sessions_done,last_session_completed_date,class_status,current_chapter,teachers(name),students(id,full_name,phone,email,level,learning_mode,status)").order("created_at", { ascending: false }),
    supabase.from("teachers").select("id,name").order("name"),
    supabase.from("exam_records").select("student_id,exam_type,level_result,score_percent,scheduled_at").order("scheduled_at", { ascending: false }),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const latestCompletedExam = new Map<string, { level_result?: string | null; score_percent?: number | null }>();
  for (const exam of exams.data ?? []) {
    if (!latestCompletedExam.has(exam.student_id) && exam.exam_type !== "quiz" && exam.level_result) latestCompletedExam.set(exam.student_id, exam);
  }
  const classesWithProgress = await Promise.all((classes.data ?? []).map(async (row) => ({
    ...row,
    students: (row.students ?? []).map((student) => {
      const exam = latestCompletedExam.get(student.id);
      return { ...student, promotion_candidate: isPromotionCandidate(student.level, exam?.level_result, exam?.score_percent), next_level: exam?.level_result ?? null };
    }),
    ...(await refreshClassSessionProgress(supabase, row.id, today)),
  })));
  return <ClassManager initialClasses={classesWithProgress as never} teachers={teachers.data ?? []} />;
}
