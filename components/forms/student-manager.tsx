"use client";

import { useState } from "react";
import { Edit2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StudentExcelTools } from "@/components/forms/student-excel-tools";
import { StudentsTable } from "@/components/tables/students-table";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { recordAudit } from "@/lib/audit";

type ClassOption = { id: string; name: string };
type StudentRow = {
  id: string;
  full_name: string;
  phone: string;
  email?: string | null;
  level?: string | null;
  tags?: string[] | null;
  class_id?: string | null;
  learning_mode?: "online" | "offline" | string | null;
  status: string;
  total_price?: number | null;
  amount_paid?: number | null;
  payment_due_date?: string | null;
  payment_comment?: string | null;
  freeze_start_date?: string | null;
  freeze_months?: number | null;
  freeze_end_date?: string | null;
  level_completed_stopped?: boolean | null;
  promotion_candidate?: boolean;
  next_level?: string | null;
  enrolled_at?: string | null;
  created_at?: string | null;
  classes?: { name?: string; teachers?: { name?: string } | null } | null;
};

const blank = {
  full_name: "",
  phone: "",
  email: "",
  level: "",
  tags: "",
  class_id: "",
  learning_mode: "offline",
  status: "active",
  total_price: "0",
  amount_paid: "0",
  payment_due_date: "",
  payment_comment: "",
  freeze_start_date: "",
  freeze_months: "0",
  freeze_end_date: "",
  level_completed_stopped: "false",
};

