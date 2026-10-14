"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Edit2, MessageSquarePlus, Printer, Save, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Lang } from "@/lib/i18n";
import { formatMoney } from "@/lib/utils";
import { exportExcel } from "@/lib/excel";

type StudentFollowUp = {
  id: string;
  full_name: string;
  phone: string;
  email?: string | null;
  level?: string | null;
  tags?: string[] | null;
  class_id?: string | null;
  learning_mode?: string | null;
  status?: string | null;
  total_price?: number | null;
  amount_paid?: number | null;
  payment_due_date?: string | null;
  payment_comment?: string | null;
  class_name?: string;
  teacher_name?: string;
  schedule?: string;
  account_notes: string[];
  exams: Array<{ type: string; date: string; level: string; score: string; comment: string }>;
  feedback: Array<{ id?: string; teacher_id?: string | null; source: string; rating: string; comment: string; date: string }>;
  attendance: Array<{ date: string; status: string }>;
  worker_comments?: Array<{ worker: string; role: string; comment: string; date: string }>;
  promotion_candidate?: boolean;
  next_level?: string;
};

type ClassOption = { id: string; name: string };

const emptyForm = {
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
};

function balance(student: StudentFollowUp) {
  return Math.max(0, Number(student.total_price ?? 0) - Number(student.amount_paid ?? 0));
}

function last<T>(items: T[]) {
  return items[0];
}

function attendanceInfo(student: StudentFollowUp) {
  const present = student.attendance.filter((item) => item.status === "present" || item.status === "late").length;
  const absent = student.attendance.filter((item) => item.status === "absent").length;
  const excused = student.attendance.filter((item) => item.status === "excused").length;
  const total = student.attendance.length;
  const rate = total ? Math.round((present / total) * 100) : null;
  const status = rate === null ? "no_records" : rate >= 75 ? "regular" : rate >= 50 ? "at_risk" : "skipping";
  return { present, absent, excused, total, rate, status };
}

function presenceLevel(rate: number | null) {
  if (rate === null) return { label: "No records", dot: "bg-slate-300", text: "text-slate-600" };
  if (rate >= 95) return { label: "Regular", dot: "bg-green-500", text: "text-green-700" };
  if (rate >= 76) return { label: "Not bad", dot: "bg-yellow-400", text: "text-yellow-700" };
  return { label: "Skipping", dot: "bg-red-500", text: "text-red-700" };
}

function displayValue(value: string | null | undefined, lang: Lang) {
  if (lang === "ar") {
    return value === "offline" ? "أوفلاين" : value === "online" ? "أونلاين" : value === "active" ? "نشط" : value === "inactive" ? "غير نشط" : value === "graduated" ? "متخرج" : value ?? "";
  }
  return value ?? "";
}

