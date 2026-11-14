import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireApiUser } from "@/lib/api-auth";
import { sendSecurityAlert } from "@/lib/notify";

// per_session is for teachers only
function payType(role: unknown, value: unknown) {
  const allowed = role === "teacher" ? ["monthly_salary", "monthly_wage", "hourly", "per_session"] : ["monthly_salary", "monthly_wage", "hourly"];
  return allowed.includes(String(value)) ? String(value) : "monthly_salary";
}

export async function POST(request: Request) {
  const auth = await requireApiUser(["admin"]);
  if (!auth.ok) return auth.response;
  const actor = auth.profile;
  try {
    const admin = createSupabaseAdminClient();
    const body = await request.json();
    const profile = {
      account_user_id: String(body.account_user_id ?? ""),
      full_name: String(body.full_name ?? "").trim(),
      role: body.role,
      phone: body.phone ? String(body.phone) : null,
      is_active: body.is_active !== false,
      payroll_type: payType(body.role, body.payroll_type),
      monthly_salary: Number(body.monthly_salary ?? 0),
      monthly_wage: Number(body.monthly_wage ?? 0),
      hourly_rate: Number(body.hourly_rate ?? 0),
    };
    if (!profile.account_user_id || !profile.full_name) throw new Error("A login account and employee name are required.");
    if (!["reception", "sales", "teacher", "admin"].includes(profile.role)) throw new Error("Invalid employee role.");
    const { data, error } = await admin.from("employee_profiles").insert(profile).select("*").single();
    if (error) throw error;
    await admin.from("audit_logs").insert({ actor_user_id: actor.id, actor_name: actor.full_name, actor_email: actor.email, action: "created", entity_type: "employee_profile", entity_id: data.id, details: { profile: data } });
    return NextResponse.json({ profile: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create employee profile" }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireApiUser(["admin"]);
  if (!auth.ok) return auth.response;
  const actor = auth.profile;
  try {
    const admin = createSupabaseAdminClient();
    const body = await request.json();
    const id = String(body.id ?? "");
    if (!id) throw new Error("Employee profile id is required.");
    const fullName = String(body.full_name ?? "").trim();
    if (!fullName) throw new Error("Employee name is required.");
    if (!["reception", "sales", "teacher", "admin"].includes(body.role)) throw new Error("Invalid employee role.");
    const payload = { full_name: fullName, role: body.role, phone: body.phone ? String(body.phone) : null, ...(typeof body.is_active === "boolean" ? { is_active: body.is_active } : {}), payroll_type: payType(body.role, body.payroll_type), monthly_salary: Number(body.monthly_salary ?? 0), monthly_wage: Number(body.monthly_wage ?? 0), hourly_rate: Number(body.hourly_rate ?? 0), updated_at: new Date().toISOString() };
    const { data, error } = await admin.from("employee_profiles").update(payload).eq("id", id).select("*").single();
    if (error) throw error;
    await admin.from("audit_logs").insert({ actor_user_id: actor.id, actor_name: actor.full_name, actor_email: actor.email, action: "updated", entity_type: "employee_profile", entity_id: id, details: { updated_fields: Object.keys(payload) } });
    return NextResponse.json({ profile: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update employee profile" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireApiUser(["admin"]);
  if (!auth.ok) return auth.response;
  const actor = auth.profile;
  try {
    const admin = createSupabaseAdminClient();
    const { id } = await request.json();
    const profileId = String(id ?? "");
    if (!profileId) throw new Error("Employee profile id is required.");
    const { data: profile, error: readError } = await admin.from("employee_profiles").select("*").eq("id", profileId).single();
    if (readError || !profile) throw new Error("Employee profile not found.");
    // these cascade, deleting would wipe the payroll history
    const history = await Promise.all(["employee_attendance", "employee_adjustments", "employee_events"].map((table) => admin.from(table).select("id", { count: "exact", head: true }).eq("employee_profile_id", profileId)));
    const failed = history.find((result) => result.error);
    if (failed?.error) throw failed.error;
    const historyCount = history.reduce((sum, result) => sum + (result.count ?? 0), 0);
    if (historyCount) throw new Error(`This profile has ${historyCount} payroll record(s) (attendance, adjustments or HR events) that would be deleted with it. Deactivate the profile instead to keep the history.`);
    const { error } = await admin.from("employee_profiles").delete().eq("id", profileId);
    if (error) throw error;
    await admin.from("audit_logs").insert({ actor_user_id: actor.id, actor_name: actor.full_name, actor_email: actor.email, action: "deleted", entity_type: "employee_profile", entity_id: profileId, details: { profile } });
    await sendSecurityAlert({ actor: actor.email ?? actor.full_name, entityType: "employee_profile", entityId: profileId, details: { full_name: profile.full_name, role: profile.role } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to delete employee profile" }, { status: 400 });
  }
}
