"use client";

import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { asNumber, exportExcel, pick, readExcel } from "@/lib/excel";

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
    const payload = excelRows.map((row) => {
      const className = String(pick(row, ["class", "class name", "course", "course class"]) ?? "");
      const klass = classes.find((item) => item.name.toLowerCase() === className.toLowerCase());
      return {
        full_name: String(pick(row, ["name", "full name", "student", "student name"]) ?? ""),
        phone: String(pick(row, ["phone", "mobile", "telephone"]) ?? ""),
        email: String(pick(row, ["email", "mail"]) ?? ""),
        level: String(pick(row, ["level"]) ?? ""),
        tags: String(pick(row, ["tags", "tag"]) ?? "").split(",").map((tag) => tag.trim()).filter(Boolean),
        class_id: klass?.id ?? null,
        learning_mode: String(pick(row, ["online/offline", "online / offline", "mode", "learning mode"]) ?? "offline").toLowerCase() === "online" ? "online" : "offline",
        status: String(pick(row, ["status"]) ?? "active").toLowerCase(),
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
    }).filter((row) => row.full_name && row.phone);
    if (payload.length) await supabase.from("students").insert(payload);
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