const copy = {
  en: {
    followUp: "Students Follow Up", edit: "Edit", close: "Close editor", fullName: "Full name", phone: "Phone", email: "Email", level: "Level", tags: "Tags", noClass: "No class", offline: "Offline", online: "Online", active: "Active", inactive: "Inactive", graduated: "Graduated", totalPrice: "Total price", paid: "Amount paid", paymentDate: "Payment date", paymentComment: "Comments about payment/student...", saveChanges: "Save student changes", rating: "Rating 1-5", teacherComment: "Teacher comment about this student...", saveComment: "Save comment", commentSaved: "Comment saved", studentUpdated: "Student updated", teacherHint: "Add or edit your comment for each student from this list.", adminHint: "Hover over a student name to see the complete student card.", editHint: "Use Edit to update student details, or Print/PDF for a full printable profile.", printHint: "Use Print/PDF for a full printable profile.", search: "Search follow up...", student: "Student", className: "Class", teacher: "Teacher", mode: "Mode", presence: "Presence", presentCount: "Presented", skippedCount: "Skipped", notPaid: "Not paid", latestExam: "Latest exam", latestFeedback: "Latest feedback", staffComment: "Staff comment", actions: "Actions", print: "Print/PDF", comment: "Comment", noStudents: "No students found.", noEmail: "No email", noTeacher: "No teacher", schedule: "Schedule", price: "Price", paymentCommentLabel: "Payment comment", accountNotes: "Account notes", none: "None", attendance: "Attendance", latestAttendance: "Latest attendance", workerComment: "Student comment about staff", status: "Status", promotion: "Next level", promotionCandidates: "Promotion candidates", exportPromotion: "Export promotion list", candidate: "Ready to continue", all: "All", filterLevel: "All levels", filterTeacher: "All teachers", filterClass: "All classes", filterMode: "Online / offline", filterStatus: "All statuses", filterTag: "Tag...", filterAttendance: "Attendance", regular: "Regular", atRisk: "At risk", skipping: "Skipping", noRecords: "No records", notBad: "Not bad",
  },
  ar: {
    followUp: "متابعة الطلاب", edit: "تعديل", close: "إغلاق التعديل", fullName: "الاسم بالكامل", phone: "رقم الهاتف", email: "البريد الإلكتروني", level: "المستوى", tags: "التصنيفات", noClass: "بدون فصل", offline: "أوفلاين", online: "أونلاين", active: "نشط", inactive: "غير نشط", graduated: "متخرج", totalPrice: "السعر الإجمالي", paid: "المدفوع", paymentDate: "تاريخ السداد", paymentComment: "ملاحظات السداد أو الطالب...", saveChanges: "حفظ تعديلات الطالب", rating: "التقييم من 1 إلى 5", teacherComment: "تعليق المدرس على الطالب...", saveComment: "حفظ التعليق", commentSaved: "تم حفظ التعليق", studentUpdated: "تم تحديث بيانات الطالب", teacherHint: "أضف أو عدّل تعليقك على كل طالب من هذه القائمة.", adminHint: "مرر المؤشر فوق اسم الطالب لعرض بطاقة بياناته كاملة.", editHint: "استخدم تعديل لتحديث بيانات الطالب أو طباعة ملف كامل بصيغة PDF.", printHint: "استخدم طباعة / PDF لعرض ملف الطالب كاملًا.", search: "البحث في المتابعة...", student: "الطالب", className: "الفصل", teacher: "المدرس", mode: "النظام", presence: "الانتظام", presentCount: "حضر", skippedCount: "تغيب", notPaid: "المتبقي", latestExam: "آخر اختبار", latestFeedback: "آخر تقييم", staffComment: "تعليق على موظف", actions: "الإجراءات", print: "طباعة / PDF", comment: "تعليق", noStudents: "لا يوجد طلاب.", noEmail: "لا يوجد بريد", noTeacher: "لا يوجد مدرس", schedule: "الجدول", price: "السعر", paymentCommentLabel: "تعليق السداد", accountNotes: "ملاحظات الحساب", none: "لا يوجد", attendance: "الحضور", latestAttendance: "آخر حضور", workerComment: "تعليق الطالب على الموظف", status: "الحالة", promotion: "المستوى التالي", promotionCandidates: "الطلاب المرشحون للانتقال", exportPromotion: "تصدير قائمة المرشحين", candidate: "جاهز للانتقال", all: "الكل", filterLevel: "كل المستويات", filterTeacher: "كل المدرسين", filterClass: "كل الفصول", filterMode: "أونلاين / أوفلاين", filterStatus: "كل الحالات", filterTag: "التصنيف...", filterAttendance: "الحضور", regular: "منتظم", atRisk: "يحتاج متابعة", skipping: "متغيب", noRecords: "لا توجد سجلات", notBad: "مقبول",
  },
} as const;

