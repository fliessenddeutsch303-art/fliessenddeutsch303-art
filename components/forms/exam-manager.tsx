"use client";

import { useState } from "react";
import { CalendarCheck2, CalendarX2, CheckCircle2, Circle, Download, Edit2, Upload, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { recordAudit } from "@/lib/audit";
import { asNumber, exportExcel, pick, readExcel } from "@/lib/excel";
import { PASS_MARK } from "@/lib/level-progression";

type ExamRow = {
  id: string;
  full_name: string;
  current_level?: string | null;
  level_test_date?: string | null;
  level_test_taken: boolean;
  level_result?: string | null;
  level_test_score?: number | null;
  level_test_comment?: string | null;
  quiz_result?: string | null;
  quiz_score?: number | null;
  quiz_comment?: string | null;
  main_test_result?: string | null;
  main_score?: number | null;
  main_comment?: string | null;
  main_test_passed?: boolean | null;
  next_level_booked: boolean;
  booked_group?: string | null;
  booked_class_id?: string | null;
  other_exams?: { type: string; date: string; score: string; result: string }[];
  level_test_id?: string | null;
  quiz_id?: string | null;
  main_test_id?: string | null;
  student_id?: string;
};

type ClassOption = { id: string; name: string };

export function ExamManager({ rows, classes }: { rows: ExamRow[]; classes: ClassOption[] }) {
  const [examRows, setExamRows] = useState(rows);
  const [query, setQuery] = useState("");
  const [bookingFilter, setBookingFilter] = useState("all");
  const [takenFilter, setTakenFilter] = useState("all");
  const [editing, setEditing] = useState<ExamRow | null>(null);
  const [saved, setSaved] = useState("");
  const [form, setForm] = useState({ levelDate: "", levelTaken: false, levelResult: "", levelScore: "", levelComment: "", quizScore: "", quizComment: "", mainScore: "", mainComment: "", booked: "not_booked", groupId: "" });
  const filteredRows = examRows.filter((row) => {
    const text = `${row.full_name} ${row.current_level ?? ""}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase())) && (bookingFilter === "all" || (row.next_level_booked ? "booked" : "not_booked") === bookingFilter) && (takenFilter === "all" || (row.level_test_taken ? "taken" : "not_taken") === takenFilter);
  });

  function startEdit(row: ExamRow) {
    setEditing(row);
    setForm({ levelDate: row.level_test_date ?? "", levelTaken: row.level_test_taken, levelResult: row.level_result ?? "", levelScore: row.level_test_score == null ? "" : String(row.level_test_score), levelComment: row.level_test_comment ?? "", quizScore: row.quiz_score == null ? "" : String(row.quiz_score), quizComment: row.quiz_comment ?? "", mainScore: row.main_score == null ? "" : String(row.main_score), mainComment: row.main_comment ?? "", booked: row.next_level_booked ? "booked" : "not_booked", groupId: row.booked_class_id ?? classes.find((item) => item.name === row.booked_group)?.id ?? "" });
    setSaved("");
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editing?.student_id) return;
    const supabase = createSupabaseBrowserClient();
    const studentId = editing.student_id;
    const now = new Date().toISOString();
    const levelDateChanged = form.levelDate !== (editing.level_test_date ?? "");
    const hasMain = Boolean(editing.main_test_id) || Boolean(form.mainScore || form.mainComment);
    const bookingOnMain = hasMain;
    const bookingFields = { booking_status: form.booked, booked_class_id: form.booked === "booked" ? form.groupId || null : null };
    const noBooking = { booking_status: "not_booked", booked_class_id: null };
    const levelScore = form.levelTaken && form.levelScore !== "" ? Number(form.levelScore) : null;
    const levelResult = form.levelTaken ? form.levelResult : "";
    // Update the existing row, or insert one (only when there is something to store) and keep its id for later edits.
    async function saveRow(id: string | null | undefined, payload: Record<string, unknown>, hasData: boolean) {
      if (id) {
        const { error } = await supabase.from("exam_records").update(payload).eq("id", id);
        return { id, error };
      }
      if (!hasData) return { id: null, error: null };
      const { data, error } = await supabase.from("exam_records").insert({ student_id: studentId, scheduled_at: form.levelDate || now, ...payload }).select("id").single();
      return { id: (data?.id as string | undefined) ?? null, error };
    }
    // scheduled_at is only written for a new row or when the level-test date itself was changed.
    const levelPayload = { exam_type: "placement", ...(!editing.level_test_id || levelDateChanged ? { scheduled_at: form.levelDate || now } : {}), level_result: levelResult, score_percent: levelScore, result_comment: form.levelComment, ...(bookingOnMain ? noBooking : bookingFields) };
    const level = await saveRow(editing.level_test_id, levelPayload, Boolean(form.levelDate || levelResult || form.levelTaken || form.levelComment || (!bookingOnMain && (form.booked === "booked" || form.groupId))));
    if (level.error) { setSaved(level.error.message); return; }
    const quizPayload = { exam_type: "quiz", level_result: null, score_percent: form.quizScore ? Number(form.quizScore) : null, result_comment: form.quizComment };
    const quiz = await saveRow(editing.quiz_id, quizPayload, Boolean(form.quizScore || form.quizComment));
    if (quiz.error) { setSaved(quiz.error.message); return; }
    const mainPayload = { exam_type: "main", ...(editing.main_test_id && !form.levelResult ? {} : { level_result: form.levelResult || null }), score_percent: form.mainScore ? Number(form.mainScore) : null, result_comment: form.mainComment, ...(bookingOnMain ? bookingFields : noBooking) };
    const main = await saveRow(editing.main_test_id, mainPayload, hasMain);
    if (main.error) { setSaved(main.error.message); return; }
    const mainScore = form.mainScore ? Number(form.mainScore) : null;
    setExamRows((current) => current.map((row) => row.id === editing.id ? { ...row, level_test_id: level.id, quiz_id: quiz.id, main_test_id: main.id, level_test_date: levelDateChanged || !editing.level_test_id ? form.levelDate : row.level_test_date, level_result: levelResult, level_test_taken: form.levelTaken && Boolean(levelResult || levelScore != null), level_test_score: levelScore, level_test_comment: form.levelComment, quiz_result: form.quizScore ? `${form.quizScore}% ${form.quizComment}`.trim() : form.quizComment, quiz_score: form.quizScore ? Number(form.quizScore) : null, quiz_comment: form.quizComment, main_test_result: form.mainScore ? `${form.mainScore}% ${form.mainComment}`.trim() : null, main_score: mainScore, main_comment: form.mainComment, main_test_passed: mainScore == null ? null : mainScore >= PASS_MARK, next_level_booked: form.booked === "booked", booked_class_id: form.booked === "booked" ? form.groupId || null : null, booked_group: form.booked === "booked" ? classes.find((item) => item.id === form.groupId)?.name ?? null : null } : row));
    void recordAudit("updated", "exam", studentId, { fields: ["placement", "quiz", "main", "booking"], student: editing.full_name });
    setEditing((current) => current ? { ...current, level_test_id: level.id, quiz_id: quiz.id, main_test_id: main.id, level_test_date: levelDateChanged || !editing.level_test_id ? form.levelDate : current.level_test_date } : current);
    setSaved("Exam row updated");
  }

  function toggleLevelTaken(checked: boolean) {
    if (!checked && (form.levelScore || form.levelResult) && !window.confirm("Unticking will clear the level score and level result for this student. Continue?")) return;
    setForm({ ...form, levelTaken: checked, ...(checked ? {} : { levelScore: "", levelResult: "" }) });
  }

  function exportFiltered() {
    exportExcel("exam-list.xlsx", filteredRows.map((row) => ({ "Student ID": row.student_id ?? "", Name: row.full_name, "Current level": row.current_level ?? "", "Level determination date": row.level_test_date ?? "", "Level test taken": row.level_test_taken ? "Yes" : "No", "Level result": row.level_result ?? "", "Level score": row.level_test_score ?? "", "Level comment": row.level_test_comment ?? "", "Quiz score": row.quiz_score ?? "", "Quiz comment": row.quiz_comment ?? "", "Main score": row.main_score ?? "", "Main comment": row.main_comment ?? "", "Next level booked": row.next_level_booked ? "Yes" : "No", "Booked group": row.booked_group ?? "" })), "Exams", { widths: [24, 26, 16, 22, 16, 16, 12, 30, 12, 30, 12, 30, 18, 24] });
  }

  async function importExamList(file: File) {
    const imported = await readExcel(file);
    const supabase = createSupabaseBrowserClient();
    let updated = 0;
    let added = 0;
    const skipped: string[] = [];
    const byId = new Map(examRows.map((row) => [row.id, row]));
    const byName = new Map<string, ExamRow[]>();
    examRows.forEach((row) => { const key = row.full_name.trim().toLowerCase(); byName.set(key, [...(byName.get(key) ?? []), row]); });
    const ids = new Map<string, { placement?: string | null; quiz?: string | null; main?: string | null }>();
    const now = new Date().toISOString();
    for (const [index, item] of imported.entries()) {
      const label = `row ${index + 2}`;
      const idText = String(pick(item, ["student id", "studentid"]) ?? "").trim();
      const name = String(pick(item, ["name", "student"]) ?? "").trim();
      let student: ExamRow | undefined;
      if (idText) {
        student = byId.get(idText);
        if (!student) { skipped.push(`${label}: Student ID not found`); continue; }
      } else {
        const matches = byName.get(name.toLowerCase()) ?? [];
        if (!name) { skipped.push(`${label}: no student`); continue; }
        if (!matches.length) { skipped.push(`${label}: "${name}" not found`); continue; }
        if (matches.length > 1) { skipped.push(`${label}: "${name}" matches ${matches.length} students`); continue; }
        student = matches[0];
      }
      const known = ids.get(student.id) ?? { placement: student.level_test_id, quiz: student.quiz_id, main: student.main_test_id };
      const dateText = String(pick(item, ["level determination date", "test date", "date"]) ?? "").trim();
      const levelResult = String(pick(item, ["level result", "next level"]) ?? "").trim();
      const levelScoreRaw = pick(item, ["level score"]);
      const levelComment = String(pick(item, ["level comment"]) ?? "");
      const taken = String(pick(item, ["level test taken", "taken"]) ?? "").toLowerCase() === "yes";
      const quizScore = pick(item, ["quiz score"]);
      const quizComment = String(pick(item, ["quiz comment"]) ?? "");
      const mainScore = pick(item, ["main score"]);
      const mainComment = String(pick(item, ["main comment"]) ?? "");
      const bookingRaw = pick(item, ["next level booked", "booked"]);
      const booked = String(bookingRaw ?? "").toLowerCase() === "yes";
      const bookedGroup = String(pick(item, ["booked group"]) ?? "").trim().toLowerCase();
      const groupId = classes.find((option) => option.name.trim().toLowerCase() === bookedGroup)?.id ?? null;
      const hasScore = (value: unknown) => value !== "" && value != null;
      const levelData = Boolean(levelResult || levelComment || hasScore(levelScoreRaw) || taken);
      const quizData = hasScore(quizScore) || Boolean(quizComment);
      const mainData = hasScore(mainScore) || Boolean(mainComment);
      const bookingOnMain = Boolean(known.main) || mainData;
      const bookingFields = bookingRaw === undefined ? {} : { booking_status: booked ? "booked" : "not_booked", ...(booked && groupId ? { booked_class_id: groupId } : booked ? {} : { booked_class_id: null }) };
      const noBooking = bookingRaw === undefined ? {} : { booking_status: "not_booked", booked_class_id: null };
      const scheduled = dateText ? dateText : now;
      const rows: { type: "placement" | "quiz" | "main"; payload: Record<string, unknown>; has: boolean }[] = [
        { type: "placement", payload: { level_result: levelResult, score_percent: taken && hasScore(levelScoreRaw) ? asNumber(levelScoreRaw) : null, result_comment: levelComment, ...(bookingOnMain ? noBooking : bookingFields) }, has: levelData || (!bookingOnMain && booked) },
        { type: "quiz", payload: { level_result: null, score_percent: hasScore(quizScore) ? asNumber(quizScore) : null, result_comment: quizComment }, has: quizData },
        { type: "main", payload: { level_result: levelResult || null, score_percent: hasScore(mainScore) ? asNumber(mainScore) : null, result_comment: mainComment, ...(bookingOnMain ? bookingFields : noBooking) }, has: mainData || (bookingOnMain && booked) },
      ];
      let any = false;
      for (const entry of rows) {
        if (!entry.has) continue;
        any = true;
        const existing = known[entry.type];
        if (existing) {
          const { error } = await supabase.from("exam_records").update({ ...entry.payload, ...(entry.type === "placement" && dateText && dateText !== (student.level_test_date ?? "") ? { scheduled_at: dateText } : {}) }).eq("id", existing);
          if (error) { skipped.push(`${label}: ${error.message}`); continue; }
          updated += 1;
        } else {
          const { data, error } = await supabase.from("exam_records").insert({ student_id: student.id, exam_type: entry.type, scheduled_at: scheduled, ...entry.payload }).select("id").single();
          if (error) { skipped.push(`${label}: ${error.message}`); continue; }
          known[entry.type] = (data?.id as string | undefined) ?? null;
          added += 1;
        }
      }
      ids.set(student.id, known);
      if (!any) skipped.push(`${label}: no exam data`);
    }
    const summary = `Import finished: updated ${updated}, added ${added}, skipped ${skipped.length}.${skipped.length ? `\n${skipped.slice(0, 15).join("\n")}${skipped.length > 15 ? `\n...and ${skipped.length - 15} more` : ""}` : ""}`;
    if (!updated && !added) { setSaved(summary.replace(/\n/g, " ")); return; }
    window.alert(summary);
    window.location.reload();
  }
  return (
    <Card>
      <CardHeader><CardTitle>Student exams and level progression</CardTitle></CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Input className="max-w-xs" placeholder="Search student..." value={query} onChange={(event) => setQuery(event.target.value)} />
          <Select className="max-w-[180px]" value={takenFilter} onChange={(event) => setTakenFilter(event.target.value)}><option value="all">All test statuses</option><option value="taken">Taken</option><option value="not_taken">Not taken</option></Select>
          <Select className="max-w-[180px]" value={bookingFilter} onChange={(event) => setBookingFilter(event.target.value)}><option value="all">All bookings</option><option value="booked">Booked next level</option><option value="not_booked">Not booked</option></Select>
          <Button type="button" variant="outline" onClick={exportFiltered}><Upload size={16} /> Export filtered ({filteredRows.length})</Button>
          <label><input className="hidden" type="file" accept=".xlsx,.xls,.csv" onChange={(event) => event.target.files?.[0] && importExamList(event.target.files[0])} /><span className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border bg-white px-4 text-sm font-medium"><Download size={16} /> Import exams</span></label>
        </div>
        {!editing && saved && <p role="status" className="mb-4 text-sm text-muted-foreground">{saved}</p>}
        {editing && <form onSubmit={saveEdit} className="mb-4 grid gap-2 rounded-lg border bg-muted/30 p-4 md:grid-cols-4"><Input type="date" value={form.levelDate} onChange={(event) => setForm({ ...form, levelDate: event.target.value })} /><label className="flex items-center gap-2 rounded-md border bg-white px-3 text-sm"><input type="checkbox" checked={form.levelTaken} onChange={(event) => toggleLevelTaken(event.target.checked)} /> Level test taken</label><Input placeholder="Level result" value={form.levelResult} onChange={(event) => setForm({ ...form, levelResult: event.target.value, ...(event.target.value ? { levelTaken: true } : {}) })} /><Input type="number" min="0" max="100" placeholder="Level score" value={form.levelScore} onChange={(event) => setForm({ ...form, levelScore: event.target.value, ...(event.target.value ? { levelTaken: true } : {}) })} /><Textarea placeholder="Level comment" value={form.levelComment} onChange={(event) => setForm({ ...form, levelComment: event.target.value })} /><Input type="number" min="0" max="100" placeholder="Quiz score" value={form.quizScore} onChange={(event) => setForm({ ...form, quizScore: event.target.value })} /><Textarea placeholder="Quiz result/comment" value={form.quizComment} onChange={(event) => setForm({ ...form, quizComment: event.target.value })} /><Input type="number" min="0" max="100" placeholder="Main test score" value={form.mainScore} onChange={(event) => setForm({ ...form, mainScore: event.target.value })} /><Textarea placeholder="Main test comment" value={form.mainComment} onChange={(event) => setForm({ ...form, mainComment: event.target.value })} /><Select value={form.booked} onChange={(event) => setForm({ ...form, booked: event.target.value })}><option value="not_booked">Next level not booked</option><option value="booked">Next level booked</option></Select><Select value={form.groupId} onChange={(event) => setForm({ ...form, groupId: event.target.value })}><option value="">Choose group</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select><div className="flex gap-2 md:col-span-4"><Button><Edit2 size={16} /> Save exam row</Button><Button type="button" variant="outline" onClick={() => setEditing(null)}><XCircle size={16} /> Cancel</Button>{saved && <span className="self-center text-sm text-muted-foreground">{saved}</span>}</div></form>}
        <div className="max-h-[70vh] overflow-auto rounded-lg border">
          <table className="w-full min-w-[1200px] text-sm">
            <thead className="sticky top-0 z-10 bg-muted">
              <tr>
                {["Student", "Current level", "Level determination", "Quizzes results", "Main test", "Other exams (ÖSD / internal)", "Next level booking", "Booked group"].map((header) => <th key={header} className="px-4 py-3 text-left font-semibold">{header}</th>)}
              </tr>
            </thead>
            <tbody>
                {filteredRows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-4 py-3 font-semibold">{row.full_name}<Button type="button" size="sm" variant="ghost" onClick={() => startEdit(row)}><Edit2 size={15} /></Button></td>
                  <td className="px-4 py-3">{row.current_level ?? ""}</td>
                  <td className="px-4 py-3">{row.level_test_date ?? "Not scheduled"}<div className="mt-1">{row.level_test_taken ? <Badge className="border-green-200 bg-green-50 text-green-700"><CheckCircle2 size={15} /> Taken</Badge> : <Badge className="border-gray-200 bg-gray-50 text-gray-600"><Circle size={15} /> Not taken</Badge>}</div></td>
                  <td className="px-4 py-3">{row.quiz_result || "No quiz result"}</td>
                  <td className="px-4 py-3">{row.main_test_result ? <Badge className={row.main_test_passed ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}>{row.main_test_passed ? <CheckCircle2 size={15} /> : <XCircle size={15} />} {row.main_test_result}</Badge> : "Not taken"}</td>
                  <td className="px-4 py-3 text-xs">{row.other_exams?.length ? row.other_exams.map((exam, index) => <div key={index}><span className="font-semibold uppercase">{exam.type}</span> {exam.date}{exam.score ? ` · ${exam.score}` : ""}{exam.result ? ` · ${exam.result}` : ""}</div>) : <span className="text-muted-foreground">-</span>}</td>
                  <td className="px-4 py-3">{row.next_level_booked ? <Badge className="border-blue-200 bg-blue-50 text-blue-700"><CalendarCheck2 size={15} /> Booked</Badge> : <Badge className="border-gray-200 bg-gray-50 text-gray-600"><CalendarX2 size={15} /> Not booked</Badge>}</td>
                  <td className="px-4 py-3">{row.next_level_booked ? row.booked_group || "Not chosen" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredRows.length && <p className="p-8 text-center text-muted-foreground">No students found.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
