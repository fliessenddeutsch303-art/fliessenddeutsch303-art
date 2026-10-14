import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

async function getAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Unauthorized");
  const { data: actor } = await supabase.from("users").select("id,full_name,email,role").eq("id", auth.user.id).single();
  if (actor?.role !== "admin") throw new Error("Unauthorized");
  return { admin: createSupabaseAdminClient(), actor };
}

export async function POST(request: Request) {
  try {
    const { admin, actor } = await getAdmin();
    const body = await request.json();
    const profile = {
      account_user_id: String(body.account_user_id ?? ""),
      full_name: String(body.full_name ?? "").trim(),
      role: body.role,
      phone: body.phone ? String(body.phone) : null,
      is_active: body.is_active !== false,
      payroll_type: body.payroll_type ?? "monthly_salary",
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
  try {
    const { admin, actor } = await getAdmin();
    const body = await request.json();
    const id = String(body.id ?? "");
    if (!id) throw new Error("Employee profile id is required.");
    const payload = { full_name: String(body.full_name ?? "").trim(), role: body.role, phone: body.phone ? String(body.phone) : null, is_active: body.is_active !== false, payroll_type: body.payroll_type ?? "monthly_salary", monthly_salary: Number(body.monthly_salary ?? 0), monthly_wage: Number(body.monthly_wage ?? 0), hourly_rate: Number(body.hourly_rate ?? 0), updated_at: new Date().toISOString() };
    const { data, error } = await admin.from("employee_profiles").update(payload).eq("id", id).select("*").single();
    if (error) throw error;
    await admin.from("audit_logs").insert({ actor_user_id: actor.id, actor_name: actor.full_name, actor_email: actor.email, action: "updated", entity_type: "employee_profile", entity_id: id, details: { updated_fields: Object.keys(payload) } });
    return NextResponse.json({ profile: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update employee profile" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { admin, actor } = await getAdmin();
    const { id } = await request.json();
    const profileId = String(id ?? "");
    if (!profileId) throw new Error("Employee profile id is required.");
    const { data: profile, error: readError } = await admin.from("employee_profiles").select("*").eq("id", profileId).single();
    if (readError || !profile) throw new Error("Employee profile not found.");
    const { error } = await admin.from("employee_profiles").delete().eq("id", profileId);
    if (error) throw error;
    await admin.from("audit_logs").insert({ actor_user_id: actor.id, actor_name: actor.full_name, actor_email: actor.email, action: "deleted", entity_type: "employee_profile", entity_id: profileId, details: { profile } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to delete employee profile" }, { status: 400 });
  }
}
