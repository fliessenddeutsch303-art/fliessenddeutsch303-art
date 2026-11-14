import { academyDateOf } from "@/lib/dates";

export type StudentPayment = { id: string; amount: number; paid_at: string; receipt_no?: string | null };

// paid_at as a Cairo date, newest first
export function groupPayments(rows: Array<{ id: string; student_id: string; amount: number | string | null; paid_at: string | null; receipt_no?: string | null }>) {
  const byStudent = new Map<string, StudentPayment[]>();
  for (const row of rows) {
    if (!row.paid_at) continue;
    const payment = { id: row.id, amount: Number(row.amount ?? 0), paid_at: academyDateOf(row.paid_at), receipt_no: row.receipt_no ?? null };
    byStudent.set(row.student_id, [...(byStudent.get(row.student_id) ?? []), payment]);
  }
  for (const list of byStudent.values()) list.sort((a, b) => b.paid_at.localeCompare(a.paid_at));
  return byStudent;
}
