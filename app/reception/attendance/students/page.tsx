import { StudentAttendanceForm } from "@/components/forms/attendance-forms";
import { getCurrentUser } from "@/lib/auth";
import { academyDate } from "@/lib/dates";

export default async function StudentAttendancePage() {
  const { supabase, profile } = await getCurrentUser("reception");
  // frozen students stay in the class but aren't expected
  const today = academyDate();
  const { data } = await supabase.from("classes").select("id,name,students(id,full_name,status,freeze_start_date,freeze_end_date)").order("name");
  return <StudentAttendanceForm classes={(data ?? []).map((item) => ({ ...item, students: (item.students ?? []).filter((student) => student.status === "active" && !(student.freeze_start_date && student.freeze_end_date && student.freeze_start_date <= today && student.freeze_end_date >= today)) }))} recordedBy={profile.id} />;
}
