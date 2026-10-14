import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";

type SheetPayload = { id?: string; name?: string; columns?: string[]; rows?: Array<Record<string, string>>; assigned_sales_ids?: string[] };

export async function GET() {
  const { supabase, user, profile } = await getCurrentUser(["admin", "sales", "reception"]);
  let query = supabase.from("manual_sheets").select("id,name,columns,rows,owner_id,assigned_sales_ids,created_at,updated_at").order("updated_at", { ascending: false });
  if (profile.role === "sales" && hasSupabaseEnv()) query = query.or(`owner_id.eq.${user.id},assigned_sales_ids.cs.{"${user.id}"}`);
  const result = await query;
  const data = profile.role === "sales" && !hasSupabaseEnv()
    ? (result.data ?? []).filter((sheet: { owner_id?: string; assigned_sales_ids?: string[] }) => sheet.owner_id === user.id || (sheet.assigned_sales_ids ?? []).includes(user.id))
    : result.data;
  const error = result.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sheets: data ?? [] });
}

export async function POST(request: Request) {
  const { supabase, user, profile } = await getCurrentUser(["admin", "sales"]);
  const body = await request.json() as SheetPayload;
  if (!body.id || !body.name || !Array.isArray(body.columns) || !Array.isArray(body.rows)) {
    return NextResponse.json({ error: "Invalid sheet" }, { status: 400 });
  }
  let assignedSalesIds = Array.isArray(body.assigned_sales_ids) ? body.assigned_sales_ids.filter(Boolean) : [];
  let ownerId = user.id;
  if (body.id) {
    const { data: existing } = await supabase.from("manual_sheets").select("owner_id,assigned_sales_ids").eq("id", body.id).single();
    ownerId = existing?.owner_id ?? user.id;
    if (profile.role !== "admin") assignedSalesIds = Array.isArray(existing?.assigned_sales_ids) ? existing.assigned_sales_ids : [];
  }
  const { error } = await supabase.from("manual_sheets").upsert({
    id: body.id,
    owner_id: ownerId,
    name: body.name,
    columns: body.columns,
    rows: body.rows,
    assigned_sales_ids: assignedSalesIds,
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { supabase } = await getCurrentUser(["admin"]);
  const body = await request.json() as { id?: string };
  if (!body.id) return NextResponse.json({ error: "Sheet id is required" }, { status: 400 });

  let query = supabase.from("manual_sheets").delete().eq("id", body.id);
  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
