"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Edit2, FileDown, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { academyDate } from "@/lib/dates";
import { formatMoney } from "@/lib/utils";

type TreasuryRow = Record<string, unknown> & { id: string; type_value: "income" | "expense" };

type TreasuryTableLabels = {
  dateColumn: string;
  typeColumn: string;
  categoryColumn: string;
  amountColumn: string;
  descriptionColumn: string;
  income: string;
  expense: string;
  noRecords: string;
  search: string;
  edit: string;
  saveChanges: string;
  cancel: string;
  updated: string;
  totalIn: string;
  totalOut: string;
  net: string;
  dailyBreakdown: string;
  monthlyBreakdown: string;
  wholeMonth: string;
  exportPdf: string;
  allDates: string;
  day: string;
  delete: string;
  deleted: string;
  confirmDelete: string;
};

export function TreasuryRecordsTable({ rows: initialRows, labels, canDelete = false, canViewMonth = false }: { rows: TreasuryRow[]; labels: TreasuryTableLabels; canDelete?: boolean; canViewMonth?: boolean }) {
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState("");
  const [day, setDay] = useState(academyDate());
  // admin only: whole month instead of one day
  const [month, setMonth] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ type: "income" as "income" | "expense", amount: "", category: "", date: "", description: "" });
  const [message, setMessage] = useState("");

  // new rows arrive through router.refresh() after the form saves
  useEffect(() => setRows(initialRows), [initialRows]);

  const dayRows = useMemo(() => month ? rows.filter((row) => String(row.date ?? "").startsWith(month)) : day ? rows.filter((row) => row.date === day) : rows, [day, month, rows]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? dayRows.filter((row) => JSON.stringify(row).toLowerCase().includes(q)) : dayRows;
  }, [query, dayRows]);
  const totals = useMemo(() => {
    const income = dayRows.filter((row) => row.type_value === "income").reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    const expense = dayRows.filter((row) => row.type_value === "expense").reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    const byCategory = new Map<string, number>();
    for (const row of dayRows) byCategory.set(String(row.category ?? ""), (byCategory.get(String(row.category ?? "")) ?? 0) + (row.type_value === "income" ? 1 : -1) * Number(row.amount ?? 0));
    return { income, expense, byCategory: [...byCategory] };
  }, [dayRows]);

  function startEdit(row: TreasuryRow) {
    setEditingId(row.id);
    setMessage("");
    setDraft({
      type: row.type_value,
      amount: String(row.amount ?? ""),
      category: String(row.category ?? ""),
      date: String(row.date ?? ""),
      description: String(row.description ?? ""),
    });
  }

  async function saveEdit() {
    if (!editingId) return;
    const amount = Number(draft.amount);
    if (!draft.amount.trim() || !Number.isFinite(amount) || amount <= 0) {
      setMessage("Enter an amount above 0.");
      return;
    }
    if (!draft.category.trim() || !draft.date) {
      setMessage("Category and date are required.");
      return;
    }
    const payload = { type: draft.type, amount, category: draft.category.trim(), date: draft.date, description: draft.description };
    const { data, error } = await createSupabaseBrowserClient().from("treasury_records").update(payload).eq("id", editingId).select("id");
    if (error || !data?.length) {
      setMessage(error?.message ?? "This record could not be changed.");
      return;
    }
    setRows((current) => current.map((row) => row.id === editingId ? { ...row, ...payload, type_value: payload.type, type: payload.type === "income" ? labels.income : labels.expense } : row));
    setEditingId(null);
    setMessage(labels.updated);
  }

  async function remove(row: TreasuryRow) {
    if (!window.confirm(`${labels.confirmDelete}\n${row.date} · ${row.category} · ${formatMoney(Number(row.amount ?? 0))}`)) return;
    const { data, error } = await createSupabaseBrowserClient().from("treasury_records").delete().eq("id", row.id).select("id");
    if (error || !data?.length) {
      setMessage(error?.message ?? "This record could not be deleted.");
      return;
    }
    setRows((current) => current.filter((item) => item.id !== row.id));
    setMessage(labels.deleted);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>{month ? `${labels.monthlyBreakdown} · ${month}` : `${labels.dailyBreakdown} · ${day || labels.allDates}`}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Input className="w-44" type="date" value={month ? "" : day} onChange={(event) => { setMonth(""); setDay(event.target.value); }} aria-label={labels.day} />
            {canViewMonth && (month
              ? <Input className="w-44" type="month" value={month} onChange={(event) => setMonth(event.target.value || academyDate().slice(0, 7))} aria-label={labels.wholeMonth} />
              : <Button type="button" variant="outline" onClick={() => setMonth((day || academyDate()).slice(0, 7))}>{labels.wholeMonth}</Button>)}
            {canViewMonth && month && <Button asChild type="button"><a href={`/print/treasury?month=${month}&print=1`} target="_blank" rel="noopener"><FileDown size={16} /> {labels.exportPdf}</a></Button>}
            <Button type="button" variant={!day && !month ? "default" : "outline"} onClick={() => { setMonth(""); setDay(""); }}>{labels.allDates}</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">{labels.totalIn}</p><p className="text-lg font-semibold text-green-700">{formatMoney(totals.income)}</p></div>
            <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">{labels.totalOut}</p><p className="text-lg font-semibold text-red-700">{formatMoney(totals.expense)}</p></div>
            <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">{labels.net}</p><p className="text-lg font-semibold">{formatMoney(totals.income - totals.expense)}</p></div>
          </div>
          {totals.byCategory.map(([category, amount]) => <p key={category} className="flex justify-between border-b py-2 text-sm"><span>{category}</span><span>{formatMoney(amount)}</span></p>)}
        </CardContent>
      </Card>
      <div className="relative max-w-sm print:hidden">
        <Input data-search placeholder={labels.search} value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      {message && <p key={message} role="status" className="text-sm text-muted-foreground">{message}</p>}
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-muted">
            <tr>
              {[labels.dateColumn, labels.typeColumn, labels.categoryColumn, labels.amountColumn, labels.descriptionColumn, ""].map((header, index) => <th key={`${header}-${index}`} className="px-4 py-3 text-start font-semibold">{header}</th>)}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => editingId === row.id ? (
              <tr key={row.id} className="border-t align-top">
                <td className="px-3 py-3"><Input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></td>
                <td className="px-3 py-3"><Select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as "income" | "expense" })}><option value="income">{labels.income}</option><option value="expense">{labels.expense}</option></Select></td>
                <td className="px-3 py-3"><Input value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} /></td>
                <td className="px-3 py-3"><Input type="number" min="0.01" step="0.01" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} /></td>
                <td className="px-3 py-3"><Input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></td>
                <td className="px-3 py-3"><div className="flex gap-2"><Button size="sm" onClick={() => void saveEdit()}><Check size={16} /> {labels.saveChanges}</Button><Button size="sm" variant="outline" onClick={() => { setEditingId(null); setMessage(""); }}><X size={16} /> {labels.cancel}</Button></div></td>
              </tr>
            ) : (
              <tr key={row.id} className="border-t">
                <td className="whitespace-nowrap px-4 py-3">{String(row.date ?? "")}</td>
                <td className={`px-4 py-3 ${row.type_value === "income" ? "text-green-700" : "text-red-700"}`}>{String(row.type ?? "")}</td>
                <td className="px-4 py-3">{String(row.category ?? "")}</td>
                <td className="whitespace-nowrap px-4 py-3">{formatMoney(Number(row.amount ?? 0))}</td>
                <td className="px-4 py-3">{String(row.description ?? "")}</td>
                <td className="px-4 py-3"><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => startEdit(row)}><Edit2 size={16} /> {labels.edit}</Button>{canDelete && <Button size="sm" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => void remove(row)} aria-label={labels.delete}><Trash2 size={14} /></Button>}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visible.length && <div className="p-8 text-center text-muted-foreground">{labels.noRecords}</div>}
      </div>
    </div>
  );
}
