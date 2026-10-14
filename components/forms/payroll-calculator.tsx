"use client";

import { useState } from "react";
import { Printer, Clipboard, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { exportExcel } from "@/lib/excel";
import { formatMoney } from "@/lib/utils";

type PayrollRow = { employee: string; role: string; payType: string; hours: number; sessions: number; basePay: number; bonuses: number; deductions: number; net: number };

export function PayrollCalculator() {
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<PayrollRow[]>([]);
  async function calculate() {
    const response = await fetch(`/api/payroll?start=${start}&end=${end}`);
    setRows(await response.json());
  }
  function copy() {
    navigator.clipboard.writeText(rows.map((row) => `${row.employee}\t${row.role}\t${row.payType}\t${row.hours}\t${row.sessions}\t${row.basePay}\t${row.bonuses}\t${row.deductions}\t${row.net}`).join("\n"));
  }
  function exportPayroll() {
    exportExcel(
      `payroll-${start}-to-${end}.xlsx`,
      rows.map((row) => ({
        Employee: row.employee,
        Role: row.role,
        "Pay Type": row.payType,
        Hours: row.hours,
        Sessions: row.sessions,
        "Base Pay": row.basePay,
        Bonuses: row.bonuses,
        Deductions: row.deductions,
        "Net Payable": row.net,
        "Period Start": start,
        "Period End": end,
      })),
      "Payroll",
    );
  }
  return (
    <Card>
      <CardHeader><CardTitle>Payroll Calculator</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[180px_180px_auto_auto_auto_auto]">
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          <Button onClick={calculate}>Calculate All</Button>
          <Button variant="outline" onClick={() => window.print()}><Printer size={16} /> Print</Button>
          <Button variant="outline" onClick={copy}><Clipboard size={16} /> Copy Table</Button>
          <Button variant="outline" onClick={exportPayroll} disabled={!rows.length}><Upload size={16} /> Export Excel</Button>
        </div>
        <table className="w-full rounded-lg border text-sm">
          <thead className="bg-muted"><tr><th className="p-3 text-left">Employee</th><th>Role</th><th>Pay type</th><th>Hours</th><th>Sessions</th><th>Base Pay</th><th>Bonuses</th><th>Deductions</th><th>NET PAYABLE</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={`${row.role}-${row.employee}`} className="border-t"><td className="p-3">{row.employee}</td><td>{row.role}</td><td>{row.payType}</td><td>{row.hours.toFixed(2)}</td><td>{row.sessions}</td><td>{formatMoney(row.basePay)}</td><td>{formatMoney(row.bonuses)}</td><td>{formatMoney(row.deductions)}</td><td className="font-semibold">{formatMoney(row.net)}</td></tr>)}</tbody>
        </table>
      </CardContent>
    </Card>
  );
}
