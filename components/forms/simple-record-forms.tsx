"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { academyDate } from "@/lib/dates";

type Option = { id: string; name: string };

export function StudentForm({ classes }: { classes: Option[] }) {
  const [saved, setSaved] = useState("");
  async function submit(form: FormData) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("students").insert({
      full_name: form.get("full_name"),
      phone: form.get("phone"),
      email: form.get("email"),
      level: form.get("level"),
      class_id: form.get("class_id") || null,
      total_price: Number(form.get("total_price") || 0),
      amount_paid: Number(form.get("amount_paid") || 0),
      payment_due_date: form.get("payment_due_date") || null,
      payment_comment: form.get("payment_comment"),
      status: form.get("status"),
      enrolled_at: new Date().toISOString(),
    });
    setSaved(error?.message ?? "Student saved");
  }
  return (
    <Card><CardHeader><CardTitle>Add Student</CardTitle></CardHeader><CardContent>
      <form action={submit} className="grid gap-3 md:grid-cols-3">
        <Input name="full_name" required placeholder="Full name" /><Input name="phone" required placeholder="Phone" /><Input name="email" type="email" placeholder="Email" />
        <Input name="level" placeholder="Level" /><Select name="class_id"><option value="">No class</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        <Select name="status" defaultValue="active"><option value="active">Active</option><option value="inactive">Inactive</option><option value="graduated">Graduated</option></Select>
        <Input name="total_price" type="number" min="0" step="0.01" placeholder="Total price" />
        <Input name="amount_paid" type="number" min="0" step="0.01" placeholder="Amount paid" />
        <Input name="payment_due_date" type="date" aria-label="Payment date arranged" />
        <Textarea className="md:col-span-3" name="payment_comment" placeholder="Payment comment or arrangement notes..." />
        <Button className="md:col-span-3">Save Student</Button>{saved && <p className="text-sm text-muted-foreground">{saved}</p>}
      </form>
    </CardContent></Card>
  );
}

export function ClassForm({ teachers }: { teachers: Option[] }) {
  const [saved, setSaved] = useState("");
  async function submit(form: FormData) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("classes").insert({ name: form.get("name"), teacher_id: form.get("teacher_id"), schedule: form.get("schedule"), capacity: Number(form.get("capacity")) });
    setSaved(error?.message ?? "Class saved");
  }
  return (
    <Card><CardHeader><CardTitle>Create Class</CardTitle></CardHeader><CardContent>
      <form action={submit} className="grid gap-3 md:grid-cols-4">
        <Input name="name" required placeholder="Class name" /><Select name="teacher_id" required>{teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
        <Input name="schedule" required placeholder="Sunday Tuesday 6pm" /><Input name="capacity" required type="number" min="1" placeholder="Capacity" />
        <Button className="md:col-span-4">Save Class</Button>{saved && <p className="text-sm text-muted-foreground">{saved}</p>}
      </form>
    </CardContent></Card>
  );
}

type TreasuryLabels = {
  addTitle: string;
  description: string;
  date: string;
  category: string;
  amount: string;
  type: string;
  income: string;
  expense: string;
  save: string;
};

const defaultTreasuryLabels: TreasuryLabels = {
  addTitle: "Add income or expense",
  description: "Description",
  date: "Date",
  category: "Category",
  amount: "Amount",
  type: "Type",
  income: "Income",
  expense: "Expense",
  save: "Save record",
};

export function TreasuryForm({ labels = defaultTreasuryLabels }: { labels?: TreasuryLabels }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState(false);
  async function submit(form: FormData) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("treasury_records").insert({ type: form.get("type"), amount: Number(form.get("amount")), category: form.get("category"), description: form.get("description"), date: form.get("date") });
    setError(Boolean(error));
    setSaved(error?.message ?? "Record saved successfully");
    if (!error) formRef.current?.reset();
  }
  return (
    <Card><CardHeader><CardTitle>{labels.addTitle}</CardTitle></CardHeader><CardContent>
      <form ref={formRef} action={submit} className="grid gap-3 md:grid-cols-5">
        <Select name="type" aria-label={labels.type} defaultValue="income"><option value="income">{labels.income}</option><option value="expense">{labels.expense}</option></Select><Input name="amount" type="number" min="0.01" step="0.01" required placeholder={labels.amount} aria-label={labels.amount} />
        <Input name="category" required placeholder={labels.category} aria-label={labels.category} /><Input name="date" type="date" required defaultValue={academyDate()} aria-label={labels.date} />
        <Input name="description" placeholder={labels.description} aria-label={labels.description} /><Button className="md:col-span-5">{labels.save}</Button>{saved && <p role="status" className={`text-sm md:col-span-5 ${error ? "text-red-700" : "text-green-700"}`}>{saved}</p>}
      </form>
    </CardContent></Card>
  );
}

type AdjustmentTarget = { id: string; name: string; kind: "teacher" | "profile" | "user"; account_user_id?: string };

export function AdjustmentForm({ targets }: { targets: AdjustmentTarget[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState(false);
  async function submit(form: FormData) {
    const supabase = createSupabaseBrowserClient();
    const target = targets.find((item) => `${item.kind}:${item.id}` === form.get("target"));
    if (!target) return;
    const common = { type: form.get("type"), amount: Number(form.get("amount")), reason: form.get("reason"), period_start: form.get("period_start"), period_end: form.get("period_end") };
    if (String(common.period_start) > String(common.period_end)) {
      setError(true);
      setSaved("The period start must be before the period end.");
      return;
    }
    // teachers use teacher_adjustments, everyone else employee_adjustments
    const { error: saveError } = target.kind === "teacher"
      ? await supabase.from("teacher_adjustments").insert({ teacher_id: target.id, ...common })
      : await supabase.from("employee_adjustments").insert({ user_id: target.kind === "profile" ? target.account_user_id : target.id, employee_profile_id: target.kind === "profile" ? target.id : null, ...common });
    setError(Boolean(saveError));
    setSaved(saveError?.message ?? "Adjustment saved");
    if (!saveError) {
      formRef.current?.reset();
      router.refresh();
    }
  }
  return (
    <Card><CardHeader><CardTitle>Add bonus / deduction</CardTitle></CardHeader><CardContent>
      <form ref={formRef} action={submit} className="grid gap-3 md:grid-cols-3">
        <Select name="target" aria-label="Employee">{targets.map((t) => <option key={`${t.kind}:${t.id}`} value={`${t.kind}:${t.id}`}>{t.name}{t.kind === "teacher" ? " - teacher" : ""}</option>)}</Select><Select name="type" aria-label="Type"><option value="bonus">Bonus</option><option value="deduction">Deduction</option></Select><Input name="amount" required type="number" min="0.01" step="0.01" placeholder="Amount" />
        <label className="grid gap-1 text-xs text-muted-foreground">Period start<Input name="period_start" required type="date" /></label><label className="grid gap-1 text-xs text-muted-foreground">Period end<Input name="period_end" required type="date" /></label><Textarea name="reason" required placeholder="Reason" />
        <p className="text-xs text-muted-foreground md:col-span-3">An adjustment is paid once, in the payslip period that contains its period start date (the end date is informational).</p>
        <Button className="md:col-span-3">Save Adjustment</Button>{saved && <p role="status" className={`text-sm md:col-span-3 ${error ? "text-red-700" : "text-green-700"}`}>{saved}</p>}
      </form>
    </CardContent></Card>
  );
}
