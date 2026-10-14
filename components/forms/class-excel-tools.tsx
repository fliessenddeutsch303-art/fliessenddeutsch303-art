"use client";

import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { asNumber, exportExcel, pick, readExcel } from "@/lib/excel";

type Teacher = { id: string; name: string };
type ClassRow = Record<string, unknown>;

export function ClassExcelTools({ rows, teachers, selectedCount = 0 }: { rows: ClassRow[]; teachers: Teacher[]; selectedCount?: number }) {
  function exportClasses() {
    const exportRows = rows.map((row) => ({
        Name: row.name as string,
        Level: row.level as string,
        Chapter: row.current_chapter as string,
        Mode: row.learning_mode as string,
        Teacher: (row.teachers as { name?: string } | undefined)?.name ?? teachers.find((teacher) => teacher.id === row.teacher_id)?.name ?? "",
        Schedule: row.schedule as string,
        Capacity: Number(row.capacity ?? 0),
        "Sessions done": Number(row.sessions_done ?? 0),
        "Total sessions": Number(row.total_sessions ?? 0),
        Status: String(row.class_status ?? (Number(row.sessions_done ?? 0) >= Number(row.total_sessions ?? 0) ? "finished" : Number(row.sessions_done ?? 0) > 0 ? "started" : "not started")),
      }));
    exportExcel(
      "classes.xlsx",
      exportRows,
      "Classes",
      {
        widths: [24, 10, 18, 16, 22, 38, 12, 14, 16, 14],
        rowFill: (row) => row.Status === "finished" ? "FFF2CC" : row.Status === "started" ? "E2F0D9" : "DDEBF7",
      },
    );
  }

  async function importClasses(file: File) {
    const excelRows = await readExcel(file);
    const supabase = createSupabaseBrowserClient();
    const payload = excelRows.map((row) => {
      const teacherName = String(pick(row, ["teacher", "teacher name", "instructor"]) ?? "");
      const teacher = teachers.find((item) => item.name.toLowerCase() === teacherName.toLowerCase());
      return {
        name: String(pick(row, ["name", "class", "course", "course name"]) ?? ""),
        level: String(pick(row, ["level"]) ?? ""),
        current_chapter: String(pick(row, ["chapter", "current chapter", "kapitel", "current kapitel"]) ?? ""),
        learning_mode: String(pick(row, ["mode", "online/offline", "online / offline", "learning mode"]) ?? "offline").toLowerCase() === "online" ? "online" : "offline",
        teacher_id: teacher?.id ?? teachers[0]?.id ?? null,
        schedule: String(pick(row, ["schedule", "time", "days"]) ?? ""),
        capacity: asNumber(pick(row, ["capacity", "seats"])) || 1,
        sessions_done: asNumber(pick(row, ["sessions done", "completed sessions", "sessions_completed"])) || 0,
        total_sessions: asNumber(pick(row, ["total sessions", "sessions", "number of sessions"])) || 12,
        class_status: (() => {
          const status = String(pick(row, ["status", "class status", "group status"]) ?? "not_started").toLowerCase().replace(" ", "_");
          return status === "started" || status === "finished" ? status : "not_started";
        })(),
      };
    }).filter((row) => row.name && row.schedule);
    if (payload.length) await supabase.from("classes").insert(payload);
    window.location.reload();
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" onClick={exportClasses}><Upload size={16} /> {selectedCount ? `Export Selected (${selectedCount})` : "Export Classes"}</Button>
      <label>
        <input className="hidden" type="file" accept=".xlsx,.xls,.csv" onChange={(event) => event.target.files?.[0] && importClasses(event.target.files[0])} />
        <span className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border bg-white px-4 text-sm font-medium hover:bg-muted">
          <Download size={16} /> Import Classes
        </span>
      </label>
    </div>
  );
}
