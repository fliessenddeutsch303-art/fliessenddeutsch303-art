import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const sessionKey = String(body.session_key ?? "");
  if (!sessionKey) return NextResponse.json({ error: "Session key is required" }, { status: 400 });
  const admin = createSupabaseAdminClient();
  const { data: current } = await admin.from("account_active_sessions").select("session_key").eq("user_id", auth.user.id).maybeSingle();
  if (current && current.session_key !== sessionKey) return NextResponse.json({ error: "This account is already signed in on another device or browser." }, { status: 409 });
  const { error } = await admin.from("account_active_sessions").upsert({ user_id: auth.user.id, session_key: sessionKey, last_seen_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user) await createSupabaseAdminClient().from("account_active_sessions").delete().eq("user_id", auth.user.id);
  return NextResponse.json({ ok: true });
}
