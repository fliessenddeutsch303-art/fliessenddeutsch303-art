import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

type SheetPayload = { id?: string; name?: string; columns?: string[]; rows?: Array<Record<string, string>> };

export async function GET() {
  const { supabase, user, profile } = await getCurrentUser(["admin", "sales"]);
  let query = supabase.from("manual_sheets").select("id,name,columns,rows,created_at,updated_at").order("updated_at", { ascending: false });
  if (profile.role !== "admin") query = query.eq("owner_id", user.id);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sheets: data ?? [] });
}

export async function POST(request: Request) {
  const { supabase, user } = await getCurrentUser(["admin", "sales"]);
  const body = await request.json() as SheetPayload;
  if (!body.id || !body.name || !Array.isArray(body.columns) || !Array.isArray(body.rows)) {
    return NextResponse.json({ error: "Invalid sheet" }, { status: 400 });
  }
  const { error } = await supabase.from("manual_sheets").upsert({
    id: body.id,
    owner_id: user.id,
    name: body.name,
    columns: body.columns,
    rows: body.rows,
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
