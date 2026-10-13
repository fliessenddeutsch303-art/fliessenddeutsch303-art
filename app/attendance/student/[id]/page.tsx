import Image from "next/image";
import { StudentWorkerCommentForm } from "@/components/forms/student-worker-comment-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { refreshClassSessionProgress } from "@/lib/class-progress";
import { extractPortalToken } from "@/lib/portal-token";

export default async function StudentQrAttendancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: link } = await params;
  const token = extractPortalToken(link);
  const supabase = createSupabaseAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data: student } = await supabase.from("students").select("id,full_name,class_id,portal_token,classes(name,schedule,teacher_id)").eq("portal_token", token).single();

  if (!student) {
    return (
      <main className="min-h-screen bg-[#FCFAF6] p-4">
        <Card className="mx-auto mt-10 max-w-lg">
          <CardHeader><CardTitle>Student not found</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">Please ask reception to check the student link.</CardContent>
        </Card>
      </main>
    );
  }

  if (!student.class_id) {
    return (
      <main className="min-h-screen bg-[#FCFAF6] p-4">
        <Card className="mx-auto mt-10 max-w-lg">
          <CardHeader><CardTitle>Class not assigned</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">{student.full_name} needs a class before attendance can be registered.</CardContent>
        </Card>
      </main>
    );
  }

  const existing = await supabase.from("student_attendance").select("id").eq("student_id", student.id).eq("class_id", student.class_id).eq("date", today).maybeSingle();
  if (existing.data?.id) {
    await supabase.from("student_attendance").update({ status: "present" }).eq("id", existing.data.id);
  } else {
    await supabase.from("student_attendance").insert({
      student_id: student.id,
      class_id: student.class_id,
      date: today,
      status: "present",
      recorded_by: null,
    });
  }
  await refreshClassSessionProgress(supabase, student.class_id, today);

  const classInfo = student.classes as { name?: string; schedule?: string } | null;
  const classWithTeacher = student.classes as { teacher_id?: string | null } | null;
  const [teachers, receptionists] = await Promise.all([
    supabase.from("teachers").select("id,name").order("name"),
    supabase.from("users").select("id,full_name,role").eq("role", "reception").order("full_name"),
  ]);
  const teacherOptions = (teachers.data ?? [])
    .filter((teacher) => !classWithTeacher?.teacher_id || teacher.id === classWithTeacher.teacher_id)
    .map((teacher) => ({ value: `teacher:${teacher.id}`, label: `Teacher - ${teacher.name}` }));
  const receptionistOptions = (receptionists.data ?? []).map((user) => ({ value: `reception:${user.id}`, label: `Reception - ${user.full_name}` }));
  const workerOptions = [...teacherOptions, ...receptionistOptions];
  return (
    <main className="min-h-screen bg-[#FCFAF6] p-4">
      <Card className="mx-auto mt-10 max-w-lg overflow-hidden">
        <CardHeader className="items-center text-center">
          <Image src="/fliessend-logo-transparent.png" alt="Fließend Deutsch" width={180} height={100} className="object-contain" />
          <CardTitle>Attendance registered</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-center">
          <p className="text-2xl font-semibold text-primary">{student.full_name}</p>
          <p className="text-sm text-muted-foreground">Marked present for {today}</p>
          <div className="rounded-lg border bg-white p-4 text-sm">
            <p><strong>Class:</strong> {classInfo?.name ?? ""}</p>
            <p><strong>Schedule:</strong> {classInfo?.schedule ?? ""}</p>
          </div>
          <StudentWorkerCommentForm studentToken={student.portal_token} workers={workerOptions} />
        </CardContent>
      </Card>
    </main>
  );
}
