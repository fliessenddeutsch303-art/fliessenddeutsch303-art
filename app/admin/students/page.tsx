import { StudentManager } from "@/components/forms/student-manager";
import { getCurrentUser } from "@/lib/auth";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { isPromotionCandidate, promotionExamByStudent } from "@/lib/level-progression";

export default async function AdminStudentsPage() {
  const { supabase } = await getCurrentUser("admin");
  const [students, classes, exams] = await Promise.all([
    fetchAll((from, to) => supabase.from("students").select("id,full_name,phone,email,level,tags,class_id,learning_mode,status,total_price,amount_paid,payment_due_date,payment_comment,freeze_start_date,freeze_months,freeze_end_date,level_completed_stopped,enrolled_at,created_at,portal_token,classes(name,teachers(name))").order("created_at", { ascending: false }).order("id").range(from, to)),
    supabase.from("classes").select("id,name,level").order("name"),
    fetchAll((from, to) => supabase.from("exam_records").select("id,student_id,exam_type,level_result,score_percent,scheduled_at,created_at").order("scheduled_at", { ascending: false }).order("id").range(from, to)),
  ]);
  const latestExamByStudent = promotionExamByStudent(exams.data ?? []);
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
