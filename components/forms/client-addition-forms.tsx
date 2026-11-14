"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Lang } from "@/lib/i18n";
import { academyDate } from "@/lib/dates";

type Option = { id: string; name?: string; full_name?: string };
type ProfileOption = { id: string; full_name: string; role?: string; account_user_id: string };

function label(option: Option) {
  return option.name ?? option.full_name ?? option.id;
}

export function BranchForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [saved, setSaved] = useState("");
  async function submit(form: FormData) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("branches").insert({
      name: form.get("name"),
      address: form.get("address"),
      phone: form.get("phone"),
      is_active: true,
    });
    setSaved(error?.message ?? "Branch saved");
    if (!error) {
      formRef.current?.reset();
      router.refresh();
    }
  }
  return (
    <Card>
      <CardHeader><CardTitle>Add Branch</CardTitle></CardHeader>
      <CardContent>
        <form ref={formRef} action={submit} className="grid gap-3 md:grid-cols-4">
          <Input name="name" required placeholder="Branch name" />
          <Input name="address" placeholder="Address" />
          <Input name="phone" placeholder="Phone" />
          <Button><Plus size={16} /> Save Branch</Button>
          {saved && <p className="text-sm text-muted-foreground md:col-span-4">{saved}</p>}
        </form>
      </CardContent>
    </Card>
  );
}

export function AccountRecordForm({ students, classes, teachers, users, defaultStudentId, defaultClassId, defaultTeacherId }: { students: Option[]; classes: Option[]; teachers: Option[]; users: Option[]; defaultStudentId?: string; defaultClassId?: string | null; defaultTeacherId?: string | null }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState(false);
  async function submit(form: FormData) {
    const supabase = createSupabaseBrowserClient();
    const status = String(form.get("status"));
    const amount = Number(form.get("amount") || 0);
    const studentId = String(form.get("student_id") ?? "");
    if (!studentId || amount <= 0) {
      setError(true);
      setSaved("Choose a student and enter an amount above 0.");
      return;
    }
    const { error: insertError } = await supabase.from("student_account_records").insert({
      student_id: studentId,
      class_id: form.get("class_id") || null,
      teacher_id: form.get("teacher_id") || null,
      received_by: form.get("received_by") || null,
      amount,
      due_date: form.get("due_date") || null,
      paid_at: status === "paid" ? new Date().toISOString() : null,
      status,
      notes: form.get("notes"),
      receipt_no: form.get("receipt_no") || `FD-${Date.now()}`,
    });
    if (insertError) {
      setError(true);
      setSaved(insertError.message);
      return;
    }
    // Keep the student's running "amount paid" in step with recorded payments.
    if (status === "paid" && form.get("add_to_paid") === "on") {
      const { data: student, error: readError } = await supabase.from("students").select("amount_paid").eq("id", studentId).single();
      const { error: updateError } = readError ? { error: readError } : await supabase.from("students").update({ amount_paid: Number(student?.amount_paid ?? 0) + amount }).eq("id", studentId);
      if (updateError) {
        setError(true);
        setSaved(`The payment was recorded, but the student's paid total was not updated: ${updateError.message}`);
        formRef.current?.reset();
        router.refresh();
        return;
      }
    }
    setError(false);
    setSaved("Payment record saved");
    formRef.current?.reset();
    router.refresh();
  }
  return (
    <Card>
      <CardHeader><CardTitle>Student payment / account entry</CardTitle></CardHeader>
      <CardContent>
        <form ref={formRef} action={submit} className="grid gap-3 md:grid-cols-4">
          <Select name="student_id" required defaultValue={defaultStudentId ?? ""} aria-label="Student"><option value="">Student...</option>{students.map((item) => <option key={item.id} value={item.id}>{label(item)}</option>)}</Select>
          <Input name="amount" required type="number" min="0.01" step="0.01" placeholder="Amount" />
          <Select name="received_by" aria-label="Received by"><option value="">Received by...</option>{users.map((item) => <option key={item.id} value={item.id}>{label(item)}</option>)}</Select>
          <Select name="teacher_id" defaultValue={defaultTeacherId ?? ""} aria-label="Lecturer"><option value="">Lecturer...</option>{teachers.map((item) => <option key={item.id} value={item.id}>{label(item)}</option>)}</Select>
          <Select name="class_id" defaultValue={defaultClassId ?? ""} aria-label="Course / class"><option value="">Course / class...</option>{classes.map((item) => <option key={item.id} value={item.id}>{label(item)}</option>)}</Select>
          <label className="grid gap-1 text-xs text-muted-foreground">Due / payment date<Input name="due_date" type="date" /></label>
          <Select name="status" defaultValue="paid" aria-label="Status"><option value="paid">Paid</option><option value="scheduled">Scheduled</option><option value="due">Due</option><option value="overdue">Overdue</option></Select>
          <Input name="receipt_no" placeholder="Receipt no. (optional)" />
          <label className="flex items-center gap-2 text-sm md:col-span-4"><input type="checkbox" name="add_to_paid" defaultChecked /> When paid, add this amount to the student&apos;s &quot;amount paid&quot;</label>
          <Textarea name="notes" className="md:col-span-4" placeholder="Notes: who received, when they will pay, agreement details..." />
          <Button className="md:col-span-4"><Plus size={16} /> Save payment record</Button>
          {saved && <p role="status" className={`text-sm md:col-span-4 ${error ? "text-red-700" : "text-green-700"}`}>{saved}</p>}
        </form>
      </CardContent>
    </Card>
  );
}

