import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const { supabase } = await getCurrentUser(["admin", "sales", "reception"]);
  const { data, error } = await supabase.from("classes").select("id,name,level,learning_mode,class_status").order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ classes: data ?? [] });
}
