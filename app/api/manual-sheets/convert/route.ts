import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/env";

type Body = { sheet_id?: string; row_index?: number; full_name?: string; phone?: string; email?: string; level?: string; class_id?: string };

export async function POST(request: Request) {
  const { supabase, profile } = await getCurrentUser(["admin", "sales", "reception"]);
  const body = await request.json() as Body;
  const rowIndex = body.row_index;
  if (!body.sheet_id || typeof rowIndex !== "number" || !Number.isInteger(rowIndex) || rowIndex < 0 || !body.full_name?.trim() || !body.phone?.trim()) {
    return NextResponse.json({ error: "A sheet, row, name, and phone are required" }, { status: 400 });
  }

  const { data: sheet, error: sheetError } = await supabase.from("manual_sheets").select("id,rows").eq("id", body.sheet_id).single();
  if (sheetError || !sheet) return NextResponse.json({ error: "Sheet not found or not accessible" }, { status: 404 });
  const rows = Array.isArray(sheet.rows) ? [...sheet.rows] as Array<Record<string, string>> : [];
  const row = rows[rowIndex];
  if (!row) return NextResponse.json({ error: "Row not found" }, { status: 404 });
  if (row.__converted_student_id) return NextResponse.json({ studentId: row.__converted_student_id, alreadyConverted: true });

  const { data: student, error: studentError } = await supabase.from("students").insert({
    full_name: body.full_name.trim(),
    phone: body.phone.trim(),
    email: body.email?.trim() || null,
    level: body.level?.trim() || null,
    class_id: body.class_id || null,
    status: "active",
    enrolled_at: new Date().toISOString(),
  }).select("id").single();
  if (studentError || !student) return NextResponse.json({ error: studentError?.message ?? "Could not create student" }, { status: 400 });

  rows[rowIndex] = { ...row, __converted_student_id: student.id, __converted_at: new Date().toISOString(), __converted_by_role: profile.role };
  const writer = profile.role === "reception" && hasSupabaseEnv() ? createSupabaseAdminClient() : supabase;
  const { error: updateError } = await writer.from("manual_sheets").update({ rows, updated_at: new Date().toISOString() }).eq("id", body.sheet_id);
  if (updateError) return NextResponse.json({ error: updateError.message, studentId: student.id }, { status: 500 });
  return NextResponse.json({ ok: true, studentId: student.id });
}
