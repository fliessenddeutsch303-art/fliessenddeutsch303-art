import { StudentManager } from "@/components/forms/student-manager";
import { AccountRecordForm } from "@/components/forms/client-addition-forms";
import { getCurrentUser } from "@/lib/auth";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { groupBooks } from "@/lib/student-books";

export default async function ReceptionStudentsPage() {
  const { supabase, profile } = await getCurrentUser("reception");
  const [students, classes, teachers, books, textbooks] = await Promise.all([
    // Freeze fields must be loaded, otherwise saving an edit clears a student's freeze.
    fetchAll((from, to) => supabase.from("students").select("id,full_name,phone,email,level,tags,class_id,learning_mode,status,total_price,amount_paid,payment_due_date,payment_comment,freeze_start_date,freeze_months,freeze_end_date,level_completed_stopped,enrolled_at,created_at,portal_token,classes(name,teachers(name))").order("created_at", { ascending: false }).order("id").range(from, to)),
    supabase.from("classes").select("id,name").order("name"),
    supabase.from("teachers").select("id,name").order("name"),
    fetchAll((from, to) => supabase.from("student_books").select("*").order("received_at", { ascending: false }).order("id").range(from, to)),
    supabase.from("textbook_inventory").select("id,title,level,quantity_on_hand").order("title"),
  ]);
  const booksByStudent = groupBooks(books.data ?? []);
  const studentRows = ((students.data ?? []) as Array<{ id: string; full_name: string }>).map((student) => ({ ...student, books: booksByStudent.get(student.id) ?? [] }));
  return (
    <div className="space-y-6">
      <AccountRecordForm students={studentRows.map((student) => ({ id: student.id, full_name: student.full_name }))} classes={classes.data ?? []} teachers={teachers.data ?? []} users={[{ id: profile.id, full_name: profile.full_name }]} />
      <StudentManager initialStudents={studentRows as never} classes={classes.data ?? []} canViewProfile={false} textbooks={textbooks.data ?? []} />
    </div>
  );
}
