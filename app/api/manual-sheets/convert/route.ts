import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { NAME_ALIASES, PHONE_ALIASES, findColumn } from "@/lib/lead-columns";
import { normalizePhone, phoneVariants } from "@/lib/phone";

type Body = { sheet_id?: string; row_index?: number; full_name?: string; phone?: string; name_column?: string; phone_column?: string; class_id?: string | null; force?: boolean };
type SheetRow = Record<string, string>;

function readRow(row: SheetRow, body: Body) {
  const keys = Object.keys(row).filter((key) => !key.startsWith("__"));
  const nameKey = body.name_column && keys.includes(body.name_column) ? body.name_column : findColumn(keys, NAME_ALIASES);
  const phoneKey = body.phone_column && keys.includes(body.phone_column) ? body.phone_column : findColumn(keys, PHONE_ALIASES);
  const valueOf = (key: string | undefined) => String(key ? row[key] ?? "" : "").trim();
  return { name: valueOf(nameKey), phone: valueOf(phoneKey), email: valueOf(findColumn(keys, ["Email", "E-mail"])), level: valueOf(findColumn(keys, ["Level", "Niveau"])) };
}

export async function POST(request: Request) {
  const auth = await requireApiUser(["admin", "sales", "reception"]);
  if (!auth.ok) return auth.response;
  const { supabase, profile } = auth;
  const body = await request.json().catch(() => ({})) as Body;
  const rowIndex = body.row_index;
  if (!body.sheet_id || typeof rowIndex !== "number" || !Number.isInteger(rowIndex) || rowIndex < 0 || !body.full_name?.trim() || !body.phone?.trim()) {
    return NextResponse.json({ error: "A sheet, row, name, and phone are required" }, { status: 400 });
  }
  const changed = () => NextResponse.json({ error: "The sheet changed, reload and try again" }, { status: 409 });
  const matches = (row: SheetRow | undefined) => {
    if (!row) return false;
    const stored = readRow(row, body);
    return stored.name === body.full_name!.trim() && Boolean(stored.phone) && normalizePhone(stored.phone) === normalizePhone(body.phone);
  };

  const { data: sheet, error: sheetError } = await supabase.from("manual_sheets").select("id,rows").eq("id", body.sheet_id).maybeSingle();
  if (sheetError || !sheet) return NextResponse.json({ error: "Sheet not found or not accessible" }, { status: 404 });
  const rows = Array.isArray(sheet.rows) ? sheet.rows as SheetRow[] : [];
  const row = rows[rowIndex];
  if (!row) return NextResponse.json({ error: "Row not found" }, { status: 404 });
  if (row.__converted_student_id) return NextResponse.json({ error: "This row was already transferred to students.", studentId: row.__converted_student_id }, { status: 409 });
  if (!matches(row)) return changed();
  const stored = readRow(row, body);

  // sales can insert students but not read them, so use the admin client
  const writer = createSupabaseAdminClient();
  if (!body.force) {
    const { data: duplicates } = await writer.from("students").select("id,full_name").in("phone", phoneVariants(stored.phone)).limit(1);
    const duplicate = duplicates?.[0];
    if (duplicate) return NextResponse.json({ error: `A student with this phone already exists: ${duplicate.full_name}`, duplicate: { id: duplicate.id, full_name: duplicate.full_name } }, { status: 409 });
  }
  const { data: student, error: studentError } = await writer.from("students").insert({
    full_name: stored.name,
    phone: normalizePhone(stored.phone),
    email: stored.email || null,
    level: stored.level || null,
    class_id: body.class_id || null,
    status: "active",
    enrolled_at: new Date().toISOString(),
  }).select("id").single();
  if (studentError || !student) return NextResponse.json({ error: studentError?.message ?? "Could not create student" }, { status: 400 });

  // mark only this row on the latest copy, retry if an autosave got in between
  const convertedAt = new Date().toISOString();
  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: current, error: readError } = await writer.from("manual_sheets").select("rows,updated_at").eq("id", body.sheet_id).maybeSingle();
    if (readError || !current) { lastError = readError?.message ?? "Sheet not found"; break; }
    const currentRows = Array.isArray(current.rows) ? [...current.rows] as SheetRow[] : [];
    if (!matches(currentRows[rowIndex]) || currentRows[rowIndex].__converted_student_id) { lastError = "changed"; break; }
    currentRows[rowIndex] = { ...currentRows[rowIndex], __converted_student_id: student.id, __converted_at: convertedAt, __converted_by_role: profile.role };
    let update = writer.from("manual_sheets").update({ rows: currentRows, updated_at: convertedAt }).eq("id", body.sheet_id);
    if (current.updated_at) update = update.eq("updated_at", current.updated_at);
    const { data: saved, error: updateError } = await update.select("id");
    if (updateError) { lastError = updateError.message; break; }
    if (saved?.length) return NextResponse.json({ ok: true, studentId: student.id, updated_at: convertedAt });
  }
  await writer.from("students").delete().eq("id", student.id);
  return lastError === "changed" || !lastError ? changed() : NextResponse.json({ error: lastError }, { status: 500 });
}
