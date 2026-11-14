import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { hasSupabaseEnv } from "@/lib/env";

type SheetPayload = { id?: string; name?: string; columns?: string[]; rows?: Array<Record<string, string>>; assigned_sales_ids?: string[]; updated_at?: string };

export async function GET() {
  const auth = await requireApiUser(["admin", "sales", "reception"]);
  if (!auth.ok) return auth.response;
  const { supabase, profile } = auth;
  // RLS filters for sales, the demo store doesn't
  const result = await supabase.from("manual_sheets").select("id,name,columns,rows,owner_id,assigned_sales_ids,created_at,updated_at").order("updated_at", { ascending: false });
  const data = profile.role === "sales" && !hasSupabaseEnv()
    ? (result.data ?? []).filter((sheet: { owner_id?: string; assigned_sales_ids?: string[] }) => sheet.owner_id === profile.id || (sheet.assigned_sales_ids ?? []).includes(profile.id))
    : result.data;
  const error = result.error;
  if (error && error.message.includes("manual_sheets")) return NextResponse.json({ sheets: [], unavailable: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sheets: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireApiUser(["admin", "sales"]);
  if (!auth.ok) return auth.response;
  const { supabase, profile } = auth;
  const body = await request.json().catch(() => ({})) as SheetPayload;
  if (!body.id || !body.name || !Array.isArray(body.columns) || !Array.isArray(body.rows)) {
    return NextResponse.json({ error: "Invalid sheet" }, { status: 400 });
  }
  const conflict = NextResponse.json({ error: "This sheet was changed by someone else. Reload to get the latest version.", conflict: true }, { status: 409 });
  const { data: existing, error: lookupError } = await supabase.from("manual_sheets").select("owner_id,name,assigned_sales_ids,updated_at").eq("id", body.id).maybeSingle();
  if (lookupError && lookupError.message.includes("manual_sheets")) return NextResponse.json({ error: "Cloud manual sheets are not configured yet." }, { status: 503 });
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 });

  const updatedAt = new Date().toISOString();
  const requested = Array.isArray(body.assigned_sales_ids) ? body.assigned_sales_ids.filter(Boolean) : [];
  if (!existing) {
    const { error } = await supabase.from("manual_sheets").insert({ id: body.id, owner_id: profile.id, name: body.name, columns: body.columns, rows: body.rows, assigned_sales_ids: requested, updated_at: updatedAt });
    if (error && error.message.includes("manual_sheets")) return NextResponse.json({ error: "Cloud manual sheets are not configured yet." }, { status: 503 });
    if (error && /duplicate key|already exists/i.test(error.message)) return conflict;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, updated_at: updatedAt });
  }

  // reject saves from an outdated copy
  if (body.updated_at && existing.updated_at && new Date(existing.updated_at).getTime() > new Date(body.updated_at).getTime()) return conflict;
  const canManage = profile.role === "admin" || existing.owner_id === profile.id;
  let update = supabase.from("manual_sheets").update({
    name: canManage ? body.name : existing.name,
    columns: body.columns,
    rows: body.rows,
    assigned_sales_ids: canManage ? requested : Array.isArray(existing.assigned_sales_ids) ? existing.assigned_sales_ids : [],
    updated_at: updatedAt,
  }).eq("id", body.id);
  if (existing.updated_at) update = update.eq("updated_at", existing.updated_at);
  const { data: saved, error } = await update.select("id");
  if (error && error.message.includes("manual_sheets")) return NextResponse.json({ error: "Cloud manual sheets are not configured yet." }, { status: 503 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!saved?.length) return conflict;
  return NextResponse.json({ ok: true, updated_at: updatedAt });
}

export async function DELETE(request: Request) {
  const auth = await requireApiUser(["admin"]);
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => ({})) as { id?: string };
  if (!body.id) return NextResponse.json({ error: "Sheet id is required" }, { status: 400 });

  const { error } = await auth.supabase.from("manual_sheets").delete().eq("id", body.id);
  if (error && error.message.includes("manual_sheets")) return NextResponse.json({ error: "Cloud manual sheets are not configured yet." }, { status: 503 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
