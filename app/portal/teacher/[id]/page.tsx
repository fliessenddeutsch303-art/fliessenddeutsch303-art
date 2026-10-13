import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/tables/data-table";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { extractPortalToken } from "@/lib/portal-token";

export default async function TeacherPortalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: link } = await params;
  const token = extractPortalToken(link);
  const supabase = createSupabaseAdminClient();
  const teacherResult = await supabase.from("teachers").select("*").eq("portal_token", token).single();
  const teacher = teacherResult.data;
  if (!teacher) return <main className="p-8">Teacher link not found.</main>;
  const [classes, attendance, feedback] = await Promise.all([
    supabase.from("classes").select("id,name,level,learning_mode,schedule,capacity").eq("teacher_id", teacher.id).order("name"),
    supabase.from("teacher_attendance").select("date,check_in,check_out,sessions_count,notes").eq("teacher_id", teacher.id).order("date", { ascending: false }),
    supabase.from("feedback_records").select("student_id,rating,comment,created_at").eq("teacher_id", teacher.id).order("created_at", { ascending: false }),
  ]);
  return (
    <main className="min-h-screen bg-[#FCFAF6] p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <Card><CardHeader className="flex-row items-center gap-4"><Image src="/fliessend-logo-transparent.png" alt="Fließend Deutsch" width={120} height={70} /><div><CardTitle>{teacher.name}</CardTitle><p className="text-sm text-muted-foreground">{teacher.phone ?? ""}</p></div></CardHeader></Card>
        <Card><CardHeader><CardTitle>Classes</CardTitle></CardHeader><CardContent><DataTable rows={(classes.data ?? []) as Record<string, unknown>[]} columns={[{ key: "name", header: "Class" }, { key: "level", header: "Level" }, { key: "learning_mode", header: "Mode" }, { key: "schedule", header: "Schedule" }, { key: "capacity", header: "Capacity" }]} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Attendance and sessions</CardTitle></CardHeader><CardContent><DataTable rows={(attendance.data ?? []).map((item, index) => ({ id: index, date: item.date, check_in: item.check_in ?? "", check_out: item.check_out ?? "", sessions: item.sessions_count, notes: item.notes ?? "" }))} columns={[{ key: "date", header: "Date" }, { key: "check_in", header: "In" }, { key: "check_out", header: "Out" }, { key: "sessions", header: "Sessions" }, { key: "notes", header: "Notes" }]} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Feedback written by teacher</CardTitle></CardHeader><CardContent><DataTable rows={(feedback.data ?? []).map((item, index) => ({ id: index, rating: item.rating ?? "", comment: item.comment, date: String(item.created_at).slice(0, 10) }))} columns={[{ key: "rating", header: "Rating" }, { key: "comment", header: "Comment" }, { key: "date", header: "Date" }]} /></CardContent></Card>
      </div>
    </main>
  );
}
