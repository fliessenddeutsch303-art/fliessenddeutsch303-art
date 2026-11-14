import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireApiUser(["admin", "sales", "reception"]);
  if (!auth.ok) return auth.response;
  const { data, error } = await auth.supabase.from("classes").select("id,name,level,learning_mode,class_status").order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ classes: data ?? [] });
}
