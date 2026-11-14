import Image from "next/image";
import { StudentWorkerCommentForm } from "@/components/forms/student-worker-comment-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { refreshClassSessionProgress } from "@/lib/class-progress";
import { extractPortalToken } from "@/lib/portal-token";
import { academyDate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/** Recording happens on an explicit POST so link previews and prefetches cannot mark attendance. */
async function confirmAttendance(formData: FormData) {
  "use server";
  const token = extractPortalToken(String(formData.get("token") ?? ""));
  const supabase = createSupabaseAdminClient();
  const today = academyDate();
  const link = String(formData.get("link") ?? "");
  const { data: student } = await supabase.from("students").select("id,class_id").eq("portal_token", token).maybeSingle();
  if (!student?.class_id) redirect(`/attendance/student/${link}?error=1`);
  // Never overwrite what reception recorded: only a missing or absent row becomes present.
  const { data: existing, error: readError } = await supabase.from("student_attendance").select("status").eq("student_id", student.id).eq("class_id", student.class_id).eq("date", today).maybeSingle();
  if (readError) redirect(`/attendance/student/${link}?error=1`);
  if (!existing || existing.status === "absent") {
    const { error } = await supabase.from("student_attendance").upsert(
      { student_id: student.id, class_id: student.class_id, date: today, status: "present", recorded_by: null },
      { onConflict: "student_id,class_id,date" },
    );
    if (error) redirect(`/attendance/student/${link}?error=1`);
    await refreshClassSessionProgress(supabase, student.class_id, today);
  }
  revalidatePath(`/attendance/student/${link}`);
}

export default async function StudentQrAttendancePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id: link } = await params;
  const { error: submitError } = await searchParams;
  const token = extractPortalToken(link);
  const supabase = createSupabaseAdminClient();
  const today = academyDate();
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

  const { data: existing } = await supabase.from("student_attendance").select("status").eq("student_id", student.id).eq("class_id", student.class_id).eq("date", today).maybeSingle();
  const registered = existing?.status === "present" || existing?.status === "late";

  const classInfo = student.classes as { name?: string; schedule?: string } | null;
  const classWithTeacher = student.classes as { teacher_id?: string | null } | null;
  const [teachers, receptionists] = await Promise.all([
    classWithTeacher?.teacher_id ? supabase.from("teachers").select("id,name").eq("id", classWithTeacher.teacher_id) : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    supabase.from("users").select("id,full_name,role").eq("role", "reception").eq("is_active", true).order("full_name"),
  ]);
  const teacherOptions = (teachers.data ?? [])
    .map((teacher) => ({ value: `teacher:${teacher.id}`, label: `Teacher - ${teacher.name}` }));
  const receptionistOptions = (receptionists.data ?? []).map((user) => ({ value: `reception:${user.id}`, label: `Reception - ${user.full_name}` }));
  const workerOptions = [...teacherOptions, ...receptionistOptions];
  return (
    <main className="min-h-screen bg-[#FCFAF6] p-4">
      <Card className="mx-auto mt-10 max-w-lg overflow-hidden">
        <CardHeader className="items-center text-center">
          <Image src="/fliessend-logo-transparent.webp" alt="Fließend Deutsch" width={180} height={100} className="object-contain" />
          <CardTitle>{registered ? "Attendance registered" : "Check in to class"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-center">
          <p className="text-2xl font-semibold text-primary">{student.full_name}</p>
          {submitError && !registered && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">Could not record attendance, please tell reception.</p>}
          {registered
            ? <p className="text-sm text-muted-foreground">Marked present for {today}</p>
            : <form action={confirmAttendance}><input type="hidden" name="token" value={student.portal_token} /><input type="hidden" name="link" value={link} /><Button size="lg" className="w-full">I am here — register my attendance for {today}</Button></form>}
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
