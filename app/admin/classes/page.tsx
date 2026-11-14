import { ClassManager } from "@/components/forms/class-manager";
import { getCurrentUser } from "@/lib/auth";
import { MIN_STUDENTS_FOR_SESSION } from "@/lib/class-progress";
import { isPromotionCandidate, promotionExamByStudent } from "@/lib/level-progression";
import { getCurrentLanguage } from "@/lib/i18n-server";
import { academyDate } from "@/lib/dates";
import { fetchAll } from "@/lib/supabase/fetch-all";

export default async function ClassesPage() {
  const { supabase } = await getCurrentUser("admin");
  const lang = await getCurrentLanguage();
  const today = academyDate();
  const [classes, teachers, exams, todayStudents, todayTeachers] = await Promise.all([
    supabase.from("classes").select("id,name,level,learning_mode,schedule,capacity,teacher_id,total_sessions,sessions_done,last_session_completed_date,class_status,current_chapter,teachers(name),students(id,full_name,phone,email,level,learning_mode,status,class_id,freeze_start_date,freeze_end_date)").order("created_at", { ascending: false }),
    supabase.from("teachers").select("id,name").order("name"),
    fetchAll((from, to) => supabase.from("exam_records").select("id,student_id,exam_type,level_result,score_percent,scheduled_at,created_at").order("scheduled_at", { ascending: false }).order("id").range(from, to)),
    fetchAll((from, to) => supabase.from("student_attendance").select("student_id,class_id").eq("date", today).in("status", ["present", "late"]).order("id").range(from, to)),
    supabase.from("teacher_attendance").select("teacher_id,check_in").eq("date", today),
  ]);
  const scansByClass = new Map<string, Set<string>>();
  for (const row of todayStudents.data ?? []) scansByClass.set(row.class_id, (scansByClass.get(row.class_id) ?? new Set<string>()).add(row.student_id));
  const teachersIn = new Set((todayTeachers.data ?? []).filter((row) => row.check_in).map((row) => row.teacher_id));
  const latestCompletedExam = promotionExamByStudent(exams.data ?? []);
  // Read-only: sessions are counted when attendance is saved (see /api/class-progress), never while rendering.
  const classesWithProgress = (classes.data ?? []).map((row) => ({
    ...row,
    students: (row.students ?? []).map((student) => {
      const exam = latestCompletedExam.get(student.id);
      return { ...student, promotion_candidate: isPromotionCandidate(student.level, exam?.level_result, exam?.score_percent), next_level: exam?.level_result ?? null };
    }),
    total_sessions: Number(row.total_sessions ?? 0),
    sessions_done: Number(row.sessions_done ?? 0),
    student_scan_count: scansByClass.get(row.id)?.size ?? 0,
    teacher_scanned: Boolean(row.teacher_id && teachersIn.has(row.teacher_id)),
    session_qualified: row.last_session_completed_date === today || ((scansByClass.get(row.id)?.size ?? 0) >= MIN_STUDENTS_FOR_SESSION && Boolean(row.teacher_id && teachersIn.has(row.teacher_id))),
  }));
  return <ClassManager initialClasses={classesWithProgress as never} teachers={teachers.data ?? []} lang={lang} />;
}