export function StudentManager({ initialStudents, classes }: { initialStudents: StudentRow[]; classes: ClassOption[] }) {
  const [students, setStudents] = useState(initialStudents);
  const [editing, setEditing] = useState<StudentRow | null>(null);
  const [form, setForm] = useState(blank);
  const [saved, setSaved] = useState("");

  async function promoteStudent(row: Record<string, unknown>, classId: string) {
    const student = row as unknown as StudentRow;
    const targetClass = classes.find((klass) => klass.id === classId);
    if (!targetClass) return { ok: false, message: "Choose a class first." };
    const payload = { class_id: targetClass.id, level: student.next_level || student.level, level_completed_stopped: false };
    const { error } = await createSupabaseBrowserClient().from("students").update(payload).eq("id", student.id);
    if (error) return { ok: false, message: error.message };
    setStudents((rows) => rows.map((row) => row.id === student.id ? { ...row, ...payload, classes: { name: targetClass.name } } : row));
    void recordAudit("updated", "student", student.id, { action: "promoted", from_class: student.classes?.name ?? null, to_class: targetClass.name, from_level: student.level ?? null, to_level: payload.level });
    return { ok: true, message: `${student.full_name} moved to ${targetClass.name}.` };
  }

  function setField(key: keyof typeof blank, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function reset() {
    setEditing(null);
    setForm(blank);
    setSaved("");
  }

  function startEdit(student: StudentRow) {
    setEditing(student);
    setForm({
      full_name: student.full_name ?? "",
      phone: student.phone ?? "",
      email: student.email ?? "",
      level: student.level ?? "",
      tags: (student.tags ?? []).join(", "),
      class_id: student.class_id ?? "",
      learning_mode: student.learning_mode === "online" ? "online" : "offline",
      status: student.status ?? "active",
      total_price: String(student.total_price ?? 0),
      amount_paid: String(student.amount_paid ?? 0),
      payment_due_date: student.payment_due_date ?? "",
      payment_comment: student.payment_comment ?? "",
      freeze_start_date: student.freeze_start_date ?? "",
      freeze_months: String(student.freeze_months ?? 0),
      freeze_end_date: student.freeze_end_date ?? "",
      level_completed_stopped: String(Boolean(student.level_completed_stopped)),
    });
    setSaved("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    let freezeEnd = form.freeze_end_date || null;
    if (form.freeze_start_date && Number(form.freeze_months) > 0) {
      const end = new Date(`${form.freeze_start_date}T12:00:00`);
      end.setMonth(end.getMonth() + Math.min(3, Number(form.freeze_months)));
      freezeEnd = end.toISOString().slice(0, 10);
    }
    const payload = {
      full_name: form.full_name,
      phone: form.phone,
      email: form.email,
      level: form.level,
      tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      class_id: form.class_id || null,
      learning_mode: form.learning_mode,
      status: form.status,
      total_price: Number(form.total_price || 0),
      amount_paid: Number(form.amount_paid || 0),
      payment_due_date: form.payment_due_date || null,
      payment_comment: form.payment_comment,
      freeze_start_date: form.freeze_start_date || null,
      freeze_months: Math.min(3, Math.max(0, Number(form.freeze_months || 0))),
      freeze_end_date: freezeEnd,
      level_completed_stopped: form.level_completed_stopped === "true",
    };
    const supabase = createSupabaseBrowserClient();
    if (editing) {
      const { error } = await supabase.from("students").update(payload).eq("id", editing.id);
      if (error) {
        setSaved(error.message);
        return;
      }
      setStudents((rows) => rows.map((row) => row.id === editing.id ? { ...row, ...payload, classes: classes.find((klass) => klass.id === payload.class_id) ?? null } : row));
      void recordAudit("updated", "student", editing.id, { fields: Object.keys(payload), full_name: payload.full_name });
      setSaved("Student updated");
      return;
    }

    const { data, error } = await supabase.from("students").insert({ ...payload, enrolled_at: new Date().toISOString() }).select("id").single();
    if (error) {
      setSaved(error.message);
      return;
    }
    setStudents((rows) => [{ id: data.id, ...payload, enrolled_at: new Date().toISOString(), classes: classes.find((klass) => klass.id === payload.class_id) ?? null }, ...rows]);
    void recordAudit("created", "student", data.id, { fields: Object.keys(payload), full_name: payload.full_name });
    setSaved("Student saved");
    reset();
  }

  return (
    <div className="space-y-6">
      <StudentExcelTools rows={students as unknown as Record<string, unknown>[]} classes={classes} />
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle>{editing ? "Edit Student" : "Add Student"}</CardTitle>
          {editing && <Button type="button" variant="outline" size="sm" onClick={reset}><X size={16} /> Cancel</Button>}
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-1 text-sm"><span className="font-medium">Full name</span><Input required value={form.full_name} onChange={(event) => setField("full_name", event.target.value)} /></label>
            <label className="grid gap-1 text-sm"><span className="font-medium">Phone</span><Input required value={form.phone} onChange={(event) => setField("phone", event.target.value)} /></label>
            <label className="grid gap-1 text-sm"><span className="font-medium">Email</span><Input type="email" value={form.email} onChange={(event) => setField("email", event.target.value)} /></label>
            <label className="grid gap-1 text-sm"><span className="font-medium">Level</span><Input value={form.level} onChange={(event) => setField("level", event.target.value)} /></label>
            <label className="grid gap-1 text-sm"><span className="font-medium">Tags</span><Input value={form.tags} onChange={(event) => setField("tags", event.target.value)} /></label>
            <label className="grid gap-1 text-sm"><span className="font-medium">Class</span><Select value={form.class_id} onChange={(event) => setField("class_id", event.target.value)}>
              <option value="">No class</option>
              {classes.map((klass) => <option key={klass.id} value={klass.id}>{klass.name}</option>)}
            </Select></label>
            <label className="grid gap-1 text-sm"><span className="font-medium">Online / Offline</span><Select value={form.learning_mode} onChange={(event) => setField("learning_mode", event.target.value)}>
              <option value="offline">Offline</option>
              <option value="online">Online</option>
            </Select></label>
            <label className="grid gap-1 text-sm"><span className="font-medium">Status</span><Select value={form.status} onChange={(event) => setField("status", event.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="graduated">Graduated</option>
            </Select></label>
            <label className="grid gap-1 text-sm"><span className="font-medium">Total price</span><Input type="number" min="0" step="0.01" value={form.total_price} onChange={(event) => setField("total_price", event.target.value)} /></label>
            <label className="grid gap-1 text-sm"><span className="font-medium">Amount paid</span><Input type="number" min="0" step="0.01" value={form.amount_paid} onChange={(event) => setField("amount_paid", event.target.value)} /></label>
            <label className="grid gap-1 text-sm"><span className="font-medium">Payment date arranged</span><Input type="date" value={form.payment_due_date} onChange={(event) => setField("payment_due_date", event.target.value)} /></label>
            <label className="grid gap-1 text-sm"><span className="font-medium">Freeze started</span><Input type="date" value={form.freeze_start_date} onChange={(event) => setField("freeze_start_date", event.target.value)} /></label>
            <label className="grid gap-1 text-sm"><span className="font-medium">Freeze duration</span><Select value={form.freeze_months} onChange={(event) => setField("freeze_months", event.target.value)}><option value="0">No freeze</option><option value="1">1 month</option><option value="2">2 months</option><option value="3">3 months maximum</option></Select></label>
            <label className="grid gap-1 text-sm"><span className="font-medium">Student progress</span><Select value={form.level_completed_stopped} onChange={(event) => setField("level_completed_stopped", event.target.value)}><option value="false">Continuing</option><option value="true">Finished level - stopped</option></Select></label>
            <label className="grid gap-1 text-sm md:col-span-3"><span className="font-medium">Payment comment</span><Textarea value={form.payment_comment} onChange={(event) => setField("payment_comment", event.target.value)} /></label>
            <Button className="md:col-span-3">{editing ? <Edit2 size={16} /> : <Plus size={16} />}{editing ? "Update Student" : "Save Student"}</Button>
            {saved && <p className="text-sm text-muted-foreground md:col-span-3">{saved}</p>}
          </form>
        </CardContent>
      </Card>
      <StudentsTable rows={students as unknown as Record<string, unknown>[]} classes={classes} onEdit={(row) => startEdit(row as unknown as StudentRow)} onPromote={promoteStudent} />
    </div>
  );
}
