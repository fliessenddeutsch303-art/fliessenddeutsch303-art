"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Snowflake, Upload } from "lucide-react";
import { StudentAttendanceCell } from "@/components/tables/student-attendance-cell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { exportExcel } from "@/lib/excel";
import { matchesBilingualTagSearch } from "@/lib/tag-search";
import { formatMoney } from "@/lib/utils";

function paymentStatus(row: Record<string, unknown>) {
  const balance = Math.max(0, Number(row.total_price ?? 0) - Number(row.amount_paid ?? 0));
  const dueDate = typeof row.payment_due_date === "string" ? row.payment_due_date : "";
  if (balance <= 0) return <Badge className="border-green-200 bg-green-50 text-green-700">Paid</Badge>;
  if (!dueDate) return <Badge className="border-amber-200 bg-amber-50 text-amber-700">No date</Badge>;

  const today = new Date().toISOString().slice(0, 10);
  if (dueDate < today) return <Badge className="border-brand-red bg-red-50 text-brand-red">Overdue</Badge>;
  if (dueDate === today) return <Badge className="border-brand-red bg-red-50 text-brand-red">Due today</Badge>;
  return <Badge className="border-accent bg-accent/20 text-primary">Scheduled</Badge>;
}

function className(row: Record<string, unknown>) {
  return ((row.classes as { name?: string } | null)?.name ?? "") as string;
}

function teacherName(row: Record<string, unknown>) {
  return ((row.classes as { teachers?: { name?: string } | null } | null)?.teachers?.name ?? "") as string;
}

function tagsText(row: Record<string, unknown>) {
  return Array.isArray(row.tags) ? row.tags.join(", ") : String(row.tags ?? "");
}

function freezeStatus(row: Record<string, unknown>) {
  const start = String(row.freeze_start_date ?? "");
  const end = String(row.freeze_end_date ?? "");
  if (!start || !end || Number(row.freeze_months ?? 0) === 0) return "none";
  return end < new Date().toISOString().slice(0, 10) ? "expired" : "active";
}

type PromotionClass = { id: string; name: string; level?: string | null };

