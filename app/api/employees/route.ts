import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireApiUser } from "@/lib/api-auth";
import { hashLocalPassword } from "@/lib/local-auth";
import { hasSupabaseAdminEnv } from "@/lib/env";
import { ensureTeacherProfile } from "@/lib/teacher-profile";
import { sendEmail, sendSecurityAlert } from "@/lib/notify";
import { escapeHtml } from "@/lib/utils";

const roles = ["admin", "reception", "sales", "teacher"];

// per_session is for teachers only
function payroll(body: Record<string, unknown>) {
  const allowed = body.role === "teacher" ? ["monthly_salary", "monthly_wage", "hourly", "per_session"] : ["monthly_salary", "monthly_wage", "hourly"];
  const payrollType = allowed.includes(String(body.payroll_type)) ? String(body.payroll_type) : "monthly_salary";
  return {
    payroll_type: payrollType,
    monthly_salary: Number(body.monthly_salary ?? 0),
    monthly_wage: Number(body.monthly_wage ?? 0),
    hourly_rate: Number(body.hourly_rate ?? 0),
  };
}

export async function POST(request: Request) {
  const auth = await requireApiUser(["admin"]);
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const fullName = String(body.full_name ?? "").trim();
    if (!email || !fullName) throw new Error("Employee name and academy email are required.");
    if (!roles.includes(body.role)) throw new Error("Invalid role.");
    const password = String(body.password ?? "");
    if (password.length < 8) throw new Error("Password must be at least 8 characters.");
    const admin = createSupabaseAdminClient();
    const isSharedDepartment = body.role === "reception" || body.role === "sales";
    if (isSharedDepartment) {
      const { data: existingShared } = await admin.from("users").select("id,email").eq("role", body.role).eq("account_kind", "shared").maybeSingle();
      if (existingShared) throw new Error(`A shared ${body.role} login already exists. Add another person from Employee profiles instead.`);
    }
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw error ?? new Error("Could not create the login account.");
    const pay = payroll(body);
    const { error: profileError } = await admin.from("users").insert({
      id: data.user.id,
      full_name: fullName,
      email,
      role: body.role,
      account_kind: isSharedDepartment ? "shared" : "individual",
      is_active: body.is_active !== false,
      permissions: body.permissions ?? {},
      ...pay,
      ...(hasSupabaseAdminEnv() ? {} : { password_hash: hashLocalPassword(password) }),
    });
    if (profileError) {
      // don't leave an auth user without a profile
      if (hasSupabaseAdminEnv()) await admin.auth.admin.deleteUser(data.user.id);
      throw profileError;
    }
    const teacherResult = await ensureTeacherProfile(admin, { id: data.user.id, full_name: fullName, role: body.role, ...pay });
    if (teacherResult.error) {
      // clean up so a retry doesn't fail with "already registered"
      await admin.from("users").delete().eq("id", data.user.id);
      if (hasSupabaseAdminEnv()) await admin.auth.admin.deleteUser(data.user.id);
      throw teacherResult.error;
    }
    const mail = await sendEmail({
      to: email,
      subject: "Your Fließend Deutsch System Access",
      html: `<div style="font-family:Inter,Arial;color:#0B0B0B"><h1 style="border-bottom:4px solid #DD0000;padding-bottom:8px">Welcome, ${escapeHtml(fullName)}</h1><p>Login URL: ${escapeHtml(process.env.NEXT_PUBLIC_SITE_URL ?? "")}/login</p><p>Academy email: ${escapeHtml(email)}</p><p>Your account password: <strong>${escapeHtml(password)}</strong></p><p>Use these credentials to log in to the academy system.</p><div style="height:6px;background:#FFCE00;margin-top:24px"></div></div>`,
    });
    return NextResponse.json({ password, userId: data.user.id, emailSent: mail.sent, emailError: mail.reason });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireApiUser(["admin"]);
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json();
    if (!body.id) throw new Error("Employee id is required.");
    if (!roles.includes(body.role)) throw new Error("Invalid role.");
    if (body.id === auth.profile.id && (body.is_active === false || body.role !== "admin")) throw new Error("You cannot deactivate your own account or change your own role away from admin.");
    const admin = createSupabaseAdminClient();
    const { data: current, error: currentError } = await admin.from("users").select("permissions").eq("id", body.id).maybeSingle();
    if (currentError) throw currentError;
    if (!current) throw new Error("Employee not found.");
    const sentPermissions = body.permissions && typeof body.permissions === "object" ? body.permissions : {};
    const permissions = { ...((current.permissions as Record<string, unknown> | null) ?? {}), ...sentPermissions };
    const password = String(body.password ?? "");
    if (password.length > 0 && password.length < 8) throw new Error("Password must be at least 8 characters.");
    if (password && hasSupabaseAdminEnv()) {
      const { error: passwordError } = await admin.auth.admin.updateUserById(body.id, { password });
      if (passwordError) throw passwordError;
    }
    const pay = payroll(body);
    const { error } = await admin.from("users").update({
      full_name: body.full_name,
      role: body.role,
      is_active: body.is_active,
      permissions,
      ...pay,
      ...(password && !hasSupabaseAdminEnv() ? { password_hash: hashLocalPassword(password) } : {}),
    }).eq("id", body.id);
    if (error) throw error;
    if (typeof body.is_active === "boolean" && hasSupabaseAdminEnv()) {
      const { error: banError } = await admin.auth.admin.updateUserById(body.id, { ban_duration: body.is_active ? "none" : "876000h" });
      if (banError) throw banError;
      if (!body.is_active) await admin.from("account_active_sessions").delete().eq("user_id", body.id);
    }
    const teacherResult = await ensureTeacherProfile(admin, { id: body.id, full_name: body.full_name, role: body.role, ...pay });
    if (teacherResult.error) throw teacherResult.error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireApiUser(["admin"]);
  if (!auth.ok) return auth.response;
  const actor = auth.profile;
  try {
    const body = await request.json();
    const id = String(body.id ?? "");
    if (!id) throw new Error("Employee id is required.");
    if (id === actor.id) throw new Error("You cannot delete the account currently in use.");

    const admin = createSupabaseAdminClient();
    const { data: employee } = await admin.from("users").select("id,full_name,email,role").eq("id", id).single();
    if (!employee) throw new Error("Employee not found.");
    const { count: profileCount } = await admin.from("employee_profiles").select("id", { count: "exact", head: true }).eq("account_user_id", id);
    if (profileCount) throw new Error(`This login still has ${profileCount} employee profile(s). Move or delete them in Employee profiles first, or deactivate the account instead.`);

    // these cascade, deleting would wipe the payroll history
    const history = await Promise.all(["employee_attendance", "employee_adjustments", "employee_events"].map((table) => admin.from(table).select("id", { count: "exact", head: true }).eq("user_id", id)));
    const failed = history.find((result) => result.error);
    if (failed?.error) throw failed.error;
    const historyCount = history.reduce((sum, result) => sum + (result.count ?? 0), 0);
    if (historyCount) throw new Error(`This login has ${historyCount} payroll record(s) (attendance, adjustments or HR events) that would be deleted with it. Deactivate the account instead to keep the history.`);

    // teachers.user_id is set null, the teacher and their history stay
    if (hasSupabaseAdminEnv()) {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw new Error(`Could not delete the account: ${error.message}. Deactivate it instead if it has history that must be kept.`);
    } else {
      const { error } = await admin.from("users").delete().eq("id", id);
      if (error) throw error;
    }
    const details = { full_name: employee.full_name, email: employee.email, role: employee.role };
    await admin.from("audit_logs").insert({ actor_user_id: actor.id, actor_name: actor.full_name, actor_email: actor.email, action: "deleted", entity_type: "employee", entity_id: id, details });
    await sendSecurityAlert({ actor: actor.email ?? actor.full_name, entityType: "employee", entityId: id, details });
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to delete employee" }, { status: 400 });
  }
}
