import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireApiUser } from "@/lib/api-auth";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { normalizePhone } from "@/lib/phone";
import { isoDate, reminderRecipients } from "@/lib/lead-reminders";

type ImportRow = { full_name?: string; phone?: string; source?: string; tags?: string[]; status?: string; crm_data?: Record<string, string> };
const salesStatuses = new Set(["new", "waiting"]);
const adminStatuses = new Set(["new", "interested", "thinking", "no_answer", "booked", "not_interested", "waiting"]);

export async function POST(request: Request) {
  const auth = await requireApiUser(["admin", "sales"]);
  if (!auth.ok) return auth.response;
  const { profile } = auth;

  const body = await request.json().catch(() => ({})) as { campaign?: string; assignedTo?: string; rows?: ImportRow[] };
  const campaign = String(body.campaign ?? "").trim() || "Lead import";
  const allowedStatuses = profile.role === "admin" ? adminStatuses : salesStatuses;
  const rows = (Array.isArray(body.rows) ? body.rows : [])
    .map((row) => ({ ...row, full_name: String(row.full_name ?? "").trim(), phone: normalizePhone(row.phone) }))
    .filter((row) => row.full_name && row.phone);
  if (!rows.length) return NextResponse.json({ error: "No rows with both a name and a phone number were found." }, { status: 400 });

  // Sales can only import into their own pipeline; admin may assign to any sales rep.
  const assignedTo = profile.role === "sales" ? profile.id : String(body.assignedTo ?? "") || null;
  const admin = createSupabaseAdminClient();
  if (assignedTo && profile.role === "admin") {
    const { data: rep } = await admin.from("users").select("id").eq("id", assignedTo).eq("role", "sales").maybeSingle();
    if (!rep) return NextResponse.json({ error: "The selected sales person was not found." }, { status: 400 });
  }

  // Skip numbers repeated in the file or already present among the leads.
  const { data: existing, error: existingError } = await fetchAll<{ phone: string }>((from, to) => admin.from("leads").select("phone").order("id").range(from, to));
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
  const seen = new Set((existing ?? []).map((lead) => normalizePhone(lead.phone)));
  const fresh = rows.filter((row) => {
    if (seen.has(row.phone)) return false;
    seen.add(row.phone);
    return true;
  });
  const skippedDuplicates = rows.length - fresh.length;
  if (!fresh.length) return NextResponse.json({ imported: 0, count: 0, skippedDuplicates });

  const { data: file, error } = await admin.from("lead_files").insert({ name: campaign, uploaded_by: profile.id, total_leads: fresh.length }).select("id").single();
  if (error || !file) return NextResponse.json({ error: error?.message ?? "File import failed" }, { status: 400 });
  const leads = fresh.map((row) => ({
    full_name: row.full_name,
    phone: row.phone,
    source: row.source || campaign,
    tags: Array.isArray(row.tags) ? row.tags : [],
    crm_data: row.crm_data ?? {},
    status: allowedStatuses.has(String(row.status)) ? row.status : "new",
    file_id: file.id,
    assigned_to: assignedTo,
  }));
  const { data: inserted, error: leadError } = await admin.from("leads").insert(leads).select("id");
  if (leadError) {
    await admin.from("lead_files").delete().eq("id", file.id);
    return NextResponse.json({ error: leadError.message }, { status: 400 });
  }

  const warnings: string[] = [];
  // Sales RLS only shows leads from files listed in the rep's assigned_files.
  if (assignedTo) {
    const { data: rep } = await admin.from("users").select("permissions").eq("id", assignedTo).single();
    const files = new Set([...(rep?.permissions?.assigned_files ?? []), file.id]);
    const { error: filesError } = await admin.from("users").update({ permissions: { ...(rep?.permissions ?? {}), assigned_files: [...files] } }).eq("id", assignedTo);
    if (filesError) warnings.push(`The leads were imported, but the sales person's file access could not be updated: ${filesError.message}`);
  }

  // Rows that carry a reminder date get a reminder for the assigned rep and the admins.
  const dated = (inserted ?? []).length === leads.length ? leads.map((lead, index) => ({ lead, id: (inserted as Array<{ id: string }>)[index].id })).filter(({ lead }) => isoDate(lead.crm_data?.reminder_date)) : [];
  if (dated.length) {
    const { ids, error: recipientError } = await reminderRecipients(admin, assignedTo);
    const reminders = dated.flatMap(({ lead, id }) => ids.map((userId) => ({ lead_id: id, user_id: userId, due_at: lead.crm_data.reminder_date, note: lead.crm_data.reminder_note || `Follow up with ${lead.full_name}`, created_by: profile.id })));
    let reminderError = recipientError?.message ?? "";
    for (let start = 0; !reminderError && start < reminders.length; start += 500) {
      const { error: insertError } = await admin.from("lead_reminders").insert(reminders.slice(start, start + 500));
      if (insertError) reminderError = insertError.message;
    }
    if (reminderError) warnings.push(`The leads were imported, but some reminders could not be created: ${reminderError}`);
  }
  await admin.from("audit_logs").insert({ actor_user_id: profile.id, actor_name: profile.full_name, actor_email: profile.email, action: "imported", entity_type: "lead_file", entity_id: file.id, details: { campaign, count: leads.length, skipped_duplicates: skippedDuplicates, assigned_to: assignedTo } });
  return NextResponse.json({ imported: leads.length, count: leads.length, skippedDuplicates, file_id: file.id, ...(warnings.length ? { warning: warnings.join(" ") } : {}) });
}
