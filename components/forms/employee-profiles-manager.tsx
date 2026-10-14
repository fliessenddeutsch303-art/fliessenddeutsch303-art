"use client";

import { useState } from "react";
import { Edit2, Plus, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { Lang } from "@/lib/i18n";

type Account = { id: string; full_name: string; email?: string | null; role: string };
type Profile = { id: string; account_user_id: string; full_name: string; role: string; phone?: string | null; is_active: boolean; payroll_type: string; monthly_salary?: number | null; monthly_wage?: number | null; hourly_rate?: number | null };

const copy = {
  en: { title: "Employee profiles", hint: "Profiles are the people used by attendance, payroll, and HR. Login accounts are shared by department.", add: "Add profile", edit: "Edit profile", name: "Employee name", phone: "Phone", account: "Department login account", role: "Role", pay: "Payroll type", value: "Amount / rate", save: "Save profile", update: "Update profile", cancel: "Cancel", delete: "Delete profile", active: "Active", saved: "Profile saved", roles: { reception: "Reception", sales: "Sales", teacher: "Teacher", admin: "Admin" }, payTypes: { monthly_salary: "Monthly salary", monthly_wage: "Monthly wage", hourly: "Hourly", per_session: "Per session" } },
  ar: { title: "ملفات الموظفين", hint: "الملفات تمثل الأشخاص الذين يستخدمهم الحضور والمرتبات والموارد البشرية. حساب الدخول يكون مشتركاً حسب القسم.", add: "إضافة ملف", edit: "تعديل الملف", name: "اسم الموظف", phone: "الهاتف", account: "حساب دخول القسم", role: "الوظيفة", pay: "نوع الأجر", value: "المبلغ / السعر", save: "حفظ الملف", update: "تحديث الملف", cancel: "إلغاء", delete: "حذف الملف", active: "نشط", saved: "تم حفظ الملف", roles: { reception: "استقبال", sales: "مبيعات", teacher: "مدرس", admin: "مدير" }, payTypes: { monthly_salary: "راتب شهري", monthly_wage: "أجر شهري", hourly: "بالساعة", per_session: "بالحصة" } },
} as const;

export function EmployeeProfilesManager({ initialProfiles, accounts, lang = "en" }: { initialProfiles: Profile[]; accounts: Account[]; lang?: Lang }) {
  const labels = copy[lang];
  const [profiles, setProfiles] = useState(initialProfiles);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [accountUserId, setAccountUserId] = useState("");
  const [role, setRole] = useState("reception");
  const [payrollType, setPayrollType] = useState("monthly_salary");
  const [value, setValue] = useState("0");
  const [active, setActive] = useState(true);
  const [message, setMessage] = useState("");

  function reset() { setEditing(null); setFullName(""); setPhone(""); setAccountUserId(""); setRole("reception"); setPayrollType("monthly_salary"); setValue("0"); setActive(true); }
  function startEdit(profile: Profile) { setEditing(profile); setFullName(profile.full_name); setPhone(profile.phone ?? ""); setAccountUserId(profile.account_user_id); setRole(profile.role); setPayrollType(profile.payroll_type); setValue(String(profile.payroll_type === "monthly_salary" ? profile.monthly_salary ?? 0 : profile.payroll_type === "monthly_wage" ? profile.monthly_wage ?? 0 : profile.hourly_rate ?? 0)); setActive(profile.is_active); setMessage(""); }
  function payload() { return { id: editing?.id, account_user_id: accountUserId, full_name: fullName, phone, role, is_active: active, payroll_type: payrollType, monthly_salary: payrollType === "monthly_salary" ? Number(value) : 0, monthly_wage: payrollType === "monthly_wage" ? Number(value) : 0, hourly_rate: payrollType === "hourly" || payrollType === "per_session" ? Number(value) : 0 }; }
  async function submit(event: React.FormEvent) { event.preventDefault(); const response = await fetch("/api/employee-profiles", { method: editing ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload()) }); const json = await response.json(); if (!response.ok) { setMessage(json.error ?? "Failed"); return; } setProfiles((current) => editing ? current.map((item) => item.id === editing.id ? json.profile : item) : [json.profile, ...current]); setMessage(labels.saved); reset(); }
  async function remove(profile: Profile) { if (!window.confirm(`${labels.delete}: ${profile.full_name}?`)) return; const response = await fetch("/api/employee-profiles", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: profile.id }) }); const json = await response.json(); if (!response.ok) { setMessage(json.error ?? "Failed"); return; } setProfiles((current) => current.filter((item) => item.id !== profile.id)); setMessage(labels.saved); }

  return <div className="space-y-4"><Card><CardHeader><CardTitle>{editing ? labels.edit : labels.title}</CardTitle><p className="text-sm text-muted-foreground">{labels.hint}</p></CardHeader><CardContent><form onSubmit={submit} className="grid gap-3 md:grid-cols-3"><Input required placeholder={labels.name} value={fullName} onChange={(event) => setFullName(event.target.value)} /><Input placeholder={labels.phone} value={phone} onChange={(event) => setPhone(event.target.value)} /><Select required value={accountUserId} onChange={(event) => setAccountUserId(event.target.value)}><option value="">{labels.account}</option>{accounts.filter((account) => ["reception", "sales", "teacher", "admin"].includes(account.role)).map((account) => <option key={account.id} value={account.id}>{account.email ?? account.full_name} ({labels.roles[account.role as keyof typeof labels.roles] ?? account.role})</option>)}</Select><Select value={role} onChange={(event) => setRole(event.target.value)}><option value="reception">{labels.roles.reception}</option><option value="sales">{labels.roles.sales}</option><option value="teacher">{labels.roles.teacher}</option><option value="admin">{labels.roles.admin}</option></Select><Select value={payrollType} onChange={(event) => setPayrollType(event.target.value)}><option value="monthly_salary">{labels.payTypes.monthly_salary}</option><option value="monthly_wage">{labels.payTypes.monthly_wage}</option><option value="hourly">{labels.payTypes.hourly}</option><option value="per_session">{labels.payTypes.per_session}</option></Select><Input type="number" min="0" step="0.01" placeholder={labels.value} value={value} onChange={(event) => setValue(event.target.value)} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />{labels.active}</label><div className="flex flex-wrap gap-2 md:col-span-2"><Button>{editing ? <Edit2 size={16} /> : <Plus size={16} />}{editing ? labels.update : labels.add}</Button>{editing && <Button type="button" variant="outline" onClick={reset}><X size={16} />{labels.cancel}</Button>}</div>{message && <p role="status" className="text-sm text-muted-foreground md:col-span-3">{message}</p>}</form></CardContent></Card><Card><CardContent className="grid gap-2 p-4 md:grid-cols-2">{profiles.map((profile) => <div key={profile.id} className="flex items-center justify-between rounded-md border p-3"><div><p className="font-semibold">{profile.full_name}</p><p className="text-xs text-muted-foreground">{labels.roles[profile.role as keyof typeof labels.roles] ?? profile.role} · {accounts.find((account) => account.id === profile.account_user_id)?.email ?? profile.account_user_id}</p><Badge>{profile.is_active ? labels.active : "Inactive"}</Badge></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => startEdit(profile)}><Edit2 size={15} />{labels.edit}</Button><Button size="sm" variant="destructive" onClick={() => void remove(profile)}><Trash2 size={15} /></Button></div></div>)}</CardContent></Card></div>;
}
