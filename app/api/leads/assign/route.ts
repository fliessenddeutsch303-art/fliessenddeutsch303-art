import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireApiUser } from "@/lib/api-auth";

export async function POST(request: Request) {
  const auth = await requireApiUser(["admin"]);
  if (!auth.ok) return auth.response;
  const { profile } = auth;
  const body = await request.json().catch(() => ({})) as { leadIds?: unknown; assignedTo?: unknown };
  const leadIds = [...new Set((Array.isArray(body.leadIds) ? body.leadIds : []).filter((id): id is string => typeof id === "string" && id.length > 0))];
  if (!leadIds.length) return NextResponse.json({ error: "Select at least one lead" }, { status: 400 });
  const assignedTo = typeof body.assignedTo === "string" && body.assignedTo ? body.assignedTo : null;

  const admin = createSupabaseAdminClient();
  type Rep = { id: string; permissions: Record<string, unknown> | null };
  let rep = null as Rep | null;
  if (assignedTo) {
    const { data } = await admin.from("users").select("id,permissions").eq("id", assignedTo).eq("role", "sales").eq("is_active", true).maybeSingle();
    if (!data) return NextResponse.json({ error: "The selected sales person was not found or is inactive." }, { status: 400 });
    rep = data as Rep;
  }

  const updatedIds: string[] = [];
  const fileIds = new Set<string>();
  let failed = 0;
  let firstError = "";
  for (let start = 0; start < leadIds.length; start += 100) {
    const chunk = leadIds.slice(start, start + 100);
    const { data, error } = await admin.from("leads").update({ assigned_to: assignedTo }).in("id", chunk).select("id,file_id");
    if (error) { failed += chunk.length; firstError ||= error.message; continue; }
    for (const row of (data ?? []) as Array<{ id: string; file_id: string | null }>) { updatedIds.push(row.id); if (row.file_id) fileIds.add(row.file_id); }
    failed += chunk.length - (data ?? []).length;
  }

  // sales only see leads from files in permissions.assigned_files
  let warning = "";
  if (rep && fileIds.size) {
    const { data: fresh } = await admin.from("users").select("permissions").eq("id", rep.id).single();
    const permissions = (fresh?.permissions ?? rep.permissions ?? {}) as Record<string, unknown>;
    const files = new Set([...(Array.isArray(permissions.assigned_files) ? permissions.assigned_files as string[] : []), ...fileIds]);
    const { error } = await admin.from("users").update({ permissions: { ...permissions, assigned_files: [...files] } }).eq("id", rep.id);
    if (error) warning = `The leads were reassigned, but the sales person's file access could not be updated: ${error.message}`;
  }
  if (updatedIds.length) await admin.from("audit_logs").insert({ actor_user_id: profile.id, actor_name: profile.full_name, actor_email: profile.email, action: "assigned", entity_type: "lead", entity_id: null, details: { assigned_to: assignedTo, updated: updatedIds.length, failed, lead_ids: updatedIds.slice(0, 200) } });
  return NextResponse.json({ updated: updatedIds.length, failed, updatedIds, ...(firstError ? { error: firstError } : {}), ...(warning ? { warning } : {}) });
}
