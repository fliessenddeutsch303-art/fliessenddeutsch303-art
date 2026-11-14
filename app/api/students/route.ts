import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { sendSecurityAlert } from "@/lib/notify";

// payments, attendance, books and feedback cascade with the student, exam rows are kept
export async function DELETE(request: Request) {
  const auth = await requireApiUser(["admin"]);
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => ({})) as { ids?: unknown };
  const ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).filter((id): id is string => typeof id === "string" && id.length > 0))];
  if (!ids.length) return NextResponse.json({ error: "Select at least one student" }, { status: 400 });
  if (ids.length > 1000) return NextResponse.json({ error: "Delete at most 1000 students at a time" }, { status: 400 });

  const deleted: Array<{ id: string; full_name: string; phone: string | null }> = [];
  let error = "";
  for (let start = 0; start < ids.length; start += 100) {
    const result = await auth.supabase.from("students").delete().in("id", ids.slice(start, start + 100)).select("id,full_name,phone");
    if (result.error) { error = result.error.message; break; }
    deleted.push(...((result.data ?? []) as typeof deleted));
  }
  if (deleted.length) {
    await sendSecurityAlert({
      actor: auth.profile.email ?? auth.profile.full_name,
      entityType: deleted.length === 1 ? "student" : `${deleted.length} students`,
      entityId: deleted.length === 1 ? deleted[0].id : "bulk",
      details: { students: deleted.slice(0, 50).map((student) => `${student.full_name} (${student.phone ?? ""})`) },
    });
  }
  return NextResponse.json({ deleted: deleted.map((student) => student.id), ...(error ? { error } : {}) }, { status: error && !deleted.length ? 400 : 200 });
}
