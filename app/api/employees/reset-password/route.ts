import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireApiUser } from "@/lib/api-auth";
import { tempPassword } from "@/lib/utils";
import { hashLocalPassword } from "@/lib/local-auth";
import { hasSupabaseAdminEnv } from "@/lib/env";
import { sendEmail } from "@/lib/notify";
import { escapeHtml } from "@/lib/utils";

export async function POST(request: Request) {
  const auth = await requireApiUser(["admin"]);
  if (!auth.ok) return auth.response;
  const { id } = await request.json().catch(() => ({ id: "" })) as { id?: string };
  if (!id) return NextResponse.json({ error: "Employee id is required." }, { status: 400 });
  const admin = createSupabaseAdminClient();
  const temporaryPassword = tempPassword();
  if (!hasSupabaseAdminEnv()) {
    const { error } = await admin.from("users").update({ password_hash: hashLocalPassword(temporaryPassword) }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ password: temporaryPassword });
  }
  const { data: userData, error } = await admin.auth.admin.updateUserById(id, { password: temporaryPassword });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  // signOut() needs the user's JWT, so drop their session rows instead (middleware checks them)
  await admin.from("account_active_sessions").delete().eq("user_id", id);
  const { data: profile } = await admin.from("users").select("full_name").eq("id", id).single();
  const email = userData.user.email;
  const mail = email
    ? await sendEmail({
      to: email,
      subject: "Your Fließend Deutsch Password Reset",
      html: `<div style="font-family:Inter,Arial;color:#0B0B0B"><h1 style="border-bottom:4px solid #DD0000;padding-bottom:8px">Password reset</h1><p>Hello ${escapeHtml(profile?.full_name ?? "")}, your temporary password is <strong>${escapeHtml(temporaryPassword)}</strong>.</p><div style="height:6px;background:#FFCE00;margin-top:24px"></div></div>`,
    })
    : { sent: false, reason: "The account has no email address." };
  return NextResponse.json({ password: temporaryPassword, emailSent: mail.sent, emailError: mail.reason });
}