export function StudentsTable({ rows, classes = [], onEdit, onPromote }: { rows: Record<string, unknown>[]; classes?: PromotionClass[]; onEdit?: (row: Record<string, unknown>) => void; onPromote?: (student: Record<string, unknown>, classId: string) => Promise<{ ok: boolean; message: string }> }) {
  const [nameQuery, setNameQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [promotionClassId, setPromotionClassId] = useState("");
  const [promotionMessage, setPromotionMessage] = useState("");

  const levels = useMemo(() => [...new Set(rows.map((row) => String(row.level ?? "")).filter(Boolean))].sort(), [rows]);
  const teachers = useMemo(() => [...new Set(rows.map(teacherName).filter(Boolean))].sort(), [rows]);
  const classNames = useMemo(() => [...new Set(rows.map(className).filter(Boolean))].sort(), [rows]);

  const visibleRows = useMemo(() => {
    const q = nameQuery.toLowerCase();
    const tagQuery = tagFilter.toLowerCase().trim();
    return rows.filter((row) => {
      const rowDate = String(row.enrolled_at ?? row.created_at ?? "").slice(0, 10);
      const matchesName = !q || String(row.full_name ?? "").toLowerCase().includes(q);
      const matchesLevel = !levelFilter || String(row.level ?? "") === levelFilter;
      const matchesTeacher = !teacherFilter || teacherName(row) === teacherFilter;
      const matchesClass = !classFilter || className(row) === classFilter;
      const matchesTag = !tagQuery || matchesBilingualTagSearch(tagsText(row), tagQuery);
      const matchesFrom = !from || rowDate >= from;
      const matchesTo = !to || rowDate <= to;
      return matchesName && matchesLevel && matchesTeacher && matchesClass && matchesTag && matchesFrom && matchesTo;
    });
  }, [classFilter, from, levelFilter, nameQuery, rows, tagFilter, teacherFilter, to]);

  const selectedRows = visibleRows.filter((row) => selected.has(String(row.id)));
  const exportRows = selectedRows.length ? selectedRows : visibleRows;
  const promotingStudent = promotingId ? rows.find((row) => String(row.id) === promotingId) : null;
  const promotionClasses = promotingStudent && promotingStudent.next_level
    ? classes.filter((klass) => klass.level === promotingStudent.next_level)
    : [];

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((current) => {
      const visibleIds = visibleRows.map((row) => String(row.id));
      const allSelected = visibleIds.every((id) => current.has(id));
      const next = new Set(current);
      visibleIds.forEach((id) => {
        if (allSelected) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  }

  function exportStudents() {
    exportExcel(
      selectedRows.length ? "selected-students.xlsx" : "filtered-students.xlsx",
      exportRows.map((row) => ({
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
        Alert: Math.max(0, Number(row.total_price ?? 0) - Number(row.amount_paid ?? 0)) <= 0 ? "Paid" : String(row.payment_due_date ?? "") < new Date().toISOString().slice(0, 10) ? "Overdue" : String(row.payment_due_date ?? "") === new Date().toISOString().slice(0, 10) ? "Due today" : "Scheduled",
        Comment: row.payment_comment as string,
        "Freeze start": row.freeze_start_date as string,
        "Freeze months": Number(row.freeze_months ?? 0),
        "Freeze end": row.freeze_end_date as string,
        "Freeze status": freezeStatus(row),
        "Finished level and stopped": row.level_completed_stopped ? "Yes" : "No",
        Enrolled: String(row.enrolled_at ?? "").slice(0, 10),
      })),
      "Students",
      { widths: [18, 14, 24, 9, 24, 16, 18, 10, 10, 12, 12, 12, 13, 12, 28, 12] },
    );
  }

  async function submitPromotion(row: Record<string, unknown>) {
    if (!onPromote || !promotionClassId) return;
    const result = await onPromote(row, promotionClassId);
    setPromotionMessage(result.message);
    if (result.ok) {
      setPromotingId(null);
      setPromotionClassId("");
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-[1fr_140px_160px_170px_170px_160px_160px_auto]">
        <Input placeholder="Student name..." value={nameQuery} onChange={(event) => setNameQuery(event.target.value)} />
        <Select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)} aria-label="Level filter">
          <option value="">All levels</option>
          {levels.map((level) => <option key={level} value={level}>{level}</option>)}
        </Select>
        <Select value={teacherFilter} onChange={(event) => setTeacherFilter(event.target.value)} aria-label="Teacher filter">
          <option value="">All teachers</option>
          {teachers.map((teacher) => <option key={teacher} value={teacher}>{teacher}</option>)}
        </Select>
        <Select value={classFilter} onChange={(event) => setClassFilter(event.target.value)} aria-label="Class name filter">
          <option value="">All classes</option>
          {classNames.map((name) => <option key={name} value={name}>{name}</option>)}
        </Select>
        <Input placeholder="Tag..." value={tagFilter} onChange={(event) => setTagFilter(event.target.value)} aria-label="Tag filter" />
        <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="From date" />
        <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="To date" />
        <Button type="button" variant="outline" onClick={exportStudents} disabled={!exportRows.length}>
          <Upload size={16} />
          {selectedRows.length ? `Export Selected (${selectedRows.length})` : `Export Filtered (${visibleRows.length})`}
        </Button>
      </div>

      <div className="max-h-[70vh] overflow-auto rounded-lg border bg-white">
        <table dir="rtl" className="w-full min-w-[1680px] text-right text-sm [&_th]:align-middle [&_td]:align-middle">
          <thead className="sticky top-0 z-10 bg-muted">
            <tr>
              <th className="px-4 py-3 text-center"><input type="checkbox" checked={visibleRows.length > 0 && visibleRows.every((row) => selected.has(String(row.id)))} onChange={toggleAll} /></th>
              {["Name", "Phone", "Email", "Level", "Tags", "Class", "Teacher", "Online / Offline", "Price", "Paid", "Not Paid", "Payment Date", "Alert", "Freeze started", "Freeze finished", "Freeze status", "Finished / Stopped", "Comment", "Status", "Attendance", "Actions"].map((header) => (
                <th key={header} className="px-4 py-3 text-right font-semibold">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const id = String(row.id);
              return (
                <tr key={id} className="border-t">
                  <td className="px-4 py-3 text-center"><input type="checkbox" checked={selected.has(id)} onChange={() => toggle(id)} /></td>
                  <td className="min-w-[150px] whitespace-nowrap px-4 py-3">{String(row.full_name ?? "")}</td>
                  <td className="whitespace-nowrap px-4 py-3">{String(row.phone ?? "")}</td>
                  <td className="min-w-[190px] whitespace-nowrap px-4 py-3">{String(row.email ?? "")}</td>
                  <td className="whitespace-nowrap px-4 py-3">{String(row.level ?? "")}</td>
                  <td className="max-w-[180px] px-4 py-3 break-words">{tagsText(row)}</td>
                  <td className="px-4 py-3">
                    <div className="flex min-w-[150px] flex-col items-start gap-2">
                      <span>{className(row)}</span>
                      {onPromote && row.promotion_candidate === true && <Button type="button" size="sm" variant="outline" onClick={() => { setPromotingId(id); setPromotionClassId(""); setPromotionMessage(""); }}>Promote to next class</Button>}
                    </div>
                  </td>
                  <td className="min-w-[120px] px-4 py-3">{teacherName(row)}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.learning_mode === "online" ? "Online" : "Offline"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-center">{formatMoney(Number(row.total_price ?? 0))}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-center">{formatMoney(Number(row.amount_paid ?? 0))}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-center">{formatMoney(Math.max(0, Number(row.total_price ?? 0) - Number(row.amount_paid ?? 0)))}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-center">{String(row.payment_due_date ?? "")}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-center">{paymentStatus(row)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-center">{String(row.freeze_start_date ?? "")}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-center">{String(row.freeze_end_date ?? "")}</td>
                  <td className="px-4 py-3">{freezeStatus(row) === "active" ? <Badge className="border-blue-200 bg-blue-50 text-blue-700"><Snowflake size={15} /> Active</Badge> : freezeStatus(row) === "expired" ? <Badge className="border-red-200 bg-red-50 text-red-700">Expired</Badge> : ""}</td>
                  <td className="px-4 py-3">{row.level_completed_stopped ? <Badge className="border-yellow-200 bg-yellow-50 text-yellow-700"><CheckCircle2 size={15} /> Finished level</Badge> : ""}</td>
                  <td className="px-4 py-3">{String(row.payment_comment ?? "")}</td>
                  <td className="px-4 py-3">{String(row.status ?? "")}</td>
                  <td className="px-4 py-3"><StudentAttendanceCell studentId={id} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button asChild size="sm" variant="outline"><Link href={`/admin/students/${id}`}>Profile</Link></Button>
                      <Button asChild size="sm" variant="outline"><Link href={`/receipts/student/${id}`}>Receipt</Link></Button>
                      {onEdit && <Button size="sm" variant="outline" onClick={() => onEdit(row)}>Edit</Button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!visibleRows.length && <div className="p-8 text-center text-muted-foreground">No students match this filter.</div>}
      </div>
      {promotionMessage && <p className="text-sm text-muted-foreground">{promotionMessage}</p>}
      {promotingStudent && onPromote && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 p-4" role="dialog" aria-modal="true" aria-labelledby="promote-student-title">
          <div className="w-full max-w-md rounded-lg border border-accent bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4 border-b pb-3">
              <div>
                <h2 id="promote-student-title" className="text-lg font-semibold">Promote student</h2>
                <p className="text-sm text-muted-foreground">{String(promotingStudent.full_name ?? "")} · {String(promotingStudent.level ?? "")} → {String(promotingStudent.next_level ?? "next level")}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => { setPromotingId(null); setPromotionMessage(""); }}>Cancel</Button>
            </div>
            <label className="grid gap-1 text-sm font-medium">
              Destination class
              <Select value={promotionClassId} onChange={(event) => setPromotionClassId(event.target.value)} aria-label="Destination class">
                <option value="">Choose an existing class...</option>
                {promotionClasses.map((klass) => <option key={klass.id} value={klass.id}>{klass.name}{klass.level ? ` · ${klass.level}` : ""}</option>)}
              </Select>
            </label>
            {!promotionClasses.length && <p className="mt-3 text-sm text-muted-foreground">Create a class for the next level first, then return here to promote this student.</p>}
            <Button className="mt-4 w-full" onClick={() => void submitPromotion(promotingStudent)} disabled={!promotionClassId || !promotionClasses.length}>Confirm promotion</Button>
          </div>
        </div>
      )}
    </div>
  );
}
