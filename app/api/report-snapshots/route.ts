import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const { supabase, user } = await getCurrentUser(["admin", "sales", "reception", "teacher"]);
  const { data, error } = await supabase.from("report_snapshots").select("section,rows").eq("owner_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ snapshots: data ?? [] });
}

export async function POST(request: Request) {
  const { supabase, user } = await getCurrentUser(["admin", "sales", "reception", "teacher"]);
  const body = await request.json() as { section?: string; rows?: unknown[] };
  if (!body.section || !Array.isArray(body.rows)) return NextResponse.json({ error: "Invalid report snapshot" }, { status: 400 });
  const { error } = await supabase.from("report_snapshots").upsert({
    owner_id: user.id,
    section: body.section,
    rows: body.rows,
    updated_at: new Date().toISOString(),
  }, { onConflict: "owner_id,section" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