function StudentOverlay({ student, lang, onClose }: { student: StudentFollowUp; lang: Lang; onClose: () => void }) {
  const labels = copy[lang];
  const isRtl = lang === "ar";
  const latestExam = last(student.exams);
  const latestFeedback = last(student.feedback);
  const latestAttendance = last(student.attendance);
  const latestWorkerComment = last(student.worker_comments ?? []);
  const attendance = attendanceInfo(student);
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={student.full_name} onClick={onClose}>
      <div
        dir={isRtl ? "rtl" : "ltr"}
        className={`max-h-[88vh] w-full max-w-2xl overflow-auto rounded-xl border border-accent bg-white p-5 text-sm shadow-2xl ${isRtl ? "text-right" : "text-left"}`}
        style={{ direction: isRtl ? "rtl" : "ltr" }}
        onClick={(event) => event.stopPropagation()}
      >
      <div className="mb-3 flex items-start justify-between gap-3 border-b pb-3">
        <div>
          <h3 className="text-lg font-semibold text-primary">{student.full_name}</h3>
          <p dir="ltr" className="text-left text-sm text-muted-foreground">{student.phone} · {student.email ?? labels.noEmail}</p>
        </div>
        <div className="flex items-center gap-2"><Badge>{student.status ?? "active"}</Badge><Button type="button" size="icon" variant="outline" onClick={onClose} aria-label={labels.close}><X size={16} /></Button></div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <p><span className="font-semibold">{labels.level}:</span> {student.level ?? ""}</p>
        <p><span className="font-semibold">{labels.mode}:</span> {displayValue(student.learning_mode, lang)}</p>
        <p><span className="font-semibold">{labels.className}:</span> {student.class_name ?? labels.noClass}</p>
        <p><span className="font-semibold">{labels.teacher}:</span> {student.teacher_name ?? labels.noTeacher}</p>
        <p><span className="font-semibold">{labels.schedule}:</span> {student.schedule ?? ""}</p>
        <p><span className="font-semibold">{labels.tags}:</span> {(student.tags ?? []).join(", ")}</p>
        <p><span className="font-semibold">{labels.price}:</span> {formatMoney(Number(student.total_price ?? 0))}</p>
        <p><span className="font-semibold">{labels.paid}:</span> {formatMoney(Number(student.amount_paid ?? 0))}</p>
        <p><span className="font-semibold">{labels.notPaid}:</span> {formatMoney(balance(student))}</p>
        <p><span className="font-semibold">{labels.paymentDate}:</span> {student.payment_due_date ?? ""}</p>
      </div>
      <div className="mt-3 grid gap-2">
        <p><span className="font-semibold">{labels.paymentCommentLabel}:</span> {student.payment_comment || labels.none}</p>
        <p><span className="font-semibold">{labels.accountNotes}:</span> {student.account_notes.slice(0, 2).join(" | ") || labels.none}</p>
        <p><span className="font-semibold">{labels.latestExam}:</span> {latestExam ? `${latestExam.type} · ${latestExam.level} · ${latestExam.score} · ${latestExam.comment}` : labels.none}</p>
        <p><span className="font-semibold">{labels.latestFeedback}:</span> {latestFeedback ? `${latestFeedback.source} ${latestFeedback.rating ? `(${latestFeedback.rating}/5)` : ""}: ${latestFeedback.comment}` : labels.none}</p>
        <p><span className="font-semibold">{labels.attendance}:</span> {attendance.rate === null ? labels.noRecords : `${attendance.rate}% · ${attendance.present}/${attendance.total} (${attendance.absent} absent)`}</p>
        <p><span className="font-semibold">{labels.latestAttendance}:</span> {latestAttendance ? `${latestAttendance.date} · ${displayValue(latestAttendance.status, lang)}` : labels.none}</p>
        <p><span className="font-semibold">{labels.workerComment}:</span> {latestWorkerComment ? `${latestWorkerComment.worker} (${latestWorkerComment.role}): ${latestWorkerComment.comment}` : labels.none}</p>
      </div>
      </div>
    </div>
  );
}

