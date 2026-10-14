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
    setForm({ levelDate: row.level_test_date ?? "", levelTaken: row.level_test_taken, levelResult: row.level_result ?? "", levelScore: row.level_test_score == null ? "" : String(row.level_test_score), levelComment: row.level_test_comment ?? "", quizScore: row.quiz_score == null ? "" : String(row.quiz_score), quizComment: row.quiz_comment ?? "", mainScore: row.main_score == null ? "" : String(row.main_score), mainComment: row.main_comment ?? "", booked: row.next_level_booked ? "booked" : "not_booked", groupId: classes.find((item) => item.name === row.booked_group)?.id ?? "" });
    setSaved("");
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editing?.student_id) return;
    const supabase = createSupabaseBrowserClient();
    const levelPayload = { student_id: editing.student_id, exam_type: "placement", scheduled_at: form.levelDate || new Date().toISOString(), level_result: form.levelResult, score_percent: form.levelTaken ? Number(form.levelScore || 0) : null, result_comment: form.levelComment };
    const levelResult = editing.level_test_id ? await supabase.from("exam_records").update(levelPayload).eq("id", editing.level_test_id) : await supabase.from("exam_records").insert(levelPayload);
    if (levelResult.error) { setSaved(levelResult.error.message); return; }
    const quizPayload = { student_id: editing.student_id, exam_type: "quiz", scheduled_at: form.levelDate || new Date().toISOString(), level_result: null, score_percent: form.quizScore ? Number(form.quizScore) : null, result_comment: form.quizComment };
    const quizResult = editing.quiz_id ? await supabase.from("exam_records").update(quizPayload).eq("id", editing.quiz_id) : await supabase.from("exam_records").insert(quizPayload);
    if (quizResult.error) { setSaved(quizResult.error.message); return; }
    const mainPayload = { student_id: editing.student_id, exam_type: "main", scheduled_at: form.levelDate || new Date().toISOString(), level_result: form.levelResult, score_percent: form.mainScore ? Number(form.mainScore) : null, result_comment: form.mainComment, booking_status: form.booked, booked_class_id: form.groupId || null };
    const mainResult = editing.main_test_id ? await supabase.from("exam_records").update(mainPayload).eq("id", editing.main_test_id) : await supabase.from("exam_records").insert(mainPayload);
    if (mainResult.error) { setSaved(mainResult.error.message); return; }
    setExamRows((current) => current.map((row) => row.id === editing.id ? { ...row, level_test_date: form.levelDate, level_result: form.levelResult, level_test_taken: form.levelTaken, level_test_score: form.levelScore ? Number(form.levelScore) : null, level_test_comment: form.levelComment, quiz_result: form.quizScore ? `${form.quizScore}% ${form.quizComment}`.trim() : form.quizComment, quiz_score: form.quizScore ? Number(form.quizScore) : null, quiz_comment: form.quizComment, main_test_result: form.mainScore ? `${form.mainScore}% ${form.mainComment}`.trim() : null, main_score: form.mainScore ? Number(form.mainScore) : null, main_comment: form.mainComment, main_test_passed: form.mainScore ? Number(form.mainScore) >= 60 : null, next_level_booked: form.booked === "booked", booked_group: classes.find((item) => item.id === form.groupId)?.name ?? null } : row));
    void recordAudit("updated", "exam", editing.student_id, { fields: ["placement", "quiz", "main", "booking"], student: editing.full_name });
    setSaved("Exam row updated");
  }

  function exportFiltered() {
    exportExcel("exam-list.xlsx", filteredRows.map((row) => ({ "Student ID": row.student_id ?? "", Name: row.full_name, "Current level": row.current_level ?? "", "Level determination date": row.level_test_date ?? "", "Level test taken": row.level_test_taken ? "Yes" : "No", "Level result": row.level_result ?? "", "Level score": row.level_test_score ?? "", "Level comment": row.level_test_comment ?? "", "Quiz score": row.quiz_score ?? "", "Quiz comment": row.quiz_comment ?? "", "Main score": row.main_score ?? "", "Main comment": row.main_comment ?? "", "Next level booked": row.next_level_booked ? "Yes" : "No", "Booked group": row.booked_group ?? "" })), "Exams", { widths: [24, 26, 16, 22, 16, 16, 12, 30, 12, 30, 12, 30, 18, 24] });
  }

  async function importExamList(file: File) {
    const imported = await readExcel(file);
    const supabase = createSupabaseBrowserClient();
    const payload = imported.flatMap((item) => {
      const student = examRows.find((row) => row.full_name.toLowerCase() === String(pick(item, ["name", "student"]) ?? "").toLowerCase());
      if (!student?.student_id) return [];
      const date = String(pick(item, ["level determination date", "test date", "date"]) ?? new Date().toISOString());
      const bookingStatus = String(pick(item, ["next level booked", "booked"]) ?? "").toLowerCase() === "yes" ? "booked" : "not_booked";
      return [
        { student_id: student.student_id, exam_type: "placement", scheduled_at: date, level_result: String(pick(item, ["level result", "next level"]) ?? ""), score_percent: String(pick(item, ["level test taken", "taken"]) ?? "").toLowerCase() === "yes" ? asNumber(pick(item, ["level score"])) : null, result_comment: String(pick(item, ["level comment"]) ?? "") },
        { student_id: student.student_id, exam_type: "quiz", scheduled_at: date, level_result: null, score_percent: asNumber(pick(item, ["quiz score"])), result_comment: String(pick(item, ["quiz comment"]) ?? "") },
        { student_id: student.student_id, exam_type: "main", scheduled_at: date, level_result: String(pick(item, ["level result", "next level"]) ?? ""), score_percent: asNumber(pick(item, ["main score"])), result_comment: String(pick(item, ["main comment"]) ?? ""), booking_status: bookingStatus, booked_class_id: null },
      ];
    }).filter(Boolean);
    if (payload.length) await supabase.from("exam_records").insert(payload);
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
        {editing && <form onSubmit={saveEdit} className="mb-4 grid gap-2 rounded-lg border bg-muted/30 p-4 md:grid-cols-4"><Input type="date" value={form.levelDate} onChange={(event) => setForm({ ...form, levelDate: event.target.value })} /><label className="flex items-center gap-2 rounded-md border bg-white px-3 text-sm"><input type="checkbox" checked={form.levelTaken} onChange={(event) => setForm({ ...form, levelTaken: event.target.checked })} /> Level test taken</label><Input placeholder="Level result" value={form.levelResult} onChange={(event) => setForm({ ...form, levelResult: event.target.value })} /><Input type="number" min="0" max="100" placeholder="Level score" value={form.levelScore} onChange={(event) => setForm({ ...form, levelScore: event.target.value })} /><Textarea placeholder="Level comment" value={form.levelComment} onChange={(event) => setForm({ ...form, levelComment: event.target.value })} /><Input type="number" min="0" max="100" placeholder="Quiz score" value={form.quizScore} onChange={(event) => setForm({ ...form, quizScore: event.target.value })} /><Textarea placeholder="Quiz result/comment" value={form.quizComment} onChange={(event) => setForm({ ...form, quizComment: event.target.value })} /><Input type="number" min="0" max="100" placeholder="Main test score" value={form.mainScore} onChange={(event) => setForm({ ...form, mainScore: event.target.value })} /><Textarea placeholder="Main test comment" value={form.mainComment} onChange={(event) => setForm({ ...form, mainComment: event.target.value })} /><Select value={form.booked} onChange={(event) => setForm({ ...form, booked: event.target.value })}><option value="not_booked">Next level not booked</option><option value="booked">Next level booked</option></Select><Select value={form.groupId} onChange={(event) => setForm({ ...form, groupId: event.target.value })}><option value="">Choose group</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select><div className="flex gap-2 md:col-span-4"><Button><Edit2 size={16} /> Save exam row</Button><Button type="button" variant="outline" onClick={() => setEditing(null)}><XCircle size={16} /> Cancel</Button>{saved && <span className="self-center text-sm text-muted-foreground">{saved}</span>}</div></form>}
        <div className="max-h-[70vh] overflow-auto rounded-lg border">
          <table className="w-full min-w-[1050px] text-sm">
            <thead className="sticky top-0 z-10 bg-muted">
              <tr>
                {["Student", "Current level", "Level determination", "Quizzes results", "Main test", "Next level booking", "Booked group"].map((header) => <th key={header} className="px-4 py-3 text-left font-semibold">{header}</th>)}
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
                  <td className="px-4 py-3">{row.next_level_booked ? <Badge className="border-blue-200 bg-blue-50 text-blue-700"><CalendarCheck2 size={15} /> Booked</Badge> : <Badge className="border-gray-200 bg-gray-50 text-gray-600"><CalendarX2 size={15} /> Not booked</Badge>}</td>
                  <td className="px-4 py-3">{row.next_level_booked ? row.booked_group || "Group not assigned" : ""}</td>
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
