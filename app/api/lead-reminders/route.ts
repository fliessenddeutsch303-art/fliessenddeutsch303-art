import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/env";
import { academyDate } from "@/lib/dates";
import { requireApiUser } from "@/lib/api-auth";
import { isoDate, reminderRecipients } from "@/lib/lead-reminders";

export async function GET() {
  if (!hasSupabaseEnv()) return NextResponse.json({ reminders: [] });
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ reminders: [] }, { status: 401 });
  const { data, error } = await supabase.from("lead_reminders").select("id,lead_id,due_at,note,leads(full_name)").eq("user_id", auth.user.id).is("read_at", null).lte("due_at", academyDate()).order("due_at");
  if (error) return NextResponse.json({ reminders: [], error: error.message }, { status: 500 });
  return NextResponse.json({ reminders: data ?? [] });
}

export async function POST(request: Request) {
  if (!hasSupabaseEnv()) return NextResponse.json({ queued: true });
  const auth = await requireApiUser(["admin", "sales"]);
  if (!auth.ok) return auth.response;
  const { leadId, dueAt, note } = await request.json().catch(() => ({})) as { leadId?: string; dueAt?: string | null; note?: string };
  if (!leadId) return NextResponse.json({ error: "Lead is required" }, { status: 400 });
  if (dueAt && !isoDate(dueAt)) return NextResponse.json({ error: "Reminder date must be YYYY-MM-DD" }, { status: 400 });
  // The caller's own client enforces which leads they may touch.
  const { data: lead } = await auth.supabase.from("leads").select("id,assigned_to").eq("id", leadId).maybeSingle();
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  // Sales can only read their own users row, so recipients are resolved server-side.
  const admin = createSupabaseAdminClient();
  // Re-saving a reminder replaces the unread copies instead of stacking duplicates; clearing the date removes them.
  const { error: deleteError } = await admin.from("lead_reminders").delete().eq("lead_id", leadId).is("read_at", null);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  if (!dueAt) return NextResponse.json({ count: 0 });
  const { ids, error: recipientError } = await reminderRecipients(admin, lead.assigned_to);
  if (recipientError) return NextResponse.json({ error: recipientError.message }, { status: 500 });
  const rows = ids.map((userId) => ({ lead_id: leadId, user_id: userId, due_at: dueAt, note: note ?? "", created_by: auth.profile.id }));
  if (!rows.length) return NextResponse.json({ count: 0 });
  const { error } = await admin.from("lead_reminders").insert(rows);
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ count: rows.length });
}

export async function PATCH(request: Request) {
  if (!hasSupabaseEnv()) return NextResponse.json({ ok: true });
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { ids } = await request.json() as { ids?: string[] };
  const reminderIds = (ids ?? []).filter(Boolean);
  if (!reminderIds.length) return NextResponse.json({ ok: true });
  const { error } = await supabase.from("lead_reminders").update({ read_at: new Date().toISOString() }).in("id", reminderIds).eq("user_id", auth.user.id);
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ ok: true });
}
