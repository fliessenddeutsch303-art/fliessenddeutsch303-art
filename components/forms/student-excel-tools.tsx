"use client";

import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { asNumber, exportExcel, normalizePhone, pick, readExcel } from "@/lib/excel";

type ClassOption = { id: string; name: string };
type StudentRow = Record<string, unknown>;

function className(row: StudentRow) {
  return ((row.classes as { name?: string } | null)?.name ?? "") as string;
}

function teacherName(row: StudentRow) {
  return ((row.classes as { teachers?: { name?: string } | null } | null)?.teachers?.name ?? "") as string;
}

function tagsText(row: StudentRow) {
  return Array.isArray(row.tags) ? row.tags.join(", ") : String(row.tags ?? "");
}

export function StudentExcelTools({ rows, classes }: { rows: StudentRow[]; classes: ClassOption[] }) {
  function exportStudents() {
    exportExcel(
      "students.xlsx",
      rows.map((row) => ({
        Name: row.full_name as string,
        Phone: row.phone as string,
        Email: row.email as string,
        Level: row.level as string,
        Tags: tagsText(row),
        Class: className(row),
        Teacher: teacherName(row),
        Mode: row.learning_mode as string,
        Status: row.status as string,
        Price: Number(row.total_price ?? 0),
        Paid: Number(row.amount_paid ?? 0),
        Balance: Math.max(0, Number(row.total_price ?? 0) - Number(row.amount_paid ?? 0)),
        Due: row.payment_due_date as string,
        Comment: row.payment_comment as string,
        "Freeze start": row.freeze_start_date as string,
        "Freeze months": Number(row.freeze_months ?? 0),
        "Freeze end": row.freeze_end_date as string,
        "Finished level and stopped": row.level_completed_stopped ? "Yes" : "No",
      })),
      "Students",
      { widths: [18, 14, 24, 9, 24, 16, 18, 10, 10, 12, 12, 12, 13, 28] },
    );
  }

  async function importStudents(file: File) {
    const excelRows = await readExcel(file);
    const supabase = createSupabaseBrowserClient();
    const unmatched = new Set<string>();
    const rowsWithClass = excelRows.map((row) => {
      const className = String(pick(row, ["class", "class name", "course", "course class"]) ?? "");
      const klass = classes.find((item) => item.name.toLowerCase() === className.trim().toLowerCase());
      if (className.trim() && !klass) unmatched.add(className.trim());
      return {
        full_name: String(pick(row, ["name", "full name", "student", "student name"]) ?? ""),
        phone: normalizePhone(pick(row, ["phone", "mobile", "telephone"])),
        email: String(pick(row, ["email", "mail"]) ?? ""),
        level: String(pick(row, ["level"]) ?? ""),
        tags: String(pick(row, ["tags", "tag"]) ?? "").split(",").map((tag) => tag.trim()).filter(Boolean),
        class_id: klass?.id ?? null,
        learning_mode: String(pick(row, ["online/offline", "online / offline", "mode", "learning mode"]) ?? "offline").toLowerCase() === "online" ? "online" : "offline",
        status: (() => {
          const status = String(pick(row, ["status"]) || "active").trim().toLowerCase();
          return ["active", "inactive", "graduated"].includes(status) ? status : "active";
        })(),
        total_price: asNumber(pick(row, ["price", "total price", "course price"])),
        amount_paid: asNumber(pick(row, ["paid", "amount paid"])),
        payment_due_date: String(pick(row, ["payment date", "payment due date", "due date", "arranged date"]) ?? "") || null,
        payment_comment: String(pick(row, ["comment", "payment comment", "notes"]) ?? ""),
        freeze_start_date: String(pick(row, ["freeze start", "freeze start date"]) ?? "") || null,
        freeze_months: Math.min(3, Math.max(0, asNumber(pick(row, ["freeze months", "months frozen"])))),
        freeze_end_date: String(pick(row, ["freeze end", "freeze end date"]) ?? "") || null,
        level_completed_stopped: ["yes", "true", "1"].includes(String(pick(row, ["finished level and stopped", "finished and stopped"]) ?? "").toLowerCase()),
        enrolled_at: new Date().toISOString(),
      };
    });
    const named = rowsWithClass.filter((row) => row.full_name && row.phone);
    if (!named.length) {
      window.alert("No student rows with both a name and a phone number were found.");
      return;
    }
    const { data: existing, error: existingError } = await fetchAll<{ phone: string | null }>((from, to) => supabase.from("students").select("phone").order("id").range(from, to));
    if (existingError) {
      window.alert(`Import failed, could not check existing students: ${existingError.message}`);
      return;
    }
    const seen = new Set((existing ?? []).map((student) => normalizePhone(student.phone)));
    const payload = named.filter((row) => {
      if (seen.has(row.phone)) return false;
      seen.add(row.phone);
      return true;
    });
    const duplicates = named.length - payload.length;
    const missing = excelRows.length - named.length;
    const failures: string[] = [];
    let imported = 0;
    for (let start = 0; start < payload.length; start += 100) {
      const chunk = payload.slice(start, start + 100);
      const { error } = await supabase.from("students").insert(chunk);
      if (error) failures.push(`rows ${start + 1}-${start + chunk.length} of the new students (${error.message})`);
      else imported += chunk.length;
    }
    const notes = [
      `Imported ${imported}, skipped ${duplicates} duplicates.`,
      missing ? `${missing} rows skipped (missing name or phone).` : "",
      unmatched.size ? `Classes not found (students imported without a class): ${[...unmatched].join(", ")}.` : "",
      failures.length ? `Failed: ${failures.join("; ")}. Fix those rows and import again; imported students are skipped as duplicates.` : "",
    ].filter(Boolean);
    window.alert(notes.join("\n"));
    if (!imported) return;
    window.location.reload();
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" onClick={exportStudents}><Upload size={16} /> Export Students</Button>
      <label>
        <input className="hidden" type="file" accept=".xlsx,.xls,.csv" onChange={(event) => event.target.files?.[0] && importStudents(event.target.files[0])} />
        <span className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border bg-white px-4 text-sm font-medium hover:bg-muted">
          <Download size={16} /> Import Students
        </span>
      </label>
    </div>
  );
}
