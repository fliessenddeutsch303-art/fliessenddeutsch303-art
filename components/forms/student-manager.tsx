"use client";

import { useEffect, useState } from "react";
import { Edit2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StudentExcelTools } from "@/components/forms/student-excel-tools";
import { StudentsTable } from "@/components/tables/students-table";
import type { StudentBook, TextbookOption } from "@/components/forms/student-books-dialog";
import type { StudentPayment } from "@/lib/student-payments";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { recordAudit } from "@/lib/audit";
import { academyDate } from "@/lib/dates";
import { addMonthsClamped } from "@/lib/level-progression";

type ClassOption = { id: string; name: string; level?: string | null };
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
  classes?: { id?: string; name?: string; level?: string | null; teachers?: { name?: string } | null } | null;
  books?: StudentBook[];
  payments?: StudentPayment[];
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
  paid_on: "",
};

export function StudentManager({ initialStudents, classes, canViewProfile = true, textbooks = [] }: { initialStudents: StudentRow[]; classes: ClassOption[]; canViewProfile?: boolean; textbooks?: TextbookOption[] }) {
  const [students, setStudents] = useState(initialStudents);
  const [editing, setEditing] = useState<StudentRow | null>(null);
  const [form, setForm] = useState(blank);
  const [saved, setSaved] = useState("");
  const [invalidFields, setInvalidFields] = useState<string[]>([]);

  // pick up new rows after router.refresh()
  useEffect(() => setStudents(initialStudents), [initialStudents]);

  // returns null if the user cancels on a full class
  async function loadClass(classId: string, studentId?: string) {
    const option = classes.find((klass) => klass.id === classId);
    const { data } = await createSupabaseBrowserClient().from("classes").select("name,level,capacity,teachers(name)").eq("id", classId).maybeSingle();
    const info = data as { name?: string; level?: string | null; capacity?: number | null; teachers?: { name?: string } | { name?: string }[] | null } | null;
    const today = academyDate();
    const count = students.filter((row) => row.id !== studentId && row.class_id === classId && row.status === "active" && !(row.freeze_start_date && row.freeze_end_date && row.freeze_start_date <= today && row.freeze_end_date >= today)).length;
    const capacity = Number(info?.capacity ?? 0);
    const name = info?.name ?? option?.name ?? "this class";
    if (capacity > 0 && count >= capacity && !window.confirm(`${name} is full (${count} / ${capacity} active students). Add this student anyway?`)) return null;
    const teachers = Array.isArray(info?.teachers) ? info?.teachers[0] : info?.teachers;
    return { id: classId, name, level: info?.level ?? option?.level ?? null, teachers: teachers ?? null };
  }

  async function promoteStudent(row: Record<string, unknown>, classId: string) {
    const student = row as unknown as StudentRow;
    const targetClass = classes.find((klass) => klass.id === classId);
    if (!targetClass) return { ok: false, message: "Choose a class first." };
    const loaded = await loadClass(targetClass.id, student.id);
    if (!loaded) return { ok: false, message: "Cancelled." };
    const payload = { class_id: targetClass.id, level: student.next_level || student.level, level_completed_stopped: false };
    const { error } = await createSupabaseBrowserClient().from("students").update(payload).eq("id", student.id);
    if (error) return { ok: false, message: error.message };
    setStudents((rows) => rows.map((row) => row.id === student.id ? {
      ...row,
      ...payload,
      promotion_candidate: false,
      next_level: null,
      classes: loaded,
    } : row));
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
    setInvalidFields([]);
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
      paid_on: academyDate(),
    });
    setSaved("");
    setInvalidFields([]);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const missing: string[] = [];
    if (!form.full_name.trim()) missing.push("Full name");
    if (!form.phone.trim()) missing.push("Phone");
    if (missing.length) {
      setInvalidFields(missing);
      setSaved(`Please complete: ${missing.join(", ")}.`);
      return;
    }
    setInvalidFields([]);
    const freezeMonths = Math.min(3, Math.max(0, Number(form.freeze_months || 0)));
    if (freezeMonths > 0 && !form.freeze_start_date) {
      setInvalidFields(["Freeze started"]);
      setSaved("Enter the freeze start date, or set the duration to No freeze.");
      return;
    }
    const freezeStart = freezeMonths > 0 ? form.freeze_start_date : null;
    const freezeEnd = freezeStart ? addMonthsClamped(freezeStart, freezeMonths) : null;
    const digits = (value: string) => value.replace(/\D/g, "");
    const duplicate = digits(form.phone) ? students.find((row) => row.id !== editing?.id && digits(row.phone ?? "") === digits(form.phone)) : undefined;
    if (duplicate && !window.confirm(`${duplicate.full_name} already has this phone number. Save anyway?`)) return;
    const classChanged = Boolean(form.class_id) && form.class_id !== (editing?.class_id ?? "");
    const loadedClass = classChanged ? await loadClass(form.class_id, editing?.id) : null;
    if (classChanged && !loadedClass) return;
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
      freeze_start_date: freezeStart,
      freeze_months: freezeMonths,
      freeze_end_date: freezeEnd,
      level_completed_stopped: form.level_completed_stopped === "true",
    };
    // a higher amount_paid is a new payment, record it with its date
    const paidIncrease = Math.round((payload.amount_paid - Number(editing?.amount_paid ?? 0)) * 100) / 100;
    const paidOn = form.paid_on || academyDate();
    if (paidIncrease > 0 && paidOn > academyDate()) {
      setSaved("The payment date cannot be in the future.");
      return;
    }
    const supabase = createSupabaseBrowserClient();
    const recordPayment = async (studentId: string) => {
      if (paidIncrease <= 0) return { payment: null as StudentPayment | null, warning: "" };
      const { data, error } = await supabase.from("student_account_records").insert({
        student_id: studentId,
        class_id: payload.class_id,
        amount: paidIncrease,
        status: "paid",
        paid_at: `${paidOn}T12:00:00Z`,
        notes: "Recorded from the student form",
        receipt_no: `FD-${Date.now()}`,
      }).select("id,amount,paid_at,receipt_no").single();
      if (error || !data) return { payment: null, warning: ` The paid total was saved, but the payment date was not recorded: ${error?.message ?? "unknown error"}` };
      return { payment: { id: data.id, amount: Number(data.amount), paid_at: paidOn, receipt_no: data.receipt_no ?? null }, warning: "" };
    };
    if (editing) {
      const { error } = await supabase.from("students").update(payload).eq("id", editing.id);
      if (error) {
        setSaved(error.message);
        return;
      }
      const { payment, warning } = await recordPayment(editing.id);
      setStudents((rows) => rows.map((row) => row.id === editing.id ? { ...row, ...payload, payments: payment ? [payment, ...(row.payments ?? [])] : row.payments, classes: !payload.class_id ? null : loadedClass ?? (payload.class_id === row.class_id ? row.classes : classes.find((klass) => klass.id === payload.class_id)) ?? null } : row));
      void recordAudit("updated", "student", editing.id, { fields: Object.keys(payload), full_name: payload.full_name });
      setEditing((current) => current ? { ...current, amount_paid: payload.amount_paid } : current);
      setSaved(`Student updated${payment ? ` · payment of ${paidIncrease} recorded on ${paidOn}` : ""}.${warning}`);
      return;
    }

    const { data, error } = await supabase.from("students").insert({ ...payload, enrolled_at: new Date().toISOString() }).select("id").single();
    if (error) {
      setSaved(error.message);
      return;
    }
    const { payment, warning } = await recordPayment(data.id);
    setStudents((rows) => [{ id: data.id, ...payload, payments: payment ? [payment] : [], enrolled_at: new Date().toISOString(), classes: loadedClass ?? classes.find((klass) => klass.id === payload.class_id) ?? null }, ...rows]);
    void recordAudit("created", "student", data.id, { fields: Object.keys(payload), full_name: payload.full_name });
    reset();
    setSaved(`Student saved${payment ? ` · payment of ${paidIncrease} recorded on ${paidOn}` : ""}.${warning}`);
  }

  const requiredClass = (field: string) => invalidFields.includes(field) ? "border-red-500 ring-1 ring-red-500" : "";
  const requiredLabel = (text: string) => <>{text}<span className="ml-1 text-red-600" aria-hidden="true">*</span></>;

  return (
    <div className="space-y-6">
      <StudentExcelTools rows={students as unknown as Record<string, unknown>[]} classes={classes} />
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle>{editing ? "Edit Student" : "Add Student"}</CardTitle>
          {editing && <Button type="button" variant="outline" size="sm" onClick={reset}><X size={16} /> Cancel</Button>}
        </CardHeader>
        <CardContent>
          <form noValidate onSubmit={submit} className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-1 text-sm"><span className="font-medium">{requiredLabel("Full name")}</span><Input aria-required="true" className={requiredClass("Full name")} value={form.full_name} onChange={(event) => { setField("full_name", event.target.value); setInvalidFields((fields) => fields.filter((field) => field !== "Full name")); }} /></label>
            <label className="grid gap-1 text-sm"><span className="font-medium">{requiredLabel("Phone")}</span><Input aria-required="true" className={requiredClass("Phone")} value={form.phone} onChange={(event) => { setField("phone", event.target.value); setInvalidFields((fields) => fields.filter((field) => field !== "Phone")); }} /></label>
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
            {Number(form.amount_paid || 0) > Number(editing?.amount_paid ?? 0) && <label className="grid gap-1 text-sm"><span className="font-medium">Paid on</span><Input type="date" max={academyDate()} value={form.paid_on || academyDate()} onChange={(event) => setField("paid_on", event.target.value)} /><span className="text-xs text-muted-foreground">The new amount ({Math.round((Number(form.amount_paid || 0) - Number(editing?.amount_paid ?? 0)) * 100) / 100}) is recorded as a payment on this date.</span></label>}
            <label className="grid gap-1 text-sm"><span className="font-medium">Payment date arranged</span><Input type="date" value={form.payment_due_date} onChange={(event) => setField("payment_due_date", event.target.value)} /></label>
            <label className="grid gap-1 text-sm"><span className="font-medium">Freeze started</span><Input type="date" className={requiredClass("Freeze started")} value={form.freeze_start_date} onChange={(event) => setField("freeze_start_date", event.target.value)} /></label>
            <label className="grid gap-1 text-sm"><span className="font-medium">Freeze duration</span><Select value={form.freeze_months} onChange={(event) => setField("freeze_months", event.target.value)}><option value="0">No freeze</option><option value="1">1 month</option><option value="2">2 months</option><option value="3">3 months maximum</option></Select></label>
            <label className="grid gap-1 text-sm"><span className="font-medium">Student progress</span><Select value={form.level_completed_stopped} onChange={(event) => setField("level_completed_stopped", event.target.value)}><option value="false">Continuing</option><option value="true">Finished level - stopped</option></Select></label>
            <label className="grid gap-1 text-sm md:col-span-3"><span className="font-medium">Payment comment</span><Textarea value={form.payment_comment} onChange={(event) => setField("payment_comment", event.target.value)} /></label>
            <Button className="md:col-span-3">{editing ? <Edit2 size={16} /> : <Plus size={16} />}{editing ? "Update Student" : "Save Student"}</Button>
            {saved && <p role="alert" className={`text-sm md:col-span-3 ${invalidFields.length ? "text-red-600" : "text-muted-foreground"}`}>{saved}</p>}
          </form>
        </CardContent>
      </Card>
      <StudentsTable rows={students as unknown as Record<string, unknown>[]} classes={classes} onEdit={(row) => startEdit(row as unknown as StudentRow)} onPromote={promoteStudent} canViewProfile={canViewProfile} textbooks={textbooks} onBooksChange={(studentId, books) => setStudents((rows) => rows.map((row) => row.id === studentId ? { ...row, books } : row))} />
    </div>
  );
}