export function ExamRecordForm({ students, classes = [] }: { students: Option[]; classes?: Option[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [saved, setSaved] = useState("");
  async function submit(form: FormData) {
    if (!form.get("student_id")) return setSaved("Select a student.");
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("exam_records").insert({
      student_id: form.get("student_id"),
      exam_type: form.get("exam_type"),
      scheduled_at: form.get("scheduled_at"),
      level_result: form.get("level_result"),
      score_percent: form.get("score_percent") ? Number(form.get("score_percent")) : null,
      result_comment: form.get("result_comment"),
      booking_status: form.get("booking_status") ?? "not_booked",
      booked_class_id: form.get("booked_class_id") || null,
    });
    setSaved(error?.message ?? "Exam record saved");
    if (!error) {
      formRef.current?.reset();
      router.refresh();
    }
  }
  return (
    <Card>
      <CardHeader><CardTitle>Exam / Placement Booking</CardTitle></CardHeader>
      <CardContent>
        <form ref={formRef} action={submit} className="grid gap-3 md:grid-cols-4">
          <Select name="student_id" required><option value="">Select student</option>{students.map((item) => <option key={item.id} value={item.id}>{label(item)}</option>)}</Select>
          <Select name="exam_type" defaultValue="placement"><option value="placement">Placement test</option><option value="osd">ÖSD exam</option><option value="internal">Internal exam</option></Select>
          <Input name="scheduled_at" type="datetime-local" required />
          <Input name="level_result" placeholder="Level result, e.g. A2" />
          <Input name="score_percent" type="number" min="0" max="100" step="0.01" placeholder="Score %" />
          <Select name="booking_status" defaultValue="not_booked"><option value="not_booked">Not booked</option><option value="booked">Booked</option></Select>
          <Select name="booked_class_id"><option value="">Booked group...</option>{classes.map((item) => <option key={item.id} value={item.id}>{label(item)}</option>)}</Select>
          <Textarea name="result_comment" className="md:col-span-3" placeholder="Result comment..." />
          <Button className="md:col-span-4"><Plus size={16} /> Save Exam</Button>
          {saved && <p className="text-sm text-muted-foreground md:col-span-4">{saved}</p>}
        </form>
      </CardContent>
    </Card>
  );
}

export function FeedbackRecordForm({ students, teachers }: { students: Option[]; teachers: Option[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [saved, setSaved] = useState("");
  async function submit(form: FormData) {
    if (!form.get("student_id")) return setSaved("Select a student.");
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("feedback_records").insert({
      student_id: form.get("student_id"),
      teacher_id: form.get("teacher_id") || null,
      source: form.get("source"),
      rating: form.get("rating") ? Number(form.get("rating")) : null,
      comment: form.get("comment"),
    });
    setSaved(error?.message ?? "Feedback saved");
    if (!error) {
      formRef.current?.reset();
      router.refresh();
    }
  }
  return (
    <Card>
      <CardHeader><CardTitle>Student / Teacher Feedback</CardTitle></CardHeader>
      <CardContent>
        <form ref={formRef} action={submit} className="grid gap-3 md:grid-cols-4">
          <Select name="student_id" required><option value="">Select student</option>{students.map((item) => <option key={item.id} value={item.id}>{label(item)}</option>)}</Select>
          <Select name="teacher_id"><option value="">Teacher...</option>{teachers.map((item) => <option key={item.id} value={item.id}>{label(item)}</option>)}</Select>
          <Select name="source" defaultValue="teacher"><option value="teacher">Teacher feedback on student</option><option value="student">Student feedback</option></Select>
          <Input name="rating" type="number" min="1" max="5" placeholder="Rating 1-5" />
          <Textarea name="comment" required className="md:col-span-4" placeholder="Feedback comment..." />
          <Button className="md:col-span-4"><Plus size={16} /> Save Feedback</Button>
          {saved && <p className="text-sm text-muted-foreground md:col-span-4">{saved}</p>}
        </form>
      </CardContent>
    </Card>
  );
}

export function EmployeeEventForm({ users, teachers, profiles = [], lang = "en" }: { users: Option[]; teachers: Option[]; profiles?: ProfileOption[]; lang?: Lang }) {
  const labels = lang === "ar" ? {
    title: "الإجازات والجزاءات وتقييم الأداء", vacation: "إجازة", penalty: "جزاء", performance: "ملاحظة أداء", amount: "المبلغ عند وجود جزاء", score: "درجة الأداء", notes: "ملاحظات...", save: "حفظ سجل الموظف", saved: "تم حفظ سجل الموظف", teacher: "مدرس", penaltyAmount: "أدخل مبلغ الجزاء (أكبر من صفر)", badAmount: "المبلغ يجب ألا يكون سالباً",
  } : {
    title: "Vacation / Penalty / Performance", vacation: "Vacation", penalty: "Penalty", performance: "Performance note", amount: "Amount if penalty", score: "Performance score", notes: "Notes...", save: "Save HR Event", saved: "HR event saved", teacher: "teacher", penaltyAmount: "Enter a penalty amount above 0.", badAmount: "The amount cannot be negative.",
  };
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [saved, setSaved] = useState("");
  async function submit(form: FormData) {
    const amountText = String(form.get("amount") ?? "").trim();
    const amount = amountText ? Number(amountText) : null;
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) return setSaved(labels.badAmount);
    if (form.get("type") === "penalty" && !(amount && amount > 0)) return setSaved(labels.penaltyAmount);
    const supabase = createSupabaseBrowserClient();
    const target = String(form.get("target") ?? "");
    const [kind, id] = target.split(":");
    const profile = kind === "profile" ? profiles.find((item) => item.id === id) : null;
    const { error } = await supabase.from("employee_events").insert({
      user_id: kind === "user" ? id : profile?.account_user_id ?? null,
      teacher_id: kind === "teacher" ? id : null,
      employee_profile_id: profile?.id ?? null,
      type: form.get("type"),
      event_date: form.get("event_date"),
      amount,
      score: form.get("score") ? Number(form.get("score")) : null,
      notes: form.get("notes"),
    });
    setSaved(error?.message ?? labels.saved);
    if (!error) {
      formRef.current?.reset();
      router.refresh();
    }
  }
  return (
    <Card>
      <CardHeader><CardTitle>{labels.title}</CardTitle></CardHeader>
      <CardContent>
        <form ref={formRef} action={submit} className="grid gap-3 md:grid-cols-4">
          <Select name="target" required>
            {profiles.map((item) => <option key={`profile:${item.id}`} value={`profile:${item.id}`}>{item.full_name}{item.role ? ` - ${item.role}` : ""}</option>)}
            {users.filter((item) => !profiles.some((profile) => profile.account_user_id === item.id)).map((item) => <option key={`user:${item.id}`} value={`user:${item.id}`}>{label(item)}</option>)}
            {teachers.map((item) => <option key={`teacher:${item.id}`} value={`teacher:${item.id}`}>{label(item)} - {labels.teacher}</option>)}
          </Select>
          <Select name="type" defaultValue="performance_note"><option value="vacation">{labels.vacation}</option><option value="penalty">{labels.penalty}</option><option value="performance_note">{labels.performance}</option></Select>
          <Input name="event_date" type="date" defaultValue={academyDate()} />
          <Input name="amount" type="number" min="0" step="0.01" placeholder={labels.amount} />
          <Input name="score" type="number" min="0" max="100" placeholder={labels.score} />
          <Textarea name="notes" required className="md:col-span-3" placeholder={labels.notes} />
          <Button className="md:col-span-4"><Plus size={16} /> {labels.save}</Button>
          {saved && <p className="text-sm text-muted-foreground md:col-span-4">{saved}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
