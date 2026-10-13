import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { extractPortalToken } from "@/lib/portal-token";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const comment = String(body.comment ?? "").trim();
    const studentToken = extractPortalToken(String(body.student_token ?? ""));
    const target = String(body.target ?? "");
    const [targetType, targetId] = target.split(":");

    if (!studentToken || !comment || comment.length > 2000 || !targetId || !["teacher", "reception"].includes(targetType)) {
      return NextResponse.json({ error: "Missing feedback details" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: student } = await supabase.from("students").select("id,class_id,classes(teacher_id)").eq("portal_token", studentToken).single();
    if (!student) return NextResponse.json({ error: "Invalid student link" }, { status: 403 });

    const classInfo = student.classes as { teacher_id?: string | null } | null;
    if (targetType === "teacher" && classInfo?.teacher_id !== targetId) {
      return NextResponse.json({ error: "This teacher is not assigned to the student" }, { status: 403 });
    }
    if (targetType === "reception") {
      const { data: receptionist } = await supabase.from("users").select("id").eq("id", targetId).eq("role", "reception").eq("is_active", true).single();
      if (!receptionist) return NextResponse.json({ error: "Invalid receptionist" }, { status: 403 });
    }

    const { error } = await supabase.from("student_worker_feedback").insert({
      student_id: student.id,
      target_role: targetType,
      target_teacher_id: targetType === "teacher" ? targetId : null,
      target_user_id: targetType === "reception" ? targetId : null,
      comment,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to save feedback" }, { status: 400 });
  }
}