export function StudentFollowUpManager({
  initialStudents,
  classes,
  canEdit = true,
  profileBasePath = "/admin/students",
  mode = "admin",
  teacherId,
  lang = "en",
}: {
  initialStudents: StudentFollowUp[];
  classes: ClassOption[];
  canEdit?: boolean;
  profileBasePath?: string;
  mode?: "admin" | "teacher";
  teacherId?: string;
  lang?: Lang;
}) {
  const labels = copy[lang];
  const [students, setStudents] = useState(initialStudents);
  const [editing, setEditing] = useState<StudentFollowUp | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [commenting, setCommenting] = useState<StudentFollowUp | null>(null);
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState("");
  const [query, setQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [attendanceFilter, setAttendanceFilter] = useState("");
  const [saved, setSaved] = useState("");
  const [hovered, setHovered] = useState<{ student: StudentFollowUp } | null>(null);
  const [selectedPromotionIds, setSelectedPromotionIds] = useState<Set<string>>(new Set());
  const isTeacherMode = mode === "teacher";

  const visible = useMemo(() => {
    const q = query.toLowerCase().trim();
    const tag = tagFilter.toLowerCase().trim();
    return students.filter((student) => {
      const attendance = attendanceInfo(student);
      const matchesQuery = !q || JSON.stringify(student).toLowerCase().includes(q);
      const matchesLevel = !levelFilter || student.level === levelFilter;
      const matchesTeacher = !teacherFilter || student.teacher_name === teacherFilter;
      const matchesClass = !classFilter || student.class_id === classFilter;
      const matchesMode = !modeFilter || student.learning_mode === modeFilter;
      const matchesStatus = !statusFilter || student.status === statusFilter;
      const matchesTag = !tag || (student.tags ?? []).some((item) => item.toLowerCase().includes(tag));
      const matchesAttendance = !attendanceFilter || attendance.status === attendanceFilter;
      return matchesQuery && matchesLevel && matchesTeacher && matchesClass && matchesMode && matchesStatus && matchesTag && matchesAttendance;
    });
  }, [attendanceFilter, classFilter, levelFilter, modeFilter, query, statusFilter, students, tagFilter, teacherFilter]);

  const filterOptions = useMemo(() => ({
    levels: [...new Set(students.map((student) => student.level).filter(Boolean))] as string[],
    teachers: [...new Set(students.map((student) => student.teacher_name).filter(Boolean))] as string[],
  }), [students]);

  const promotionCandidates = useMemo(() => students.filter((student) => student.promotion_candidate), [students]);

  const selectedPromotionCandidates = promotionCandidates.filter((student) => selectedPromotionIds.has(student.id));
  const promotionExportRows = selectedPromotionCandidates.length ? selectedPromotionCandidates : promotionCandidates;

  function togglePromotionSelection(id: string) {
    setSelectedPromotionIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllPromotionSelection() {
    setSelectedPromotionIds((current) => {
      const next = new Set(current);
      const allSelected = promotionCandidates.length > 0 && promotionCandidates.every((student) => next.has(student.id));
      promotionCandidates.forEach((student) => allSelected ? next.delete(student.id) : next.add(student.id));
      return next;
    });
  }

  function exportPromotionCandidates() {
    exportExcel("student-promotion-candidates.xlsx", promotionExportRows.map((student) => ({
      Name: student.full_name,
      Phone: student.phone,
      "Current level": student.level ?? "",
      "Next level": student.next_level ?? "",
      Class: student.class_name ?? "",
      Teacher: student.teacher_name ?? "",
      "Latest exam": student.exams[0] ? `${student.exams[0].type} ${student.exams[0].date}` : "",
      Score: student.exams[0]?.score ?? "",
    })), "Promotion candidates", { widths: [26, 18, 16, 16, 24, 24, 26, 12] });
  }

  function printPromotionCandidates() {
    const rows = promotionExportRows.map((student) => `<tr><td>${student.full_name}</td><td>${student.phone}</td><td>${student.level ?? ""}</td><td>${student.next_level ?? ""}</td><td>${student.class_name ?? ""}</td><td>${student.teacher_name ?? ""}</td><td>${student.exams[0]?.score ?? ""}</td></tr>`).join("");
    const win = window.open("", "_blank", "width=1000,height=700");
    if (!win) return;
    win.document.write(`<html><head><title>Promotion candidates</title><style>body{font-family:Arial;padding:24px}table{border-collapse:collapse;width:100%;margin-top:18px}th,td{border:1px solid #ccc;padding:9px;text-align:left}th{background:#1B4332;color:#fff}</style></head><body><h1>Promotion candidates (${promotionExportRows.length})</h1><table><thead><tr><th>Name</th><th>Phone</th><th>Current level</th><th>Next level</th><th>Class</th><th>Teacher</th><th>Score</th></tr></thead><tbody>${rows}</tbody></table><script>window.print();</script></body></html>`);
    win.document.close();
  }

  function setField(key: keyof typeof emptyForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function startEdit(student: StudentFollowUp) {
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
    });
    setSaved("");
  }

  function reset() {
    setEditing(null);
    setCommenting(null);
    setForm(emptyForm);
    setComment("");
    setRating("");
    setSaved("");
  }

  function latestTeacherFeedback(student: StudentFollowUp) {
    return student.feedback.find((item) => item.source === "teacher" && (!teacherId || item.teacher_id === teacherId)) ?? student.feedback.find((item) => item.source === "teacher");
  }

  function startComment(student: StudentFollowUp) {
    const latestFeedback = latestTeacherFeedback(student);
    setEditing(null);
    setCommenting(student);
    setComment(latestFeedback?.comment ?? "");
    setRating(latestFeedback?.rating ?? "");
    setSaved("");
  }

  async function submitTeacherComment(event: React.FormEvent) {
    event.preventDefault();
    if (!commenting || !teacherId) return;
    const latestFeedback = latestTeacherFeedback(commenting);
    const payload = {
      student_id: commenting.id,
      teacher_id: teacherId,
      source: "teacher",
      rating: rating ? Number(rating) : null,
      comment,
    };
    const supabase = createSupabaseBrowserClient();
    const result = latestFeedback?.id
      ? await supabase.from("feedback_records").update(payload).eq("id", latestFeedback.id)
      : await supabase.from("feedback_records").insert(payload).select().single();
    if (result.error) {
      setSaved(result.error.message);
      return;
    }
    const nextFeedback = {
      id: latestFeedback?.id ?? result.data?.id,
      teacher_id: teacherId,
      source: "teacher",
      rating,
      comment,
      date: new Date().toISOString().slice(0, 10),
    };
    setStudents((rows) => rows.map((row) => {
      if (row.id !== commenting.id) return row;
      const withoutPrevious = row.feedback.filter((item) => item.id !== latestFeedback?.id);
      return { ...row, feedback: [nextFeedback, ...withoutPrevious] };
    }));
    setCommenting((current) => current ? { ...current, feedback: [nextFeedback, ...current.feedback.filter((item) => item.id !== latestFeedback?.id)] } : null);
    setSaved(labels.commentSaved);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
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
    };
    const { error } = await createSupabaseBrowserClient().from("students").update(payload).eq("id", editing.id);
    if (error) {
      setSaved(error.message);
      return;
    }
    const klass = classes.find((item) => item.id === payload.class_id);
    setStudents((rows) => rows.map((row) => row.id === editing.id ? { ...row, ...payload, class_name: klass?.name ?? row.class_name } : row));
    setEditing((current) => current ? { ...current, ...payload, class_name: klass?.name ?? current.class_name } : null);
    setSaved(labels.studentUpdated);
  }

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle>{editing ? `${labels.edit} ${editing.full_name}` : labels.followUp}</CardTitle>
          {editing && <Button type="button" variant="outline" size="sm" onClick={reset}><X size={16} /> {labels.close}</Button>}
        </CardHeader>
        <CardContent>
          {editing ? (
            <form onSubmit={submit} className="grid gap-3 md:grid-cols-4">
              <Input required value={form.full_name} onChange={(event) => setField("full_name", event.target.value)} placeholder={labels.fullName} />
              <Input required value={form.phone} onChange={(event) => setField("phone", event.target.value)} placeholder={labels.phone} />
              <Input type="email" value={form.email} onChange={(event) => setField("email", event.target.value)} placeholder={labels.email} />
              <Input value={form.level} onChange={(event) => setField("level", event.target.value)} placeholder={labels.level} />
              <Input value={form.tags} onChange={(event) => setField("tags", event.target.value)} placeholder={labels.tags} />
              <Select value={form.class_id} onChange={(event) => setField("class_id", event.target.value)}>
                <option value="">{labels.noClass}</option>
                {classes.map((klass) => <option key={klass.id} value={klass.id}>{klass.name}</option>)}
              </Select>
              <Select value={form.learning_mode} onChange={(event) => setField("learning_mode", event.target.value)}>
                <option value="offline">{labels.offline}</option>
                <option value="online">{labels.online}</option>
              </Select>
              <Select value={form.status} onChange={(event) => setField("status", event.target.value)}>
                <option value="active">{labels.active}</option>
                <option value="inactive">{labels.inactive}</option>
                <option value="graduated">{labels.graduated}</option>
              </Select>
              <Input type="number" min="0" step="0.01" value={form.total_price} onChange={(event) => setField("total_price", event.target.value)} placeholder={labels.totalPrice} />
              <Input type="number" min="0" step="0.01" value={form.amount_paid} onChange={(event) => setField("amount_paid", event.target.value)} placeholder={labels.paid} />
              <Input type="date" value={form.payment_due_date} onChange={(event) => setField("payment_due_date", event.target.value)} aria-label={labels.paymentDate} />
              <Textarea className="md:col-span-4" value={form.payment_comment} onChange={(event) => setField("payment_comment", event.target.value)} placeholder={labels.paymentComment} />
              <Button className="md:col-span-4"><Save size={16} /> {labels.saveChanges}</Button>
              {saved && <p className="text-sm text-muted-foreground md:col-span-4">{saved}</p>}
            </form>
          ) : commenting ? (
            <form onSubmit={submitTeacherComment} className="grid gap-3 md:grid-cols-4">
              <div className="md:col-span-4">
                <p className="text-sm font-semibold">{commenting.full_name}</p>
                <p className="text-xs text-muted-foreground">{commenting.phone} · {commenting.level ?? ""} · {commenting.class_name ?? ""}</p>
              </div>
              <Input type="number" min="1" max="5" value={rating} onChange={(event) => setRating(event.target.value)} placeholder={labels.rating} />
              <Textarea required className="md:col-span-4" value={comment} onChange={(event) => setComment(event.target.value)} placeholder={labels.teacherComment} />
              <Button className="md:col-span-4"><Save size={16} /> {labels.saveComment}</Button>
              {saved && <p className="text-sm text-muted-foreground md:col-span-4">{saved}</p>}
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              {isTeacherMode
                ? labels.teacherHint
                : `${labels.adminHint} ${canEdit ? labels.editHint : labels.printHint}`}
            </p>
          )}
        </CardContent>
      </Card>

      {!isTeacherMode && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-semibold">{labels.promotionCandidates}: {promotionCandidates.length}</p>
              <p className="text-sm text-muted-foreground">{lang === "ar" ? "يتم التعرف عليهم من آخر اختبار بنسبة نجاح 70٪ أو أكثر." : "Detected from the latest exam with a score of 70% or higher."}</p>
            </div>
            <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={exportPromotionCandidates} disabled={!selectedPromotionCandidates.length}>{labels.exportPromotion} ({selectedPromotionCandidates.length})</Button><Button type="button" variant="outline" onClick={printPromotionCandidates} disabled={!selectedPromotionCandidates.length}>Print selected ({selectedPromotionCandidates.length})</Button></div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-2 md:grid-cols-4 lg:grid-cols-8">
        <Input className="lg:col-span-2" placeholder={labels.search} value={query} onChange={(event) => setQuery(event.target.value)} />
        <Select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)}><option value="">{labels.filterLevel}</option>{filterOptions.levels.map((item) => <option key={item} value={item}>{item}</option>)}</Select>
        <Select value={teacherFilter} onChange={(event) => setTeacherFilter(event.target.value)}><option value="">{labels.filterTeacher}</option>{filterOptions.teachers.map((item) => <option key={item} value={item}>{item}</option>)}</Select>
        <Select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}><option value="">{labels.filterClass}</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
        <Select value={modeFilter} onChange={(event) => setModeFilter(event.target.value)}><option value="">{labels.filterMode}</option><option value="online">{labels.online}</option><option value="offline">{labels.offline}</option></Select>
        <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">{labels.filterStatus}</option><option value="active">{labels.active}</option><option value="inactive">{labels.inactive}</option><option value="graduated">{labels.graduated}</option></Select>
        <Input placeholder={labels.filterTag} value={tagFilter} onChange={(event) => setTagFilter(event.target.value)} />
        <Select value={attendanceFilter} onChange={(event) => setAttendanceFilter(event.target.value)}><option value="">{labels.filterAttendance}</option><option value="regular">{labels.regular}</option><option value="at_risk">{labels.atRisk}</option><option value="skipping">{labels.skipping}</option><option value="no_records">{labels.noRecords}</option></Select>
      </div>

      <div className="max-h-[72vh] overflow-auto rounded-lg border bg-white">
        <table dir={lang === "ar" ? "rtl" : "ltr"} className="w-full min-w-[2050px] whitespace-nowrap text-sm">
          <thead className="sticky top-0 z-20 bg-muted">
            <tr>
              {(isTeacherMode
                ? [labels.student, labels.phone, labels.level, labels.className, labels.mode, labels.attendance, labels.presence, labels.teacherComment, labels.actions]
                : ["", labels.student, labels.phone, labels.level, labels.className, labels.teacher, labels.mode, labels.attendance, labels.presence, labels.paid, labels.notPaid, labels.latestExam, labels.promotion, labels.latestFeedback, ...(visible.some((student) => (student.worker_comments ?? []).length) ? [labels.staffComment] : []), labels.actions]
              ).map((header, index) => <th key={`${header}-${index}`} className={`px-4 py-3 font-semibold ${lang === "ar" ? "text-right" : "text-left"}`}>{!isTeacherMode && index === 0 ? <input type="checkbox" aria-label="Select promotion candidates" checked={promotionCandidates.length > 0 && promotionCandidates.every((student) => selectedPromotionIds.has(student.id))} onChange={toggleAllPromotionSelection} /> : header}</th>)}
            </tr>
          </thead>
          <tbody>
            {visible.map((student) => {
              const latestExam = last(student.exams);
              const latestFeedback = isTeacherMode ? latestTeacherFeedback(student) : last(student.feedback);
              const latestWorkerComment = last(student.worker_comments ?? []);
              const showWorkerComments = visible.some((item) => (item.worker_comments ?? []).length);
              const attendance = attendanceInfo(student);
              const presence = presenceLevel(attendance.rate);
              const presenceLabel = presence.label === "Regular" ? labels.regular : presence.label === "Not bad" ? labels.notBad : presence.label === "Skipping" ? labels.skipping : labels.noRecords;
              return (
                <tr key={student.id} className="border-t">
                  {!isTeacherMode && <td className="px-4 py-3">{student.promotion_candidate ? <input type="checkbox" aria-label={`Select ${student.full_name}`} checked={selectedPromotionIds.has(student.id)} onChange={() => togglePromotionSelection(student.id)} /> : null}</td>}
                  <td className="relative min-w-[155px] px-4 py-3">
                    {isTeacherMode ? (
                      <span className="font-semibold text-primary">{student.full_name}</span>
                    ) : (
                      <button
                        type="button"
                        className="font-semibold text-primary underline-offset-4 hover:underline"
                        onClick={() => setHovered({ student })}
                      >
                        {student.full_name}
                      </button>
                    )}
                  </td>
                  <td className="min-w-[145px] px-4 py-3">{student.phone}</td>
                  <td className="min-w-[80px] px-4 py-3">{student.level}</td>
                  <td className="min-w-[150px] px-4 py-3">{student.class_name}</td>
                  {isTeacherMode ? (
                    <>
                      <td className="min-w-[120px] px-4 py-3">{displayValue(student.learning_mode, lang)}</td>
                      <td className="min-w-[220px] px-4 py-3">{attendance.rate === null ? labels.noRecords : `${attendance.rate}% · ${labels.presentCount}: ${attendance.present} · ${labels.skippedCount}: ${attendance.absent}`}</td>
                      <td className={`min-w-[125px] px-4 py-3 font-semibold ${presence.text}`}><span className={`mr-2 inline-block h-3 w-3 rounded-full ${presence.dot}`} aria-hidden="true" />{presenceLabel}</td>
                      <td className="min-w-[260px] whitespace-normal px-4 py-3">{latestFeedback?.comment ?? ""}</td>
                    </>
                  ) : (
                    <>
                      <td className="min-w-[140px] px-4 py-3">{student.teacher_name}</td>
                      <td className="min-w-[120px] px-4 py-3">{displayValue(student.learning_mode, lang)}</td>
                      <td className="min-w-[220px] px-4 py-3">{attendance.rate === null ? labels.noRecords : `${attendance.rate}% · ${labels.presentCount}: ${attendance.present} · ${labels.skippedCount}: ${attendance.absent}`}</td>
                      <td className={`min-w-[125px] px-4 py-3 font-semibold ${presence.text}`}><span className={`mr-2 inline-block h-3 w-3 rounded-full ${presence.dot}`} aria-hidden="true" />{presenceLabel}</td>
                      <td className="min-w-[120px] px-4 py-3">{formatMoney(Number(student.amount_paid ?? 0))}</td>
                      <td className="min-w-[120px] px-4 py-3">{formatMoney(balance(student))}</td>
                      <td className="min-w-[150px] px-4 py-3">{latestExam ? `${latestExam.type} ${latestExam.level} ${latestExam.score}` : ""}</td>
                      <td className="min-w-[150px] px-4 py-3">{student.promotion_candidate ? <Badge className="border-green-300 bg-green-50 text-green-700">{labels.candidate}: {student.next_level}</Badge> : ""}</td>
                      <td className="min-w-[260px] whitespace-normal px-4 py-3">{latestFeedback?.comment ?? ""}</td>
                      {showWorkerComments && <td className="min-w-[260px] whitespace-normal px-4 py-3">{latestWorkerComment ? `${latestWorkerComment.worker}: ${latestWorkerComment.comment}` : ""}</td>}
                    </>
                  )}
                  <td className="min-w-[180px] px-4 py-3">
                    <div className="flex gap-2">
                      {canEdit && <Button size="sm" variant="outline" onClick={() => startEdit(student)}><Edit2 size={16} /> {labels.edit}</Button>}
                      {isTeacherMode && teacherId ? (
                        <Button size="sm" variant="outline" onClick={() => startComment(student)}><MessageSquarePlus size={16} /> {labels.comment}</Button>
                      ) : isTeacherMode ? null : (
                        <Button asChild size="sm" variant="outline"><Link href={`${profileBasePath}/${student.id}`}><Printer size={16} /> {labels.print}</Link></Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!visible.length && <div className="p-8 text-center text-muted-foreground">{labels.noStudents}</div>}
      </div>
      {hovered && <StudentOverlay student={hovered.student} lang={lang} onClose={() => setHovered(null)} />}
    </div>
  );
}
