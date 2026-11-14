import { ExamRecordForm } from "@/components/forms/client-addition-forms";
import { StudentFollowUpManager } from "@/components/forms/student-follow-up-manager";
import { getCurrentUser } from "@/lib/auth";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { getCurrentLanguage } from "@/lib/i18n-server";
import { academyDateOf } from "@/lib/dates";
import { isPromotionCandidate, promotionExam } from "@/lib/level-progression";

export default async function StudentsFollowUpPage() {
  const { supabase } = await getCurrentUser("admin");
  const lang = await getCurrentLanguage();
  const [students, classes, teachers, users, accounts, exams, feedback, attendance, workerFeedback] = await Promise.all([
    fetchAll((from, to) => supabase.from("students").select("id,full_name,phone,email,level,tags,class_id,learning_mode,status,total_price,amount_paid,payment_due_date,payment_comment,created_at").order("created_at", { ascending: false }).order("id").range(from, to)),
    supabase.from("classes").select("id,name,teacher_id,level,learning_mode,schedule").order("name"),
    supabase.from("teachers").select("id,name").order("name"),
    supabase.from("users").select("id,full_name,role").order("full_name"),
    fetchAll((from, to) => supabase.from("student_account_records").select("student_id,amount,status,due_date,notes,created_at").order("created_at", { ascending: false }).order("id").range(from, to)),
    fetchAll((from, to) => supabase.from("exam_records").select("id,student_id,exam_type,scheduled_at,created_at,level_result,score_percent,result_comment").order("scheduled_at", { ascending: false }).order("created_at", { ascending: false }).order("id").range(from, to)),
    fetchAll((from, to) => supabase.from("feedback_records").select("id,student_id,teacher_id,source,rating,comment,created_at").order("created_at", { ascending: false }).order("id").range(from, to)),
    fetchAll((from, to) => supabase.from("student_attendance").select("student_id,date,status").order("date", { ascending: false }).order("id").range(from, to)),
    fetchAll((from, to) => supabase.from("student_worker_feedback").select("id,student_id,target_user_id,target_teacher_id,target_role,comment,created_at").order("created_at", { ascending: false }).order("id").range(from, to)),
  ]);

  const classRows = classes.data ?? [];
  const teacherRows = teachers.data ?? [];
  const groupBy = <T extends { student_id: string | null }>(rows: T[]) => {
    const map = new Map<string, T[]>();
    for (const item of rows) if (item.student_id) map.set(item.student_id, [...(map.get(item.student_id) ?? []), item]);
    return map;
  };
  const classById = new Map(classRows.map((item) => [item.id, item]));
  const teacherById = new Map(teacherRows.map((item) => [item.id, item]));
  const userById = new Map((users.data ?? []).map((item) => [item.id, item]));
  const examsByStudent = groupBy(exams.data ?? []);
  const accountsByStudent = groupBy(accounts.data ?? []);
  const feedbackByStudent = groupBy(feedback.data ?? []);
  const attendanceByStudent = groupBy(attendance.data ?? []);
  const workerByStudent = groupBy(workerFeedback.data ?? []);
  const followUpRows = (students.data ?? []).map((student) => {
    const klass = classById.get(student.class_id ?? "");
    const teacher = teacherById.get(klass?.teacher_id ?? "");
    const studentExams = examsByStudent.get(student.id) ?? [];
    // Promotion uses the latest main row, else the latest non-quiz row with a result.
    const latestExam = promotionExam(studentExams);
    return {
      ...student,
      class_name: klass?.name ?? "",
      teacher_name: teacher?.name ?? "",
      schedule: klass?.schedule ?? "",
      account_notes: (accountsByStudent.get(student.id) ?? []).map((item) => `${item.status} ${item.due_date ?? ""}: ${item.notes ?? ""}`),
      promotion_candidate: isPromotionCandidate(student.level, latestExam?.level_result, latestExam?.score_percent),
      next_level: latestExam?.level_result ?? "",
      exams: studentExams.map((item) => ({
        type: item.exam_type,
        date: academyDateOf(item.scheduled_at),
        level: item.level_result ?? "",
        score: item.score_percent == null ? "" : `${item.score_percent}%`,
        comment: item.result_comment ?? "",
      })),
      feedback: (feedbackByStudent.get(student.id) ?? []).map((item) => ({
        id: item.id,
        teacher_id: item.teacher_id,
        source: item.source,
        rating: item.rating == null ? "" : String(item.rating),
        comment: item.comment,
        date: academyDateOf(item.created_at),
      })),
      attendance: (attendanceByStudent.get(student.id) ?? []).map((item) => ({
        date: item.date,
        status: item.status,
      })),
      worker_comments: (workerByStudent.get(student.id) ?? []).map((item) => ({
        worker: item.target_role === "teacher"
          ? teacherById.get(item.target_teacher_id ?? "")?.name ?? "Teacher"
          : userById.get(item.target_user_id ?? "")?.full_name ?? "Reception",
        role: item.target_role,
        comment: item.comment,
        date: academyDateOf(item.created_at),
      })),
    };
  });

  return (
    <div className="space-y-6">
      <ExamRecordForm students={students.data ?? []} />
      <StudentFollowUpManager initialStudents={followUpRows} classes={classRows.map((item) => ({ id: item.id, name: item.name }))} lang={lang} />
    </div>
  );
}
