import type { StudentBook } from "@/components/forms/student-books-dialog";

/** Groups student_books rows by student, newest first as loaded. */
export function groupBooks(rows: Array<Record<string, unknown>>) {
  const byStudent = new Map<string, StudentBook[]>();
  for (const row of rows) {
    const book = { ...row, price: Number(row.price ?? 0) } as StudentBook;
    byStudent.set(book.student_id, [...(byStudent.get(book.student_id) ?? []), book]);
  }
  return byStudent;
}
