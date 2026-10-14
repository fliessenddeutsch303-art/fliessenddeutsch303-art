"use client";

import { useMemo, useState } from "react";
import { Check, Edit2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

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
};

export function TreasuryRecordsTable({ rows: initialRows, labels }: { rows: TreasuryRow[]; labels: TreasuryTableLabels }) {
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ type: "income" as "income" | "expense", amount: "", category: "", date: "", description: "" });
  const [message, setMessage] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(q));
  }, [query, rows]);

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

  function cancelEdit() {
    setEditingId(null);
    setMessage("");
  }

  async function saveEdit() {
    if (!editingId) return;
    const payload = { type: draft.type, amount: Number(draft.amount), category: draft.category, date: draft.date, description: draft.description };
    const { error } = await createSupabaseBrowserClient().from("treasury_records").update(payload).eq("id", editingId);
    if (error) {
      setMessage(error.message);
      return;
    }
    setRows((current) => current.map((row) => row.id === editingId ? { ...row, ...payload, type_value: payload.type, type: payload.type === "income" ? labels.income : labels.expense } : row));
    setEditingId(null);
    setMessage(labels.updated);
  }

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm print:hidden">
        <Input placeholder={labels.search} value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-muted">
            <tr>
              {[labels.dateColumn, labels.typeColumn, labels.categoryColumn, labels.amountColumn, labels.descriptionColumn, ""].map((header, index) => <th key={`${header}-${index}`} className="px-4 py-3 text-left font-semibold">{header}</th>)}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => editingId === row.id ? (
              <tr key={row.id} className="border-t align-top">
                <td className="px-3 py-3"><Input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></td>
                <td className="px-3 py-3"><Select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as "income" | "expense" })}><option value="income">{labels.income}</option><option value="expense">{labels.expense}</option></Select></td>
                <td className="px-3 py-3"><Input value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} /></td>
                <td className="px-3 py-3"><Input type="number" step="0.01" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} /></td>
                <td className="px-3 py-3"><Input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></td>
                <td className="px-3 py-3"><div className="flex gap-2"><Button size="sm" onClick={() => void saveEdit()}><Check size={16} /> {labels.saveChanges}</Button><Button size="sm" variant="outline" onClick={cancelEdit}><X size={16} /> {labels.cancel}</Button></div></td>
              </tr>
            ) : (
              <tr key={row.id} className="border-t">
                <td className="px-4 py-3">{String(row.date ?? "")}</td>
                <td className="px-4 py-3">{String(row.type ?? "")}</td>
                <td className="px-4 py-3">{String(row.category ?? "")}</td>
                <td className="px-4 py-3">{String(row.amount ?? "")}</td>
                <td className="px-4 py-3">{String(row.description ?? "")}</td>
                <td className="px-4 py-3"><Button size="sm" variant="outline" onClick={() => startEdit(row)}><Edit2 size={16} /> {labels.edit}</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visible.length && <div className="p-8 text-center text-muted-foreground">{labels.noRecords}</div>}
      </div>
    </div>
  );
}
