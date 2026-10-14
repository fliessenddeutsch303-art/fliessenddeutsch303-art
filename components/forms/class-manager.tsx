"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Edit2, Plus, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ClassExcelTools } from "@/components/forms/class-excel-tools";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { recordAudit } from "@/lib/audit";

type Teacher = { id: string; name: string };
type ClassStudent = { id: string; full_name: string; phone?: string | null; email?: string | null; level?: string | null; learning_mode?: string | null; status?: string | null; promotion_candidate?: boolean; next_level?: string | null };
type ClassRow = {
  id: string;
  name: string;
  teacher_id?: string | null;
  level?: string | null;
  current_chapter?: string | null;
  learning_mode?: string | null;
  schedule: string;
  capacity: number;
  total_sessions?: number | null;
  sessions_done?: number | null;
  class_status?: "not_started" | "started" | "finished" | string | null;
  last_session_completed_date?: string | null;
  student_scan_count?: number;
  teacher_scanned?: boolean;
  session_qualified?: boolean;
  teachers?: { name: string } | null;
  students?: ClassStudent[];
};

const weekDays = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

function groupStatus(row: ClassRow) {
  const done = Number(row.sessions_done ?? 0);
  const total = Number(row.total_sessions ?? 0);
  const value = row.class_status ?? (total > 0 && done >= total ? "finished" : done > 0 ? "started" : "not_started");
  if (value === "finished") return { label: "Finished", className: "border-yellow-300 bg-yellow-50" };
  if (value === "started") return { label: "Started", className: "border-green-300 bg-green-50" };
  return { label: "Not started", className: "border-blue-300 bg-blue-50" };
}

