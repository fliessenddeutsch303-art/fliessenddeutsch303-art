import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { refreshClassSessionProgress } from "@/lib/class-progress";
import { academyDate, academyDaysAgo } from "@/lib/dates";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const uuidLike = /^[0-9a-zA-Z-]{1,64}$/;

export async function POST(request: Request) {
  const auth = await requireApiUser(["admin", "reception"]);
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json() as { classIds?: unknown; teacherId?: unknown; date?: unknown };
    const date = String(body.date ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) return NextResponse.json({ error: "A valid date (YYYY-MM-DD) is required." }, { status: 400 });
    if (date > academyDate() || date < academyDaysAgo(7)) return NextResponse.json({ error: "Sessions can only be counted for the last 7 days." }, { status: 400 });
    const supabase = createSupabaseAdminClient();
    let classIds = Array.isArray(body.classIds) ? body.classIds.map(String).filter((id) => uuidLike.test(id)) : [];
    if (!classIds.length && typeof body.teacherId === "string" && uuidLike.test(body.teacherId)) {
      const { data, error } = await supabase.from("classes").select("id").eq("teacher_id", body.teacherId);
      if (error) throw error;
      classIds = (data ?? []).map((row) => row.id);
    }
    const results = [];
    for (const classId of [...new Set(classIds)].slice(0, 100)) results.push({ classId, ...(await refreshClassSessionProgress(supabase, classId, date)) });
    return NextResponse.json({ ok: true, results });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update class progress" }, { status: 500 });
  }
}
