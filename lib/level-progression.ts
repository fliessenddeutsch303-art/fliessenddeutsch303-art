export const PASS_MARK = 70;
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

export function nextLevel(level: string | null | undefined) {
  const index = LEVELS.indexOf(String(level ?? "").toUpperCase());
  return index >= 0 && index < LEVELS.length - 1 ? LEVELS[index + 1] : null;
}

export function isPromotionCandidate(currentLevel: string | null | undefined, resultLevel: string | null | undefined, score: number | null | undefined) {
  const current = String(currentLevel ?? "").toUpperCase();
  const result = String(resultLevel ?? "").toUpperCase();
  const expected = nextLevel(current);
  return Boolean(expected && result === expected && Number(score ?? 0) >= PASS_MARK);
}

type PromotionExam = { id?: string | null; exam_type: string; scheduled_at?: string | null; created_at?: string | null; level_result?: string | null; score_percent?: number | null };

function newestFirst(a: PromotionExam, b: PromotionExam) {
  return String(b.scheduled_at ?? "").localeCompare(String(a.scheduled_at ?? "")) || String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")) || String(a.id ?? "").localeCompare(String(b.id ?? ""));
}

/** The exam row that decides promotion: the latest scored `main` row, otherwise the latest non-quiz row with a level result (scored ones first). `created_at` and `id` only break ties and may be missing. */
export function promotionExam<T extends PromotionExam>(exams: T[]): T | null {
  const sorted = [...exams].sort(newestFirst);
  const withResult = sorted.filter((exam) => exam.exam_type !== "quiz" && exam.level_result);
  return sorted.find((exam) => exam.exam_type === "main" && exam.score_percent != null) ?? withResult.find((exam) => exam.score_percent != null) ?? withResult[0] ?? null;
}

/** Groups exam rows by student and picks the deciding row for each. */
export function promotionExamByStudent<T extends PromotionExam & { student_id?: string | null }>(exams: T[]) {
  const grouped = new Map<string, T[]>();
  for (const exam of exams) if (exam.student_id) grouped.set(exam.student_id, [...(grouped.get(exam.student_id) ?? []), exam]);
  return new Map([...grouped].map(([studentId, rows]) => [studentId, promotionExam(rows)] as const));
}

/** Adds whole months to a YYYY-MM-DD date, clamping to the last day of the target month (31 Jan + 1 month = 28/29 Feb). */
export function addMonthsClamped(date: string, months: number) {
  const [year, month, day] = date.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "";
  const target = month - 1 + months;
  const targetYear = year + Math.floor(target / 12);
  const targetMonth = ((target % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}
