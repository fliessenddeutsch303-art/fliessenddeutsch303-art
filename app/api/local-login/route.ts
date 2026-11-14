import { NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/env";
import { createLocalSupabaseClient } from "@/lib/local-db";
import { hashLocalPassword } from "@/lib/local-auth";

export async function POST(request: Request) {
  if (hasSupabaseEnv()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await request.json() as { email?: string; password?: string };
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!email || !password) return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  const supabase = createLocalSupabaseClient();
  const { data: user } = await supabase.from("users").select("id,email,role,full_name,is_active,password_hash").eq("email", email).single();
  if (!user || !user.is_active || user.password_hash !== hashLocalPassword(password)) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  const response = NextResponse.json({ id: user.id, email: user.email, full_name: user.full_name, role: user.role });
  response.cookies.set("fd_local_user_id", user.id, { httpOnly: true, sameSite: "lax", path: "/" });
  response.cookies.set("fd_local_user_email", user.email, { httpOnly: true, sameSite: "lax", path: "/" });
  response.cookies.set("fd_local_role", user.role, { httpOnly: true, sameSite: "lax", path: "/" });
  return response;
}
