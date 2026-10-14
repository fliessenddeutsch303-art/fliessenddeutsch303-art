"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { useOfflineQueue } from "@/hooks/use-offline-queue";

type Teacher = { id: string; name: string; pay_type: string };
type Employee = { id: string; full_name: string; role: string; payroll_type?: string | null; account_user_id?: string | null };
type Student = { id: string; full_name: string };
type Class = { id: string; name: string; students?: Student[] };

export function TeacherAttendanceForm({ teachers, employees = [], recordedBy }: { teachers: Teacher[]; employees?: Employee[]; recordedBy: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [rows, setRows] = useState<Record<string, { present: boolean; check_in: string; check_out: string; sessions_count: number; notes: string }>>(
    Object.fromEntries(teachers.map((teacher) => [teacher.id, { present: true, check_in: "", check_out: "", sessions_count: 0, notes: "" }])),
  );
  const [employeeRows, setEmployeeRows] = useState<Record<string, { present: boolean; check_in: string; check_out: string; notes: string }>>(
    Object.fromEntries(employees.map((employee) => [employee.id, { present: true, check_in: "", check_out: "", notes: "" }])),
  );
  const { enqueue, pending, message } = useOfflineQueue();
  async function save() {
    for (const teacher of teachers) {
      const row = rows[teacher.id];
      await enqueue("teacher_attendance", { teacher_id: teacher.id, date, check_in: row.present ? row.check_in || null : null, check_out: row.present ? row.check_out || null : null, sessions_count: row.present ? row.sessions_count : 0, notes: row.notes, recorded_by: recordedBy });
    }
    for (const employee of employees) {
      const row = employeeRows[employee.id];
      await enqueue("employee_attendance", { user_id: employee.account_user_id ?? null, employee_profile_id: employee.id, date, check_in: row.present ? row.check_in || null : null, check_out: row.present ? row.check_out || null : null, notes: row.notes, recorded_by: recordedBy });
    }
  }
  return (
    <div className="space-y-4">
      {pending > 0 && <div className="rounded-md bg-accent/20 p-3 text-sm">You are offline — {pending} changes saved locally, will sync when reconnected</div>}
      {message && <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{message}</div>}
      <Input className="max-w-xs" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <div className="grid gap-3">
        {employees.map((employee) => {
          const row = employeeRows[employee.id];
          return (
            <Card key={employee.id}>
              <CardHeader><CardTitle>{employee.full_name} <span className="text-sm font-normal text-muted-foreground">({employee.role})</span></CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-4">
                <Select value={row.present ? "present" : "absent"} onChange={(e) => setEmployeeRows((value) => ({ ...value, [employee.id]: { ...row, present: e.target.value === "present" } }))}>
                  <option value="present">Present</option><option value="absent">Absent</option>
                </Select>
                {row.present && <Input type="time" value={row.check_in} onChange={(e) => setEmployeeRows((value) => ({ ...value, [employee.id]: { ...row, check_in: e.target.value } }))} />}
                {row.present && <Input type="time" value={row.check_out} onChange={(e) => setEmployeeRows((value) => ({ ...value, [employee.id]: { ...row, check_out: e.target.value } }))} />}
                <Textarea placeholder="Notes" value={row.notes} onChange={(e) => setEmployeeRows((value) => ({ ...value, [employee.id]: { ...row, notes: e.target.value } }))} />
              </CardContent>
            </Card>
          );
        })}
        {teachers.map((teacher) => {
          const row = rows[teacher.id];
          return (
            <Card key={teacher.id}>
              <CardHeader><CardTitle>{teacher.name}</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-5">
                <Select value={row.present ? "present" : "absent"} onChange={(e) => setRows((value) => ({ ...value, [teacher.id]: { ...row, present: e.target.value === "present" } }))}>
                  <option value="present">Present</option><option value="absent">Absent</option>
                </Select>
                {row.present && <Input type="time" value={row.check_in} onChange={(e) => setRows((value) => ({ ...value, [teacher.id]: { ...row, check_in: e.target.value } }))} />}
                {row.present && <Input type="time" value={row.check_out} onChange={(e) => setRows((value) => ({ ...value, [teacher.id]: { ...row, check_out: e.target.value } }))} />}
                {row.present && teacher.pay_type === "per_session" && <Input type="number" min={0} value={row.sessions_count} onChange={(e) => setRows((value) => ({ ...value, [teacher.id]: { ...row, sessions_count: Number(e.target.value) } }))} />}
                <Textarea placeholder="Notes" value={row.notes} onChange={(e) => setRows((value) => ({ ...value, [teacher.id]: { ...row, notes: e.target.value } }))} />
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Button size="lg" onClick={save}>Save All</Button>
    </div>
  );
}

export function StudentAttendanceForm({ classes, recordedBy }: { classes: Class[]; recordedBy: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const { enqueue, pending, message } = useOfflineQueue();
  const klass = classes.find((item) => item.id === classId);

  useEffect(() => {
    setSelectedStudents((klass?.students ?? []).map((student) => student.id));
  }, [classId, klass]);

  async function save() {
    const selected = new Set(selectedStudents);
    for (const student of (klass?.students ?? []).filter((item) => selected.has(item.id))) {
      await enqueue("student_attendance", { student_id: student.id, class_id: classId, date, status: statuses[student.id] ?? "present", recorded_by: recordedBy });
    }
  }

  function toggleStudent(id: string) {
    setSelectedStudents((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
  }

  function toggleAll() {
    const all = (klass?.students ?? []).map((student) => student.id);
    setSelectedStudents((ids) => ids.length === all.length ? [] : all);
  }

  function setSelectedStatus(status: string) {
    setStatuses((current) => ({
      ...current,
      ...Object.fromEntries(selectedStudents.map((id) => [id, status])),
    }));
  }

  return (
    <div className="space-y-4">
      {pending > 0 && <div className="rounded-md bg-accent/20 p-3 text-sm">You are offline — {pending} changes saved locally, will sync when reconnected</div>}
      {message && <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{message}</div>}
      <div className="grid gap-3 md:grid-cols-2">
        <Select value={classId} onChange={(e) => setClassId(e.target.value)}>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-4">
          <Button type="button" variant="outline" onClick={toggleAll}>{selectedStudents.length === (klass?.students ?? []).length ? "Unselect all" : "Select all"}</Button>
          <span className="text-sm text-muted-foreground">{selectedStudents.length} selected</span>
          {["present", "absent", "late", "excused"].map((status) => (
            <Button key={status} type="button" variant="outline" onClick={() => setSelectedStatus(status)} disabled={!selectedStudents.length}>{status}</Button>
          ))}
          <Button className="touch-button ml-auto" size="lg" onClick={save} disabled={!selectedStudents.length}>Submit Selected Attendance</Button>
        </CardContent>
      </Card>
      <div className="grid gap-3">
        {(klass?.students ?? []).map((student) => (
          <Card key={student.id}>
            <CardContent className="grid gap-3 p-4 md:grid-cols-[44px_1fr_repeat(4,120px)] md:items-center">
              <input className="h-5 w-5" type="checkbox" checked={selectedStudents.includes(student.id)} onChange={() => toggleStudent(student.id)} aria-label={`Select ${student.full_name}`} />
              <div className="font-medium">{student.full_name}</div>
              {["present", "absent", "late", "excused"].map((status) => (
                <Button key={status} className="touch-button" variant={(statuses[student.id] ?? "present") === status ? "default" : "outline"} onClick={() => setStatuses((value) => ({ ...value, [student.id]: status }))}>{status}</Button>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
