import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { hashLocalPassword } from "@/lib/local-auth";
import { hasSupabaseAdminEnv } from "@/lib/env";
import { ensureTeacherProfile } from "@/lib/teacher-profile";

async function assertAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Unauthorized");
  const { data: profile } = await supabase.from("users").select("role").eq("id", auth.user.id).single();
  if (profile?.role !== "admin") throw new Error("Unauthorized");
}

export async function POST(request: Request) {
  try {
    await assertAdmin();
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!email || !body.full_name) throw new Error("Employee name and academy email are required.");
    const password = String(body.password ?? "");
    if (password.length < 8) throw new Error("Password must be at least 8 characters.");
    const admin = createSupabaseAdminClient();
    const isSharedDepartment = body.role === "reception" || body.role === "sales";
    if (isSharedDepartment) {
      const { data: existingShared } = await admin.from("users").select("id,email").eq("role", body.role).eq("account_kind", "shared").maybeSingle();
      if (existingShared) throw new Error(`A shared ${body.role} login already exists. Add another person from Employee profiles instead.`);
    }
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw error;
    const { error: profileError } = await admin.from("users").insert({
      id: data.user.id,
      full_name: body.full_name,
      email,
      role: body.role,
      account_kind: isSharedDepartment ? "shared" : "individual",
      is_active: body.is_active,
      permissions: body.permissions ?? {},
      payroll_type: body.payroll_type ?? "monthly_salary",
      monthly_salary: Number(body.monthly_salary ?? 0),
      monthly_wage: Number(body.monthly_wage ?? 0),
      hourly_rate: Number(body.hourly_rate ?? 0),
      ...(hasSupabaseAdminEnv() ? {} : { password_hash: hashLocalPassword(password) }),
    });
    if (profileError) throw profileError;
    const teacherResult = await ensureTeacherProfile(admin, {
      id: data.user.id,
      full_name: body.full_name,
      role: body.role,
      payroll_type: body.payroll_type,
      monthly_salary: body.monthly_salary,
      monthly_wage: body.monthly_wage,
      hourly_rate: body.hourly_rate,
    });
    if (teacherResult.error) throw teacherResult.error;
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: process.env.FROM_EMAIL!,
        to: email,
        subject: "Your Fließend Deutsch System Access",
        html: `<div style="font-family:Inter,Arial;color:#0B0B0B"><h1 style="border-bottom:4px solid #DD0000;padding-bottom:8px">Welcome, ${body.full_name}</h1><p>Login URL: ${process.env.NEXT_PUBLIC_SITE_URL}/login</p><p>Academy email: ${email}</p><p>Your account password: <strong>${password}</strong></p><p>Use these credentials to log in to the academy system.</p><div style="height:6px;background:#FFCE00;margin-top:24px"></div></div>`,
      });
    }
    return NextResponse.json({ password, userId: data.user.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    await assertAdmin();
    const body = await request.json();
    const admin = createSupabaseAdminClient();
    const password = String(body.password ?? "");
    if (password.length > 0 && password.length < 8) throw new Error("Password must be at least 8 characters.");
    if (password && hasSupabaseAdminEnv()) {
      const { error: passwordError } = await admin.auth.admin.updateUserById(body.id, { password });
      if (passwordError) throw passwordError;
    }
    const { error } = await admin.from("users").update({
      full_name: body.full_name,
      email: body.email,
      role: body.role,
      is_active: body.is_active,
      permissions: body.permissions ?? {},
      payroll_type: body.payroll_type ?? "monthly_salary",
      monthly_salary: Number(body.monthly_salary ?? 0),
      monthly_wage: Number(body.monthly_wage ?? 0),
      hourly_rate: Number(body.hourly_rate ?? 0),
      ...(password && !hasSupabaseAdminEnv() ? { password_hash: hashLocalPassword(password) } : {}),
    }).eq("id", body.id);
    if (error) throw error;
    const teacherResult = await ensureTeacherProfile(admin, {
      id: body.id,
      full_name: body.full_name,
      role: body.role,
      payroll_type: body.payroll_type,
      monthly_salary: body.monthly_salary,
      monthly_wage: body.monthly_wage,
      hourly_rate: body.hourly_rate,
    });
    if (teacherResult.error) throw teacherResult.error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error("Unauthorized");
    const { data: profile } = await supabase.from("users").select("role").eq("id", auth.user.id).single();
    if (profile?.role !== "admin") throw new Error("Unauthorized");
    const body = await request.json();
    const id = String(body.id ?? "");
    if (!id) throw new Error("Employee id is required.");
    if (id === auth.user.id) throw new Error("You cannot delete the account currently in use.");

    const admin = createSupabaseAdminClient();
    const { data: employee } = await admin.from("users").select("id,full_name,email,role").eq("id", id).single();
    if (!employee) throw new Error("Employee not found.");
    await admin.from("audit_logs").insert({
      actor_user_id: auth.user.id,
      actor_name: auth.user.email ?? "Admin",
      actor_email: auth.user.email ?? null,
      action: "deleted",
      entity_type: "employee",
      entity_id: id,
      details: { full_name: employee.full_name, email: employee.email, role: employee.role },
    });
    await admin.from("teachers").delete().eq("user_id", id);
    if (hasSupabaseAdminEnv()) {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw error;
    } else {
      const { error } = await admin.from("users").delete().eq("id", id);
      if (error) throw error;
    }
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to delete employee" }, { status: 400 });
  }
}
