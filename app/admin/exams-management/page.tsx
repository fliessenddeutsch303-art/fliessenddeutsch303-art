import { ExamRecordForm } from "@/components/forms/client-addition-forms";
import { ExamManager } from "@/components/forms/exam-manager";
import { getCurrentUser } from "@/lib/auth";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { academyDateOf } from "@/lib/dates";
import { PASS_MARK } from "@/lib/level-progression";

type Exam = {
  id: string;
  student_id: string | null;
  exam_type: string;
  scheduled_at: string;
  created_at?: string | null;
  level_result: string | null;
  score_percent: number | null;
  result_comment: string | null;
  booking_status?: string | null;
  booked_class_id?: string | null;
};

export default async function ExamsManagementPage() {
  const { supabase } = await getCurrentUser("admin");
  const [students, classes, exams] = await Promise.all([
    fetchAll((from, to) => supabase.from("students").select("id,full_name,level,class_id").order("full_name").order("id").range(from, to)),
    supabase.from("classes").select("id,name").order("name"),
    fetchAll((from, to) => supabase.from("exam_records").select("id,student_id,exam_type,scheduled_at,level_result,score_percent,result_comment,booking_status,booked_class_id,created_at").order("scheduled_at", { ascending: false }).order("created_at", { ascending: false }).order("id").range(from, to)),
  ]);
  const classRows = classes.data ?? [];
  const examRows = (exams.data ?? []) as Exam[];
  const examsByStudent = new Map<string, Exam[]>();
  for (const exam of examRows) if (exam.student_id) examsByStudent.set(exam.student_id, [...(examsByStudent.get(exam.student_id) ?? []), exam]);
  const rows = (students.data ?? []).map((student) => {
    const studentExams = examsByStudent.get(student.id) ?? [];
    const levelTest = studentExams.find((exam) => exam.exam_type === "placement") ?? null;
    const quiz = studentExams.find((exam) => exam.exam_type === "quiz") ?? null;
    const mainTest = studentExams.find((exam) => exam.exam_type === "main") ?? null;
    const bookingRow = mainTest ?? levelTest;
    const nextLevelBooking = bookingRow?.booking_status === "booked";
    const bookedClassId = nextLevelBooking ? bookingRow?.booked_class_id ?? null : null;
    return {
      id: student.id,
      student_id: student.id,
      level_test_id: levelTest?.id ?? null,
      quiz_id: quiz?.id ?? null,
      main_test_id: mainTest?.id ?? null,
      full_name: student.full_name,
      current_level: student.level,
      level_test_date: levelTest ? academyDateOf(levelTest.scheduled_at) : undefined,
      level_test_taken: Boolean(levelTest && (levelTest.score_percent != null || levelTest.level_result)),
      level_result: levelTest?.level_result,
      level_test_score: levelTest?.score_percent,
      level_test_comment: levelTest?.result_comment,
      quiz_result: quiz ? `${quiz.score_percent == null ? "" : `${quiz.score_percent}%`} ${quiz.result_comment ?? ""}`.trim() : null,
      quiz_score: quiz?.score_percent,
      quiz_comment: quiz?.result_comment,
      main_test_result: mainTest?.score_percent == null ? null : `${mainTest.score_percent}% ${mainTest.result_comment ?? ""}`.trim(),
      main_score: mainTest?.score_percent,
      main_comment: mainTest?.result_comment,
      main_test_passed: mainTest?.score_percent == null ? null : mainTest.score_percent >= PASS_MARK,
      next_level_booked: Boolean(nextLevelBooking),
      booked_class_id: bookedClassId,
      other_exams: studentExams.filter((exam) => exam.exam_type === "osd" || exam.exam_type === "internal").map((exam) => ({ type: exam.exam_type, date: academyDateOf(exam.scheduled_at), score: exam.score_percent == null ? "" : `${exam.score_percent}%`, result: exam.level_result ?? "" })),
      booked_group: classRows.find((item) => item.id === bookedClassId)?.name ?? null,
    };
  });

  return <div className="space-y-6"><ExamRecordForm students={students.data ?? []} classes={classRows} /><ExamManager rows={rows} classes={classRows} /></div>;
}
