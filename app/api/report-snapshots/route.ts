import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireApiUser(["admin", "sales", "reception", "teacher"]);
  if (!auth.ok) return auth.response;
  const { supabase, profile: user } = auth;
  const { data, error } = await supabase.from("report_snapshots").select("section,rows").eq("owner_id", user.id);
  // table may be missing on older projects, the UI falls back to local storage
  if (error && error.message.includes("report_snapshots")) return NextResponse.json({ snapshots: [], unavailable: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ snapshots: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireApiUser(["admin", "sales", "reception", "teacher"]);
  if (!auth.ok) return auth.response;
  const { supabase, profile: user } = auth;
  const body = await request.json() as { section?: string; rows?: unknown[] };
  if (!body.section || !Array.isArray(body.rows)) return NextResponse.json({ error: "Invalid report snapshot" }, { status: 400 });
  const { error } = await supabase.from("report_snapshots").upsert({
    owner_id: user.id,
    section: body.section,
    rows: body.rows,
    updated_at: new Date().toISOString(),
  }, { onConflict: "owner_id,section" });
  if (error && error.message.includes("report_snapshots")) return NextResponse.json({ error: "Cloud report snapshots are not configured yet." }, { status: 503 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await requireApiUser(["admin", "sales", "reception", "teacher"]);
  if (!auth.ok) return auth.response;
  const { supabase, profile: user } = auth;
  const body = await request.json().catch(() => ({})) as { section?: string };
  if (!body.section) return NextResponse.json({ error: "Section is required" }, { status: 400 });
  const { error } = await supabase.from("report_snapshots").delete().eq("owner_id", user.id).eq("section", body.section);
  if (error && !error.message.includes("report_snapshots")) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
