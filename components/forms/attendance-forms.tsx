"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { useOfflineQueue } from "@/hooks/use-offline-queue";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { academyDate } from "@/lib/dates";

type Teacher = { id: string; name: string; pay_type: string };
type Employee = { id: string; full_name: string; role: string; payroll_type?: string | null; account_user_id?: string | null };
type Student = { id: string; full_name: string };
type Class = { id: string; name: string; students?: Student[] };
type StaffRow = { present: boolean; check_in: string; check_out: string; sessions_count: number; notes: string };

const blankRow: StaffRow = { present: false, check_in: "", check_out: "", sessions_count: 0, notes: "" };
const timeValue = (value: unknown) => String(value ?? "").slice(0, 5);

function refreshClassProgress(body: { classIds?: string[]; teacherId?: string; date: string }) {
  // Best effort: a failure here must never hide the "saved" message.
  return fetch("/api/class-progress", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
}

function QueueStatus({ pending, message, error }: { pending: number; message: string; error: string }) {
  return <>
    {pending > 0 && <div className="rounded-md bg-accent/20 p-3 text-sm">{pending} change{pending === 1 ? "" : "s"} waiting to upload (stored on this device until you are online)</div>}
    {message && <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{message}</div>}
    {error && <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
  </>;
}

export function TeacherAttendanceForm({ teachers, employees = [], recordedBy }: { teachers: Teacher[]; employees?: Employee[]; recordedBy: string }) {
  const [date, setDate] = useState(academyDate());
  const [rows, setRows] = useState<Record<string, StaffRow>>({});
  const [employeeRows, setEmployeeRows] = useState<Record<string, StaffRow>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [validation, setValidation] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const { enqueue, sync, pending, message, error } = useOfflineQueue();

  // Load what is already recorded for the day so saving never wipes earlier check-ins.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError("");
      const supabase = createSupabaseBrowserClient();
      const [teacherResult, employeeResult] = await Promise.all([
        supabase.from("teacher_attendance").select("teacher_id,check_in,check_out,sessions_count,notes").eq("date", date),
        supabase.from("employee_attendance").select("employee_profile_id,check_in,check_out,notes").eq("date", date),
      ]);
      if (cancelled) return;
      if (teacherResult.error || employeeResult.error) {
        setRows({});
        setEmployeeRows({});
        setDirty(new Set());
        setLoadError(`Could not load saved attendance: ${(teacherResult.error ?? employeeResult.error)?.message}. Saving is disabled so existing records are not overwritten.`);
        setLoading(false);
        return;
      }
      const toRow = (record: Record<string, unknown>): StaffRow => ({ present: Boolean(record.check_in), check_in: timeValue(record.check_in), check_out: timeValue(record.check_out), sessions_count: Number(record.sessions_count ?? 0), notes: String(record.notes ?? "") });
      setRows(Object.fromEntries((teacherResult.data ?? []).map((record) => [record.teacher_id, toRow(record)])));
      setEmployeeRows(Object.fromEntries((employeeResult.data ?? []).filter((record) => record.employee_profile_id).map((record) => [record.employee_profile_id, toRow(record)])));
      setDirty(new Set());
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [date]);

  function updateTeacher(id: string, patch: Partial<StaffRow>) {
    setRows((value) => ({ ...value, [id]: { ...(value[id] ?? blankRow), ...patch } }));
    setDirty((value) => new Set(value).add(`teacher:${id}`));
  }

  function updateEmployee(id: string, patch: Partial<StaffRow>) {
    setEmployeeRows((value) => ({ ...value, [id]: { ...(value[id] ?? blankRow), ...patch } }));
    setDirty((value) => new Set(value).add(`employee:${id}`));
  }

  async function save() {
    const changedTeachers = teachers.filter((teacher) => dirty.has(`teacher:${teacher.id}`));
    const changedEmployees = employees.filter((employee) => dirty.has(`employee:${employee.id}`));
    if (!changedTeachers.length && !changedEmployees.length) {
      setValidation("No changes to save.");
      return;
    }
    const problems: string[] = [];
    const check = (name: string, row: StaffRow, perSession: boolean) => {
      if (!row.present) return true;
      if (!row.check_in) { problems.push(`${name}: enter a check-in time.`); return false; }
      if (row.check_out && row.check_out <= row.check_in) { problems.push(`${name}: check-out must be later than check-in.`); return false; }
      if (perSession && (!Number.isInteger(row.sessions_count) || row.sessions_count < 0)) { problems.push(`${name}: sessions must be a whole number of 0 or more.`); return false; }
      return true;
    };
    const validTeachers = changedTeachers.filter((teacher) => check(teacher.name, rows[teacher.id] ?? blankRow, teacher.pay_type === "per_session"));
    const validEmployees = changedEmployees.filter((employee) => check(employee.full_name, employeeRows[employee.id] ?? blankRow, false));
    setValidation(problems.length ? `Not saved - ${problems.join(" ")}` : "");
    const queued = new Map<string, string>();
    for (const teacher of validTeachers) {
      const row = rows[teacher.id] ?? blankRow;
      queued.set(`teacher:${teacher.id}`, await enqueue("teacher_attendance", { teacher_id: teacher.id, date, check_in: row.present ? row.check_in || null : null, check_out: row.present ? row.check_out || null : null, sessions_count: row.present ? row.sessions_count : 0, notes: row.notes, recorded_by: recordedBy }));
    }
    for (const employee of validEmployees) {
      const row = employeeRows[employee.id] ?? blankRow;
      queued.set(`employee:${employee.id}`, await enqueue("employee_attendance", { user_id: employee.account_user_id ?? null, employee_profile_id: employee.id, date, check_in: row.present ? row.check_in || null : null, check_out: row.present ? row.check_out || null : null, notes: row.notes, recorded_by: recordedBy }));
    }
    if (!queued.size) return;
    const result = await sync();
    const rejected = new Set(result?.failedIds ?? []);
    setDirty((value) => {
      const next = new Set(value);
      for (const [key, id] of queued) if (!rejected.has(id)) next.delete(key);
      return next;
    });
    if (result && result.pending === 0) {
      for (const teacher of validTeachers) if (!rejected.has(queued.get(`teacher:${teacher.id}`) ?? "") && (rows[teacher.id] ?? blankRow).present) void refreshClassProgress({ teacherId: teacher.id, date });
    }
  }

  function staffFields(row: StaffRow, update: (patch: Partial<StaffRow>) => void, showSessions: boolean) {
    return <>
      <Select value={row.present ? "present" : "absent"} onChange={(e) => update({ present: e.target.value === "present" })} aria-label="Attendance status">
        <option value="absent">Not checked in / absent</option><option value="present">Present</option>
      </Select>
      {row.present && <label className="grid gap-1 text-xs text-muted-foreground">Check in<Input type="time" value={row.check_in} onChange={(e) => update({ check_in: e.target.value })} /></label>}
      {row.present && <label className="grid gap-1 text-xs text-muted-foreground">Check out<Input type="time" value={row.check_out} onChange={(e) => update({ check_out: e.target.value })} /></label>}
      {row.present && showSessions && <label className="grid gap-1 text-xs text-muted-foreground">Sessions<Input type="number" min={0} value={row.sessions_count} step={1} onChange={(e) => update({ sessions_count: Number(e.target.value) })} /></label>}
      <Textarea placeholder="Notes" value={row.notes} onChange={(e) => update({ notes: e.target.value })} />
    </>;
  }

  return (
    <div className="space-y-4">
      <QueueStatus pending={pending} message={message} error={error} />
      {loadError && <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{loadError}</div>}
      {validation && <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{validation}</div>}
      <div className="flex flex-wrap items-center gap-3"><Input className="max-w-xs" type="date" value={date} onChange={(e) => setDate(e.target.value)} />{loading && <span className="text-sm text-muted-foreground">Loading saved attendance…</span>}</div>
      <div className="grid gap-3">
        {employees.map((employee) => (
          <Card key={employee.id} className={dirty.has(`employee:${employee.id}`) ? "border-accent" : ""}>
            <CardHeader><CardTitle>{employee.full_name} <span className="text-sm font-normal text-muted-foreground">({employee.role})</span></CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-4">{staffFields(employeeRows[employee.id] ?? blankRow, (patch) => updateEmployee(employee.id, patch), false)}</CardContent>
          </Card>
        ))}
        {teachers.map((teacher) => (
          <Card key={teacher.id} className={dirty.has(`teacher:${teacher.id}`) ? "border-accent" : ""}>
            <CardHeader><CardTitle>{teacher.name} <span className="text-sm font-normal text-muted-foreground">(teacher)</span></CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-5">{staffFields(rows[teacher.id] ?? blankRow, (patch) => updateTeacher(teacher.id, teacher.pay_type === "per_session" && patch.check_in && !(rows[teacher.id]?.sessions_count) ? { ...patch, sessions_count: 1 } : patch), teacher.pay_type === "per_session")}</CardContent>
          </Card>
        ))}
        {!employees.length && !teachers.length && <p className="rounded-md border bg-white p-6 text-sm text-muted-foreground">No active employee profiles or teachers yet.</p>}
      </div>
      <Button size="lg" onClick={() => void save()} disabled={loading || Boolean(loadError)}>Save changes ({dirty.size})</Button>
    </div>
  );
}

export function StudentAttendanceForm({ classes, recordedBy }: { classes: Class[]; recordedBy: string }) {
  const [date, setDate] = useState(academyDate());
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const { enqueue, sync, pending, message, error } = useOfflineQueue();
  const klass = classes.find((item) => item.id === classId);

  useEffect(() => {
    setSelectedStudents((klass?.students ?? []).map((student) => student.id));
  }, [classId, klass]);

  // Show statuses already recorded (including QR scans); students without a record stay "not marked".
  useEffect(() => {
    let cancelled = false;
    setStatuses({});
    setTouched(new Set());
    setReady(false);
    setLoadError("");
    setNotice("");
    if (!classId) return;
    void createSupabaseBrowserClient().from("student_attendance").select("student_id,status").eq("class_id", classId).eq("date", date).then(({ data, error: loadFailure }) => {
      if (cancelled) return;
      if (loadFailure) {
        setLoadError(`Could not load saved attendance: ${loadFailure.message}. Saving is disabled so existing records are not overwritten.`);
        return;
      }
      setStatuses(Object.fromEntries((data ?? []).map((row) => [row.student_id, row.status])));
      setReady(true);
    });
    return () => { cancelled = true; };
  }, [classId, date]);

  async function save() {
    const selected = new Set(selectedStudents);
    const rows = (klass?.students ?? []).filter((item) => selected.has(item.id) && touched.has(item.id) && statuses[item.id]);
    if (!rows.length) {
      setNotice("Nothing to save: mark at least one selected student first.");
      return;
    }
    setNotice("");
    const queued = new Map<string, string>();
    for (const student of rows) queued.set(student.id, await enqueue("student_attendance", { student_id: student.id, class_id: classId, date, status: statuses[student.id], recorded_by: recordedBy }));
    const result = await sync();
    const rejected = new Set(result?.failedIds ?? []);
    setTouched((value) => {
      const next = new Set(value);
      for (const [studentId, id] of queued) if (!rejected.has(id)) next.delete(studentId);
      return next;
    });
    if (result && result.pending === 0 && !result.failed.length) void refreshClassProgress({ classIds: [classId], date });
  }

  function toggleStudent(id: string) {
    setSelectedStudents((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
  }

  function toggleAll() {
    const all = (klass?.students ?? []).map((student) => student.id);
    setSelectedStudents((ids) => ids.length === all.length ? [] : all);
  }

  function markStatus(ids: string[], status: string) {
    setStatuses((current) => ({ ...current, ...Object.fromEntries(ids.map((id) => [id, status])) }));
    setTouched((current) => new Set([...current, ...ids]));
  }

  const students = klass?.students ?? [];
  const canSave = ready && !loadError;

  return (
    <div className="space-y-4">
      <QueueStatus pending={pending} message={message} error={error} />
      {loadError && <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{loadError}</div>}
      {notice && <div role="alert" className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">{notice}</div>}
      <div className="grid gap-3 md:grid-cols-2">
        <Select value={classId} onChange={(e) => setClassId(e.target.value)}>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-4">
          <Button type="button" variant="outline" onClick={toggleAll}>{selectedStudents.length === students.length ? "Unselect all" : "Select all"}</Button>
          <span className="text-sm text-muted-foreground">{selectedStudents.length} selected{!ready && !loadError && classId ? " · loading saved attendance…" : ""}</span>
          <Button type="button" variant="outline" onClick={() => markStatus(students.map((student) => student.id), "present")} disabled={!canSave || !students.length}>Mark all present</Button>
          {["present", "absent", "late", "excused"].map((status) => (
            <Button key={status} type="button" variant="outline" onClick={() => markStatus(selectedStudents, status)} disabled={!canSave || !selectedStudents.length}>{status}</Button>
          ))}
          <Button className="touch-button ml-auto" size="lg" onClick={() => void save()} disabled={!canSave || !selectedStudents.length}>Submit Selected Attendance</Button>
        </CardContent>
      </Card>
      <div className="grid gap-3">
        {students.map((student) => (
          <Card key={student.id}>
            <CardContent className="grid gap-3 p-4 md:grid-cols-[44px_1fr_repeat(4,120px)] md:items-center">
              <input className="h-5 w-5" type="checkbox" checked={selectedStudents.includes(student.id)} onChange={() => toggleStudent(student.id)} aria-label={`Select ${student.full_name}`} />
              <div className="font-medium">{student.full_name}{ready && !statuses[student.id] && <span className="ml-2 text-xs font-normal text-muted-foreground">not marked</span>}</div>
              {["present", "absent", "late", "excused"].map((status) => (
                <Button key={status} className="touch-button" variant={statuses[student.id] === status ? "default" : "outline"} disabled={!canSave} onClick={() => markStatus([student.id], status)}>{status}</Button>
              ))}
            </CardContent>
          </Card>
        ))}
        {!classes.length && <p className="rounded-md border bg-white p-6 text-sm text-muted-foreground">No classes yet.</p>}
      </div>
    </div>
  );
}
