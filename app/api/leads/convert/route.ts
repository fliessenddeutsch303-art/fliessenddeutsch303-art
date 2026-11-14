import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { normalizePhone, phoneVariants } from "@/lib/phone";

export async function POST(request: Request) {
  const auth = await requireApiUser(["admin", "sales"]);
  if (!auth.ok) return auth.response;
  const { supabase, profile } = auth;
  const body = await request.json().catch(() => ({})) as { lead_id?: string; class_id?: string | null; force?: boolean };
  if (!body.lead_id) return NextResponse.json({ error: "Lead is required" }, { status: 400 });

  const { data: lead } = await supabase.from("leads").select("id,full_name,phone,crm_data,converted_to_student_id").eq("id", body.lead_id).maybeSingle();
  if (!lead) return NextResponse.json({ error: "Lead not found or not assigned to you" }, { status: 404 });
  if (lead.converted_to_student_id) return NextResponse.json({ studentId: lead.converted_to_student_id, alreadyConverted: true });

  // sales can insert students but not read them, so use the admin client
  const writer = createSupabaseAdminClient();
  const phone = normalizePhone(lead.phone);
  if (!body.force) {
    const { data: duplicates } = await writer.from("students").select("id,full_name").in("phone", phoneVariants(lead.phone)).limit(1);
    const duplicate = duplicates?.[0];
    if (duplicate) return NextResponse.json({ error: `A student with this phone already exists: ${duplicate.full_name}`, duplicate: { id: duplicate.id, full_name: duplicate.full_name } }, { status: 409 });
  }

  const crm = (lead.crm_data ?? {}) as Record<string, string>;
  const { data: student, error } = await writer.from("students").insert({
    full_name: lead.full_name,
    phone,
    level: crm.level || null,
    class_id: body.class_id || null,
    status: "active",
    enrolled_at: new Date().toISOString(),
  }).select("id").single();
  if (error || !student) return NextResponse.json({ error: error?.message ?? "Could not create student" }, { status: 400 });

  // only one request can flip converted_to_student_id from null
  const { data: claimed, error: leadError } = await writer.from("leads").update({ converted_to_student_id: student.id, status: "booked" }).eq("id", lead.id).is("converted_to_student_id", null).select("id");
  if (leadError || !claimed?.length) {
    await writer.from("students").delete().eq("id", student.id);
    if (leadError) return NextResponse.json({ error: leadError.message }, { status: 500 });
    const { data: current } = await writer.from("leads").select("converted_to_student_id").eq("id", lead.id).maybeSingle();
    return NextResponse.json({ error: "This lead was already converted.", ...(current?.converted_to_student_id ? { studentId: current.converted_to_student_id, alreadyConverted: true } : {}) }, { status: current?.converted_to_student_id ? 200 : 409 });
  }
  const { error: interactionError } = await writer.from("lead_interactions").insert({ lead_id: lead.id, note: "Converted to student", created_by: profile.id });
  if (interactionError) console.error("lead convert: interaction not logged", interactionError.message);
  return NextResponse.json({ ok: true, studentId: student.id });
}
