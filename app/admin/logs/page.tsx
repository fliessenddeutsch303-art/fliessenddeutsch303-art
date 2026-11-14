import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentLanguage } from "@/lib/i18n-server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const fieldLabels: Record<string, [string, string]> = {
  amount_paid: ["Amount paid", "المبلغ المدفوع"], payment_comment: ["Payment comment", "تعليق السداد"],
  name: ["Name", "الاسم"], status: ["Status", "الحالة"], class_status: ["Class status", "حالة الفصل"],
};

function readableDetails(details: unknown, ar: boolean) {
  if (!details || typeof details !== "object") return String(details ?? "-");
  const record = details as Record<string, unknown>;
  return Object.entries(record).map(([key, value]) => {
    const label = fieldLabels[key]?.[ar ? 1 : 0] ?? key.replaceAll("_", " ");
    if (key === "fields" && Array.isArray(value)) {
      const fields = value.map((field) => fieldLabels[String(field)]?.[ar ? 1 : 0] ?? String(field).replaceAll("_", " ")).join(ar ? "، " : ", ");
      return `${ar ? "الحقول المحدثة" : "Updated fields"}: ${fields}`;
    }
    return `${label}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`;
  }).join(ar ? " · " : " · ");
}

const PAGE_SIZE = 500;
// Database triggers write table names and insert/update/delete; the app writes singular entity names and created/updated/deleted.
const triggerEntities: Record<string, string> = { students: "student", classes: "class", treasury_records: "treasury", employee_profiles: "employee_profile", employee_attendance: "employee_attendance", leads: "lead", student_books: "student_book" };
const triggerActions: Record<string, string> = { insert: "created", update: "updated", delete: "deleted" };

export default async function AdminLogsPage({ searchParams }: { searchParams: Promise<{ before?: string }> }) {
  const { before } = await searchParams;
  const lang = await getCurrentLanguage();
  const ar = lang === "ar";
  const { supabase } = await getCurrentUser("admin");
  const query = supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(PAGE_SIZE + 1);
  const { data: fetched } = await (before ? query.lt("created_at", before) : query);
  const hasMore = (fetched ?? []).length > PAGE_SIZE;
  const data = (fetched ?? []).slice(0, PAGE_SIZE);
  const headers = ar ? ["الموظف", "البريد الإلكتروني", "الإجراء", "النوع", "السجل", "التفاصيل", "التاريخ", "الوقت"] : ["Worker", "Email", "Action", "Type", "Record", "Details", "Date", "Time"];
  const actions: Record<string, string> = ar ? { created: "إنشاء", updated: "تعديل", deleted: "حذف", imported: "استيراد", exported: "تصدير" } : { created: "Created", updated: "Updated", deleted: "Deleted", imported: "Imported", exported: "Exported" };
  const entities: Record<string, string> = ar ? { student: "طالب", class: "فصل", lead: "عميل محتمل", treasury: "خزينة", employee: "موظف", employee_profile: "ملف موظف", employee_attendance: "حضور موظف", textbook: "كتاب", student_book: "كتاب طالب", exam: "اختبار" } : { student: "Student", class: "Class", lead: "Lead", treasury: "Treasury", employee: "Employee", employee_profile: "Employee profile", employee_attendance: "Employee attendance", textbook: "Textbook", student_book: "Student book", exam: "Exam" };
  const actionOf = (action: string) => triggerActions[action] ?? action;
  const entityOf = (type: string) => triggerEntities[type] ?? type;
  return <Card dir={ar ? "rtl" : "ltr"}><CardHeader><CardTitle>{ar ? "سجل النشاط" : "Activity logs"}</CardTitle></CardHeader><CardContent className="p-0"><div className="max-h-[75vh] overflow-auto"><table className="w-full min-w-[1050px] text-sm"><thead className="sticky top-0 z-10 bg-muted"><tr>{headers.map((header) => <th key={header} className="px-4 py-3 text-start font-semibold">{header}</th>)}</tr></thead><tbody>{(data ?? []).map((log) => { const date = new Date(log.created_at); return <tr key={log.id} className="border-t"><td className="px-4 py-3 font-semibold">{log.actor_name}</td><td className="px-4 py-3">{log.actor_email}</td><td className="px-4 py-3">{actions[actionOf(log.action)] ?? log.action}</td><td className="px-4 py-3">{entities[entityOf(log.entity_type)] ?? log.entity_type}</td><td className="px-4 py-3">{log.entity_id}</td><td className="max-w-[420px] whitespace-pre-wrap px-4 py-3">{readableDetails(log.details, ar)}</td><td className="px-4 py-3">{date.toLocaleDateString(ar ? "ar-EG" : undefined)}</td><td className="px-4 py-3">{date.toLocaleTimeString(ar ? "ar-EG" : undefined)}</td></tr>; })}</tbody></table>{hasMore && <div className="p-4 text-center"><Link className="text-sm font-semibold underline" href={`/admin/logs?before=${encodeURIComponent(String(data[data.length - 1].created_at))}`}>{ar ? "تحميل الأقدم" : "Load older"}</Link></div>}{!(data ?? []).length && <p className="p-8 text-center text-muted-foreground">{ar ? "لا توجد سجلات نشاط بعد." : "No activity logs yet."}</p>}</div></CardContent></Card>;
}
