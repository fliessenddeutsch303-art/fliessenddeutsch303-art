import { ExamRecordForm } from "@/components/forms/client-addition-forms";
import { StudentFollowUpManager } from "@/components/forms/student-follow-up-manager";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentLanguage } from "@/lib/i18n-server";
import { isPromotionCandidate } from "@/lib/level-progression";

export default async function StudentsFollowUpPage() {
  const { supabase } = await getCurrentUser("admin");
  const lang = await getCurrentLanguage();
  const [students, classes, teachers, users, accounts, exams, feedback, attendance, workerFeedback] = await Promise.all([
    supabase.from("students").select("id,full_name,phone,email,level,tags,class_id,learning_mode,status,total_price,amount_paid,payment_due_date,payment_comment,created_at").order("created_at", { ascending: false }),
    supabase.from("classes").select("id,name,teacher_id,level,learning_mode,schedule").order("name"),
    supabase.from("teachers").select("id,name").order("name"),
    supabase.from("users").select("id,full_name,role").order("full_name"),
    supabase.from("student_account_records").select("student_id,amount,status,due_date,notes,created_at").order("created_at", { ascending: false }),
    supabase.from("exam_records").select("student_id,exam_type,scheduled_at,level_result,score_percent,result_comment").order("scheduled_at", { ascending: false }),
    supabase.from("feedback_records").select("id,student_id,teacher_id,source,rating,comment,created_at").order("created_at", { ascending: false }),
    supabase.from("student_attendance").select("student_id,date,status").order("date", { ascending: false }),
    supabase.from("student_worker_feedback").select("student_id,target_user_id,target_teacher_id,target_role,comment,created_at").order("created_at", { ascending: false }),
  ]);

  const classRows = classes.data ?? [];
  const teacherRows = teachers.data ?? [];
  const followUpRows = (students.data ?? []).map((student) => {
    const klass = classRows.find((item) => item.id === student.class_id);
    const teacher = teacherRows.find((item) => item.id === klass?.teacher_id);
    const studentExams = (exams.data ?? []).filter((item) => item.student_id === student.id);
    // Ignore newer quiz/main-test rows without a level result. Promotion is
    // based on the latest completed placement result.
    const latestExam = studentExams.find((item) => item.exam_type !== "quiz" && item.level_result);
    return {
      ...student,
      class_name: klass?.name ?? "",
      teacher_name: teacher?.name ?? "",
      schedule: klass?.schedule ?? "",
      account_notes: (accounts.data ?? []).filter((item) => item.student_id === student.id).map((item) => `${item.status} ${item.due_date ?? ""}: ${item.notes ?? ""}`),
      promotion_candidate: isPromotionCandidate(student.level, latestExam?.level_result, latestExam?.score_percent),
      next_level: latestExam?.level_result ?? "",
      exams: studentExams.map((item) => ({
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
      worker_comments: (workerFeedback.data ?? []).filter((item) => item.student_id === student.id).map((item) => ({
        worker: item.target_role === "teacher"
          ? teacherRows.find((teacherRow) => teacherRow.id === item.target_teacher_id)?.name ?? "Teacher"
          : (users.data ?? []).find((user) => user.id === item.target_user_id)?.full_name ?? "Reception",
        role: item.target_role,
        comment: item.comment,
        date: String(item.created_at).slice(0, 10),
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