export function ClassManager({ initialClasses, teachers }: { initialClasses: ClassRow[]; teachers: Teacher[] }) {
  const [classes, setClasses] = useState(initialClasses);
  const [editing, setEditing] = useState<ClassRow | null>(null);
  const [name, setName] = useState("");
  const [teacherId, setTeacherId] = useState(teachers[0]?.id ?? "");
  const [level, setLevel] = useState("");
  const [currentChapter, setCurrentChapter] = useState("");
  const [learningMode, setLearningMode] = useState("offline");
  const [scheduleSlots, setScheduleSlots] = useState<Record<string, string>>({});
  const [capacity, setCapacity] = useState("12");
  const [totalSessions, setTotalSessions] = useState("12");
  const [sessionsDone, setSessionsDone] = useState("0");
  const [classStatus, setClassStatus] = useState("not_started");
  const [saved, setSaved] = useState("");
  const [openClassIds, setOpenClassIds] = useState<string[]>([]);
  const [promotingStudent, setPromotingStudent] = useState<(ClassStudent & { fromClassId: string; fromClassName: string }) | null>(null);
  const [promotionDestination, setPromotionDestination] = useState<"class" | "waiting" | "freeze">("class");
  const [promotionClassId, setPromotionClassId] = useState("");
  const [freezeMonths, setFreezeMonths] = useState("1");
  const [promotionMessage, setPromotionMessage] = useState("");

  const title = editing ? "Edit Class" : "Create Class";
  const buttonLabel = editing ? "Update Class" : "Save Class";

  function reset() {
    setEditing(null);
    setName("");
    setTeacherId(teachers[0]?.id ?? "");
    setLevel("");
    setCurrentChapter("");
    setLearningMode("offline");
    setScheduleSlots({});
    setCapacity("12");
    setTotalSessions("12");
    setSessionsDone("0");
    setClassStatus("not_started");
    setSaved("");
  }

  function startEdit(row: ClassRow) {
    setEditing(row);
    setName(row.name);
    setTeacherId(row.teacher_id ?? teachers[0]?.id ?? "");
    setLevel(row.level ?? "");
    setCurrentChapter(row.current_chapter ?? "");
    setLearningMode(row.learning_mode === "online" ? "online" : "offline");
    const slots: Record<string, string> = {};
    if (row.schedule.includes("|")) {
      row.schedule.split("|").forEach((part) => {
        const day = weekDays.find((item) => part.trim().startsWith(item));
        if (day) slots[day] = part.trim().slice(day.length).trim();
      });
    } else {
      const time = row.schedule.match(/\d{1,2}:\d{2}/)?.[0] ?? "";
      weekDays.filter((day) => row.schedule.includes(day)).forEach((day) => { slots[day] = time; });
    }
    setScheduleSlots(slots);
    setCapacity(String(row.capacity));
    setTotalSessions(String(row.total_sessions ?? 12));
    setSessionsDone(String(row.sessions_done ?? 0));
    setClassStatus(row.class_status ?? (Number(row.sessions_done ?? 0) > 0 ? "started" : "not_started"));
    setSaved("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const schedule = weekDays.filter((day) => scheduleSlots[day]).map((day) => `${day} ${scheduleSlots[day]}`).join(" | ");
    const payload = { name, teacher_id: teacherId || null, level, current_chapter: currentChapter, learning_mode: learningMode, schedule, capacity: Number(capacity), total_sessions: Number(totalSessions), sessions_done: Number(sessionsDone), class_status: classStatus };
    const supabase = createSupabaseBrowserClient();
    if (editing) {
      const { error } = await supabase.from("classes").update(payload).eq("id", editing.id);
      if (error) {
        setSaved(error.message);
        return;
      }
      setClasses((rows) => rows.map((row) => row.id === editing.id ? { ...row, ...payload, teachers: teachers.find((teacher) => teacher.id === teacherId) ?? null } : row));
      void recordAudit("updated", "class", editing.id, { fields: Object.keys(payload), name: payload.name, status: payload.class_status });
      setSaved("Class updated");
      setEditing((current) => current ? { ...current, ...payload } : current);
      return;
    }

    const { data, error } = await supabase.from("classes").insert(payload).select("id,name,teacher_id,level,current_chapter,learning_mode,schedule,capacity,total_sessions,sessions_done,last_session_completed_date,class_status").single();
    if (error) {
      setSaved(error.message);
      return;
    }
    const created = {
      id: data.id,
      name: data.name,
      teacher_id: data.teacher_id,
      level: data.level,
      current_chapter: data.current_chapter ?? payload.current_chapter,
      learning_mode: data.learning_mode,
      schedule: data.schedule,
      capacity: data.capacity,
      total_sessions: data.total_sessions ?? payload.total_sessions,
      sessions_done: data.sessions_done ?? payload.sessions_done,
      class_status: data.class_status ?? payload.class_status,
      last_session_completed_date: data.last_session_completed_date ?? null,
      teachers: teachers.find((teacher) => teacher.id === data.teacher_id) ?? null,
      students: [],
    };
    setClasses((rows) => [created, ...rows]);
    void recordAudit("created", "class", data.id, { fields: Object.keys(payload), name: payload.name, status: payload.class_status });
    setSaved("Class saved");
    reset();
  }

  const tableRows = useMemo(
    () => classes.map((row) => ({ ...row, teacher: row.teachers?.name ?? teachers.find((teacher) => teacher.id === row.teacher_id)?.name ?? "Unassigned" })),
    [classes, teachers],
  );
  const [teacherFilter, setTeacherFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedClassIds, setSelectedClassIds] = useState<Set<string>>(new Set());
  const filteredRows = useMemo(() => tableRows.filter((row) => {
    const status = groupStatus(row).label.toLowerCase().replace(" ", "_");
    return (teacherFilter === "all" || row.teacher_id === teacherFilter)
      && (levelFilter === "all" || row.level === levelFilter)
      && (modeFilter === "all" || row.learning_mode === modeFilter)
      && (statusFilter === "all" || status === statusFilter);
  }), [tableRows, teacherFilter, levelFilter, modeFilter, statusFilter]);
  const selectedRows = useMemo(() => classes.filter((row) => selectedClassIds.has(row.id)), [classes, selectedClassIds]);

  function toggleClassSelection(id: string) {
    setSelectedClassIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleFilteredSelection() {
    setSelectedClassIds((current) => {
      const next = new Set(current);
      const allSelected = filteredRows.length > 0 && filteredRows.every((row) => next.has(row.id));
      filteredRows.forEach((row) => allSelected ? next.delete(row.id) : next.add(row.id));
      return next;
    });
  }

  function toggleDay(day: string) {
    setScheduleSlots((slots) => {
      if (slots[day] !== undefined) {
        const next = { ...slots };
        delete next[day];
        return next;
      }
      return { ...slots, [day]: "18:00" };
    });
  }

  function setScheduleTime(day: string, time: string) {
    setScheduleSlots((slots) => ({ ...slots, [day]: time }));
  }

  const canSubmit = Boolean(
    name.trim()
    && level.trim()
    && teacherId
    && Object.keys(scheduleSlots).length > 0
    && Object.values(scheduleSlots).every(Boolean)
    && Number(capacity) >= 1
    && Number(totalSessions) >= 0
    && Number(sessionsDone) >= 0
    && Number(sessionsDone) <= Number(totalSessions),
  );

  function toggleClass(id: string) {
    setOpenClassIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
  }

  const promotionClasses = promotingStudent?.next_level
    ? classes.filter((row) => row.id !== promotingStudent.fromClassId && row.level === promotingStudent.next_level)
    : [];

  async function promoteStudent() {
    if (!promotingStudent) return;
    const targetClass = classes.find((row) => row.id === promotionClassId);
    const supabase = createSupabaseBrowserClient();
    const today = new Date().toISOString().slice(0, 10);
    let error: { message: string } | null = null;

    if (promotionDestination === "class") {
      if (!targetClass) return;
      const payload = { class_id: targetClass.id, level: promotingStudent.next_level, level_completed_stopped: false };
      ({ error } = await supabase.from("students").update(payload).eq("id", promotingStudent.id));
    } else if (promotionDestination === "waiting") {
      const { error: leadError } = await supabase.from("leads").insert({
        full_name: promotingStudent.full_name,
        phone: promotingStudent.phone ?? "",
        source: "Student transfer",
        status: "waiting",
        crm_data: {
          level: promotingStudent.next_level ?? promotingStudent.level ?? "",
          previous_class: promotingStudent.fromClassName,
          reminder_note: "Student is waiting for a suitable next class.",
        },
      });
      if (leadError) error = leadError;
      else ({ error } = await supabase.from("students").update({ class_id: null }).eq("id", promotingStudent.id));
    } else {
      const months = Math.min(3, Math.max(1, Number(freezeMonths)));
      const end = new Date(`${today}T12:00:00`);
      end.setMonth(end.getMonth() + months);
      ({ error } = await supabase.from("students").update({ class_id: null, freeze_start_date: today, freeze_months: months, freeze_end_date: end.toISOString().slice(0, 10) }).eq("id", promotingStudent.id));
    }
    if (error) {
      setPromotionMessage(error.message);
      return;
    }
    setClasses((current) => current.map((row) => {
      if (row.id === promotingStudent.fromClassId) return { ...row, students: (row.students ?? []).filter((student) => student.id !== promotingStudent.id) };
      if (promotionDestination === "class" && targetClass && row.id === targetClass.id) return { ...row, students: [...(row.students ?? []), { ...promotingStudent, class_id: targetClass.id, level: promotingStudent.next_level, promotion_candidate: false, next_level: null }] };
      return row;
    }));
    const destinationLabel = promotionDestination === "class" ? targetClass?.name ?? "next class" : promotionDestination === "waiting" ? "waiting list" : `freeze (${freezeMonths} month)`;
    void recordAudit("updated", "student", promotingStudent.id, { action: promotionDestination === "class" ? "promoted" : "transferred", from_class: promotingStudent.fromClassName, destination: destinationLabel, from_level: promotingStudent.level, to_level: promotingStudent.next_level });
    setPromotionMessage(`${promotingStudent.full_name} moved to ${destinationLabel}.`);
    setPromotingStudent(null);
    setPromotionClassId("");
    setPromotionDestination("class");
  }

  function printRoster(row: ClassRow & { teacher: string }) {
    const students = row.students ?? [];
    const rosterRows = students.map((student, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${student.full_name}</td>
        <td>${student.phone ?? ""}</td>
        <td>${student.email ?? ""}</td>
        <td>${student.level ?? ""}</td>
        <td>${student.learning_mode ?? ""}</td>
        <td>${student.status ?? ""}</td>
      </tr>
    `).join("");
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>${row.name} roster</title>
          <style>
            body { font-family: Inter, Arial, sans-serif; color: #0b0b0b; padding: 24px; }
            h1 { margin: 0 0 8px; font-size: 24px; }
            p { margin: 4px 0; }
            table { border-collapse: collapse; width: 100%; margin-top: 20px; font-size: 13px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #f7f4ef; }
            .meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 24px; margin-top: 12px; }
          </style>
        </head>
        <body>
          <h1>${row.name}</h1>
          <div class="meta">
            <p><strong>Level:</strong> ${row.level ?? ""}</p>
            <p><strong>Teacher:</strong> ${row.teacher}</p>
            <p><strong>Mode:</strong> ${row.learning_mode ?? ""}</p>
            <p><strong>Schedule:</strong> ${row.schedule ?? ""}</p>
            <p><strong>Capacity:</strong> ${row.capacity}</p>
            <p><strong>Students:</strong> ${students.length}</p>
          </div>
          <table>
            <thead><tr><th>#</th><th>Name</th><th>Phone</th><th>Email</th><th>Level</th><th>Mode</th><th>Status</th></tr></thead>
            <tbody>${rosterRows || `<tr><td colspan="7">No students in this class yet.</td></tr>`}</tbody>
          </table>
          <script>window.print();</script>
        </body>
      </html>
    `);
    win.document.close();
  }

  function printFilteredClasses() {
    const rows = filteredRows.map((row) => `<tr><td>${row.name}</td><td>${row.level ?? ""}</td><td>${row.current_chapter ?? ""}</td><td>${row.teacher}</td><td>${row.learning_mode ?? ""}</td><td>${row.schedule ?? ""}</td><td>${groupStatus(row).label}</td><td>${row.sessions_done ?? 0}/${row.total_sessions ?? 0}</td></tr>`).join("");
    const win = window.open("", "_blank", "width=1100,height=800");
    if (!win) return;
    win.document.write(`<html><head><title>Filtered classes</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}h1{font-size:22px}table{border-collapse:collapse;width:100%;margin-top:18px}th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#1B4332;color:white}</style></head><body><h1>Filtered classes (${filteredRows.length})</h1><table><thead><tr><th>Name</th><th>Level</th><th>Chapter</th><th>Teacher</th><th>Mode</th><th>Schedule</th><th>Status</th><th>Sessions</th></tr></thead><tbody>${rows || `<tr><td colspan="8">No classes match the selected filters.</td></tr>`}</tbody></table><script>window.print();</script></body></html>`);
    win.document.close();
  }

  return (
    <div className="space-y-6">
      <ClassExcelTools rows={(selectedRows.length ? selectedRows : classes) as unknown as Record<string, unknown>[]} teachers={teachers} selectedCount={selectedRows.length} />
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle>{title}</CardTitle>
          {editing && (
            <Button type="button" variant="outline" size="sm" onClick={reset}>
              <X size={16} /> Cancel
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-3 md:grid-cols-4">
            <label className="grid gap-1 text-sm"><span className="font-medium">Class name</span><Input required value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label className="grid gap-1 text-sm"><span className="font-medium">Teacher</span><Select required value={teacherId} onChange={(event) => setTeacherId(event.target.value)}>
              {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
            </Select></label>
            <label className="grid gap-1 text-sm"><span className="font-medium">Level</span><Input value={level} onChange={(event) => setLevel(event.target.value)} /></label>
            <label className="grid gap-1 text-sm"><span className="font-medium">Current chapter / lesson</span><Input value={currentChapter} onChange={(event) => setCurrentChapter(event.target.value)} /></label>
            <label className="grid gap-1 text-sm"><span className="font-medium">Online / Offline</span><Select value={learningMode} onChange={(event) => setLearningMode(event.target.value)}>
              <option value="offline">Offline</option>
              <option value="online">Online</option>
            </Select></label>
            <div className="grid gap-2 md:col-span-4">
              <p className="text-sm font-medium">Weekly schedule</p>
              <div className="grid grid-cols-2 gap-1.5 md:grid-cols-7">
                {weekDays.map((day) => (
                  <Button key={day} className="h-9 px-2 text-xs" type="button" variant={scheduleSlots[day] !== undefined ? "default" : "outline"} onClick={() => toggleDay(day)}>
                    {day.slice(0, 3)}
                  </Button>
                ))}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {weekDays.filter((day) => scheduleSlots[day] !== undefined).map((day) => (
                  <label key={day} className="grid grid-cols-[1fr_1fr] items-center gap-2 text-sm">
                    <span>{day}</span>
                    <Input required type="time" value={scheduleSlots[day]} onChange={(event) => setScheduleTime(day, event.target.value)} />
                  </label>
                ))}
              </div>
            </div>
            <label className="grid gap-1 text-sm"><span className="font-medium">Capacity</span><Input required type="number" min="1" value={capacity} onChange={(event) => setCapacity(event.target.value)} /></label>
            <label className="grid gap-1 text-sm"><span className="font-medium">Total sessions</span><Input required type="number" min="0" value={totalSessions} onChange={(event) => setTotalSessions(event.target.value)} /></label>
            <label className="grid gap-1 text-sm"><span className="font-medium">Sessions completed</span><Input required type="number" min="0" max={totalSessions} value={sessionsDone} onChange={(event) => setSessionsDone(event.target.value)} /></label>
            <label className="grid gap-1 text-sm"><span className="font-medium">Group status</span><Select value={classStatus} onChange={(event) => setClassStatus(event.target.value)}>
              <option value="not_started">Not started</option>
              <option value="started">Started</option>
              <option value="finished">Finished</option>
            </Select></label>
            <Button type="submit" className="md:col-span-4" disabled={!canSubmit}>
              {editing ? <Edit2 size={16} /> : <Plus size={16} />}
              {buttonLabel}
            </Button>
            {saved && <p className="text-sm text-muted-foreground md:col-span-4">{saved}</p>}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Created Classes</CardTitle></CardHeader>
        <CardContent className="max-h-[70vh] overflow-auto rounded-lg p-0">
          <div className="mb-4 grid gap-2 p-4 pb-0 sm:grid-cols-2 lg:grid-cols-4">
            <Select value={teacherFilter} onChange={(event) => setTeacherFilter(event.target.value)}><option value="all">All teachers</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</Select>
            <Select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)}><option value="all">All levels</option>{Array.from(new Set(tableRows.map((row) => row.level).filter(Boolean))).map((item) => <option key={item} value={item ?? ""}>{item}</option>)}</Select>
            <Select value={modeFilter} onChange={(event) => setModeFilter(event.target.value)}><option value="all">Online / offline</option><option value="online">Online</option><option value="offline">Offline</option></Select>
            <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="not_started">Not started</option><option value="started">Started</option><option value="finished">Finished</option></Select>
            <Button type="button" variant="outline" onClick={printFilteredClasses}><Printer size={16} /> Print filtered ({filteredRows.length})</Button>
          </div>
          <table className="w-full min-w-[1280px] text-sm">
            <thead className="sticky top-0 z-10 bg-muted">
              <tr>
                {["", "Name", "Level", "Chapter", "Online / Offline", "Teacher", "Schedule", "Stopped at", "Sessions", "Status", "Today", "Students", "Actions"].map((header, index) => (
                  <th key={header} className="px-4 py-3 text-left font-semibold">{index === 0 ? <input type="checkbox" aria-label="Select filtered classes" checked={filteredRows.length > 0 && filteredRows.every((row) => selectedClassIds.has(row.id))} onChange={toggleFilteredSelection} /> : header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const isOpen = openClassIds.includes(row.id);
                const students = row.students ?? [];
                const status = groupStatus(row);
                return (
                  <Fragment key={row.id}>
                    <tr key={row.id} className={`border-t ${status.className}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2"><input type="checkbox" aria-label={`Select ${row.name}`} checked={selectedClassIds.has(row.id)} onChange={() => toggleClassSelection(row.id)} /><Button type="button" size="icon" variant="ghost" onClick={() => toggleClass(row.id)} aria-label={`Open ${row.name}`}>
                          {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </Button></div>
                      </td>
                      <td className="px-4 py-3 font-semibold">{row.name}</td>
                      <td className="min-w-[120px] px-4 py-3">{row.level ?? ""}</td>
                      <td className="min-w-[160px] px-4 py-3">{row.current_chapter ?? ""}</td>
                      <td className="px-4 py-3">{row.learning_mode}</td>
                      <td className="px-4 py-3">{row.teacher}</td>
                      <td className="px-4 py-3">{row.schedule}</td>
                      <td className="px-4 py-3">{row.sessions_done ?? 0}</td>
                      <td className="px-4 py-3">{row.total_sessions ?? 0}</td>
                      <td className="px-4 py-3 font-semibold">{status.label}</td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <span className={row.session_qualified ? "font-semibold text-green-700" : "text-muted-foreground"}>{row.session_qualified ? "Completed" : `${row.student_scan_count ?? 0}/3 students${row.teacher_scanned ? " + teacher" : " + teacher pending"}`}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">{students.length}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => startEdit(row)}><Edit2 size={16} /> Edit</Button>
                          <Button size="sm" variant="outline" onClick={() => printRoster(row)}><Printer size={16} /> Print List</Button>
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={`${row.id}-students`} className="border-t bg-white">
                        <td colSpan={13} className="p-4">
                          <div className="rounded-md border">
                            <table className="w-full text-sm">
                              <thead className="bg-muted">
                                <tr>
                                  {["Name", "Phone", "Email", "Level", "Mode", "Status", "Actions"].map((header) => (
                                    <th key={header} className="px-3 py-2 text-left font-semibold">{header}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {students.map((student) => (
                                  <tr key={student.id} className="border-t">
                                    <td className="px-3 py-2 font-medium">{student.full_name}</td>
                                    <td className="px-3 py-2">{student.phone}</td>
                                    <td className="px-3 py-2">{student.email}</td>
                                    <td className="px-3 py-2">{student.level}</td>
                                    <td className="px-3 py-2">{student.learning_mode}</td>
                                    <td className="px-3 py-2">{student.status}</td>
                                    <td className="px-3 py-2">
                                      <Button type="button" size="sm" variant="outline" onClick={() => { setPromotingStudent({ ...student, fromClassId: row.id, fromClassName: row.name }); setPromotionDestination("class"); setPromotionClassId(""); setFreezeMonths("1"); setPromotionMessage(""); }}>Promote / transfer</Button>
                                    </td>
                                  </tr>
                                ))}
                                {!students.length && <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">No students in this class yet.</td></tr>}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
      {promotionMessage && <p className="text-sm text-muted-foreground">{promotionMessage}</p>}
      {promotingStudent && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 p-4" role="dialog" aria-modal="true" aria-labelledby="class-promote-title">
          <div className="w-full max-w-md rounded-lg border border-accent bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4 border-b pb-3">
              <div>
                <h2 id="class-promote-title" className="text-lg font-semibold">Promote student</h2>
                <p className="text-sm text-muted-foreground">{promotingStudent.full_name} · {promotingStudent.level} → {promotingStudent.next_level}</p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => setPromotingStudent(null)}><X size={16} /> Cancel</Button>
            </div>
            <label className="mb-3 grid gap-1 text-sm font-medium">
              Destination
              <Select value={promotionDestination} onChange={(event) => { setPromotionDestination(event.target.value as "class" | "waiting" | "freeze"); setPromotionClassId(""); }}>
                <option value="class">Next-level class</option>
                <option value="waiting">Waiting list</option>
                <option value="freeze">Freeze student</option>
              </Select>
            </label>
            {promotionDestination === "class" && <label className="grid gap-1 text-sm font-medium">
              Choose an existing next-level class
              <Select value={promotionClassId} onChange={(event) => setPromotionClassId(event.target.value)}>
                <option value="">Choose class...</option>
                {promotionClasses.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.level}</option>)}
              </Select>
            </label>}
            {promotionDestination === "freeze" && <label className="grid gap-1 text-sm font-medium">
              Freeze duration
              <Select value={freezeMonths} onChange={(event) => setFreezeMonths(event.target.value)}><option value="1">1 month</option><option value="2">2 months</option><option value="3">3 months</option></Select>
            </label>}
            {promotionDestination === "class" && !promotionClasses.length && <p className="mt-3 text-sm text-muted-foreground">Create a class for the next level first, or choose Waiting list / Freeze student.</p>}
            <Button type="button" className="mt-4 w-full" onClick={() => void promoteStudent()} disabled={promotionDestination === "class" ? !promotionClassId || !promotionClasses.length : false}>Confirm</Button>
          </div>
        </div>
      )}
    </div>
  );
}
