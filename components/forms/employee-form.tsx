"use client";

import { useMemo, useState } from "react";
import { AtSign, Copy, KeyRound, RefreshCw, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { Role } from "@/lib/types";
import { hasSupabaseEnv } from "@/lib/env";

type LeadFile = { id: string; name: string };
type Employee = {
  id: string;
  full_name: string;
  email?: string | null;
  role: Role;
  is_active: boolean;
  permissions: { sales_access?: boolean; assigned_files?: string[]; can_view_treasury?: boolean; can_view_payroll?: boolean } | null;
  payroll_type?: "monthly_salary" | "monthly_wage" | "hourly" | null;
  monthly_salary?: number | null;
  monthly_wage?: number | null;
  hourly_rate?: number | null;
};

export function EmployeeForm({ leadFiles, employees }: { leadFiles: LeadFile[]; employees: Employee[] }) {
  const [employeeList, setEmployeeList] = useState(employees);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("reception");
  const [active, setActive] = useState(true);
  const [salesAccess, setSalesAccess] = useState(false);
  const [canViewTreasury, setCanViewTreasury] = useState(false);
  const [canViewPayroll, setCanViewPayroll] = useState(false);
  const [assignedFiles, setAssignedFiles] = useState<string[]>([]);
  const [payrollType, setPayrollType] = useState<"monthly_salary" | "monthly_wage" | "hourly">("monthly_salary");
  const [monthlySalary, setMonthlySalary] = useState("0");
  const [monthlyWage, setMonthlyWage] = useState("0");
  const [hourlyRate, setHourlyRate] = useState("0");
  const [result, setResult] = useState("");
  const isEdit = Boolean(selected);

  const title = useMemo(() => (isEdit ? "Edit Employee" : "Create Employee"), [isEdit]);
  function generateAcademyEmail() {
    const localPart = fullName.trim().toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "") || "employee";
    setEmail(`${localPart}@fliessend-deutsch.local`);
  }
  function generatePassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
    setPassword(Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join(""));
  }
  function load(employee: Employee) {
    setSelected(employee);
    setFullName(employee.full_name);
    setEmail(employee.email ?? "");
    setPassword("");
    setRole(employee.role);
    setActive(employee.is_active);
    setSalesAccess(Boolean(employee.permissions?.sales_access));
    setCanViewTreasury(Boolean(employee.permissions?.can_view_treasury));
    setCanViewPayroll(Boolean(employee.permissions?.can_view_payroll));
    setAssignedFiles(employee.permissions?.assigned_files ?? []);
    setPayrollType(employee.payroll_type === "hourly" ? "hourly" : employee.payroll_type === "monthly_wage" ? "monthly_wage" : "monthly_salary");
    setMonthlySalary(String(employee.monthly_salary ?? 0));
    setMonthlyWage(String(employee.monthly_wage ?? 0));
    setHourlyRate(String(employee.hourly_rate ?? 0));
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/employees", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: selected?.id,
        full_name: fullName,
        email,
        password,
        role,
        is_active: active,
        permissions: {
          sales_access: role === "reception" ? salesAccess : false,
          assigned_files: role === "sales" ? assignedFiles : [],
          can_view_treasury: canViewTreasury,
          can_view_payroll: canViewPayroll,
        },
        payroll_type: payrollType,
        monthly_salary: Number(monthlySalary || 0),
        monthly_wage: Number(monthlyWage || 0),
        hourly_rate: Number(hourlyRate || 0),
      }),
    });
    const json = await response.json();
    setResult(response.ok ? `Account saved. Password: ${json.password ?? password ?? "updated"}` : json.error);
    if (response.ok) {
      if (!hasSupabaseEnv() && !isEdit) {
        const accounts = JSON.parse(localStorage.getItem("fd_local_accounts") ?? "[]") as Array<Record<string, string | boolean>>;
        localStorage.setItem("fd_local_accounts", JSON.stringify([...accounts.filter((account) => account.email !== email), { id: json.userId, email, password, role, full_name: fullName, is_active: active }]));
      }
      setEmployeeList((current) => isEdit ? current.map((item) => item.id === selected?.id ? { ...item, full_name: fullName, role, is_active: active, permissions: { sales_access: salesAccess, assigned_files: assignedFiles, can_view_treasury: canViewTreasury, can_view_payroll: canViewPayroll } } : item) : [{ id: json.userId, full_name: fullName, email, role, is_active: active, permissions: { sales_access: salesAccess, assigned_files: assignedFiles, can_view_treasury: canViewTreasury, can_view_payroll: canViewPayroll } }, ...current]);
      setPassword("");
    }
  }
  async function resetPassword() {
    if (!selected) return;
    const response = await fetch("/api/employees/reset-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: selected.id }) });
    const json = await response.json();
    setResult(response.ok ? `New password: ${json.password}` : json.error);
  }

  async function deleteEmployee() {
    if (!selected) return;
    if (selected.id === "local-admin") {
      setResult("You cannot delete the account currently in use.");
      return;
    }
    if (!window.confirm(`Delete ${selected.full_name}'s account permanently?`)) return;
    const response = await fetch("/api/employees", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: selected.id }) });
    const json = await response.json();
    if (!response.ok) {
      setResult(json.error ?? "Employee could not be deleted.");
      return;
    }
    setEmployeeList((current) => current.filter((employee) => employee.id !== selected.id));
    setSelected(null);
    setFullName(""); setEmail(""); setPassword(""); setRole("reception"); setActive(true); setSalesAccess(false); setAssignedFiles([]);
    setResult("Employee account deleted.");
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-[#DD0000] pb-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#DD0000]">System administration</p>
        <h2 className="text-2xl font-semibold tracking-tight">Account Center</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Create and manage academy login accounts, permissions, employee status, and payroll settings.</p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Card>
        <CardHeader className="border-b bg-[#FCFAF6]"><CardTitle>{title}</CardTitle><p className="text-sm text-muted-foreground">The email and password below belong to this academy account.</p></CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <Input required placeholder="Full name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
            <div className="flex gap-2"><Input className="min-w-0 flex-1" required type="email" placeholder="Academy email address" value={email} onChange={(event) => setEmail(event.target.value)} disabled={isEdit} />{!isEdit && <Button type="button" variant="outline" title="Generate academy email" onClick={generateAcademyEmail}><AtSign size={16} /> Generate</Button>}</div>
            <div className="flex gap-2"><Input className="min-w-0 flex-1" required={!isEdit} type="text" autoComplete="new-password" placeholder={isEdit ? "New password (optional)" : "Permanent account password"} value={password} onChange={(event) => setPassword(event.target.value)} />{!isEdit && <Button type="button" variant="outline" title="Generate password" onClick={generatePassword}><RefreshCw size={16} /> Generate password</Button>}</div>
            <Select value={role} onChange={(event) => { setRole(event.target.value as Role); setSalesAccess(false); setAssignedFiles([]); }}>
              <option value="reception">Reception</option><option value="sales">Sales</option><option value="teacher">Teacher</option><option value="admin">Admin</option>
            </Select>
            {role !== "teacher" && (
            <div className="space-y-3 rounded-md border bg-[#FCFAF6] p-4">
              <p className="text-sm font-semibold">Payroll calculation</p>
                <div className="grid gap-3 md:grid-cols-3">
                  <Select value={payrollType} onChange={(event) => setPayrollType(event.target.value as "monthly_salary" | "monthly_wage" | "hourly")} aria-label="Payroll type">
                    <option value="monthly_salary">Fixed monthly salary</option>
                    <option value="monthly_wage">Monthly wage</option>
                    <option value="hourly">Calculated per hour</option>
                  </Select>
                  {payrollType === "monthly_salary" && <Input type="number" min="0" step="0.01" placeholder="Monthly salary" value={monthlySalary} onChange={(event) => setMonthlySalary(event.target.value)} />}
                  {payrollType === "monthly_wage" && <Input type="number" min="0" step="0.01" placeholder="Monthly wage" value={monthlyWage} onChange={(event) => setMonthlyWage(event.target.value)} />}
                  {payrollType === "hourly" && <Input type="number" min="0" step="0.01" placeholder="Rate per hour" value={hourlyRate} onChange={(event) => setHourlyRate(event.target.value)} />}
                </div>
                {payrollType === "hourly" && <p className="text-xs text-muted-foreground">Payroll will use Check in hours x hourly rate, then apply bonuses/deductions.</p>}
              </div>
            )}
            <div className="space-y-3 rounded-md border bg-[#FCFAF6] p-4">
              <p className="text-sm font-semibold">Permissions checklist</p>
              {role === "admin" ? (
                <p className="text-sm text-muted-foreground">Admin has full access automatically.</p>
              ) : (
                <>
                  {role === "reception" && <label className="flex items-center gap-2 text-sm"><input checked={salesAccess} type="checkbox" onChange={(e) => setSalesAccess(e.target.checked)} /> Can view assigned sales leads</label>}
                  {role === "sales" && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Lead Files Access</p>
                      {leadFiles.map((file) => (
                        <label key={file.id} className="flex items-center gap-2 text-sm">
                          <input checked={assignedFiles.includes(file.id)} type="checkbox" onChange={(e) => setAssignedFiles((files) => e.target.checked ? [...files, file.id] : files.filter((id) => id !== file.id))} />
                          {file.name}
                        </label>
                      ))}
                      {!leadFiles.length && <p className="text-sm text-muted-foreground">No lead files uploaded yet.</p>}
                    </div>
                  )}
                  {role === "teacher" && <p className="text-sm text-muted-foreground">Teacher access is automatically scoped to their own classes and students.</p>}
                  <label className="flex items-center gap-2 text-sm"><input checked={canViewTreasury} type="checkbox" onChange={(e) => setCanViewTreasury(e.target.checked)} /> Can view treasury reports</label>
                  <label className="flex items-center gap-2 text-sm"><input checked={canViewPayroll} type="checkbox" onChange={(e) => setCanViewPayroll(e.target.checked)} /> Can view payroll reports</label>
                </>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm"><input checked={active} type="checkbox" onChange={(e) => setActive(e.target.checked)} /> Active</label>
            <div className="flex flex-wrap gap-2">
              <Button><UserPlus size={16} /> {isEdit ? "Update Permissions" : "Create Employee & Send Login"}</Button>
              {isEdit && <><Button type="button" variant="outline" onClick={resetPassword}><KeyRound size={16} /> Generate new password</Button><Button type="button" variant="destructive" onClick={() => void deleteEmployee()}><Trash2 size={16} /> Delete employee</Button></>}
            </div>
            {result && <div className="flex items-center justify-between rounded-md bg-muted p-3 text-sm"><span>{result}</span><Button type="button" variant="ghost" size="icon" title="Copy account details" onClick={() => navigator.clipboard.writeText(result)}><Copy size={16} /></Button></div>}
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="border-b bg-[#1B4332] text-white"><CardTitle>Academy accounts</CardTitle><p className="text-sm text-white/75">{employeeList.length} stored employee accounts</p></CardHeader>
        <CardContent className="space-y-3 p-4">
          {employeeList.map((employee) => (
            <button key={employee.id} className="w-full rounded-md border bg-white p-3 text-left text-sm shadow-sm transition hover:border-[#DD0000] hover:bg-[#FCFAF6]" onClick={() => load(employee)}>
              <span className="block font-semibold">{employee.full_name}</span>
              <span className="mt-1 block truncate text-xs text-muted-foreground">{employee.email ?? "no email"}</span>
              <span className="mt-2 flex items-center gap-2"><Badge className="capitalize">{employee.role}</Badge><span className={employee.is_active ? "text-xs text-green-700" : "text-xs text-red-700"}>{employee.is_active ? "Active" : "Inactive"}</span></span>
            </button>
          ))}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
