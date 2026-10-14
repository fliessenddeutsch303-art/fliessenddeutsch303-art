"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Download, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { exportExcel, readExcel } from "@/lib/excel";

type ManualSheet = { id: string; name: string; columns: string[]; rows: Array<Record<string, string>> };
const storageKey = "fd_manual_lead_sheets";
const defaultColumns = ["Name", "Phone", "Level", "Notes", "Status"];

function newId() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function uniqueColumns(columns: string[]) {
  const counts = new Map<string, number>();
  return columns.map((column, index) => {
    const base = column.trim() || `Column ${index + 1}`;
    const count = (counts.get(base) ?? 0) + 1;
    counts.set(base, count);
    return count === 1 ? base : `${base} (${count})`;
  });
}

function normalizeSheet(sheet: ManualSheet): ManualSheet {
  return { ...sheet, columns: uniqueColumns(sheet.columns) };
}

function normalizeSheets(sheets: ManualSheet[]) {
  const seen = new Set<string>();
  return sheets.map((sheet) => {
    const normalized = normalizeSheet(sheet);
    if (!seen.has(normalized.id)) {
      seen.add(normalized.id);
      return normalized;
    }
    const replacement = { ...normalized, id: newId() };
    seen.add(replacement.id);
    return replacement;
  });
}

export function ManualLeadSheet({ initialSheetId, embedded = false, onDeleted }: { initialSheetId?: string; embedded?: boolean; onDeleted?: () => void }) {
  const [sheets, setSheets] = useState<ManualSheet[]>([]);
  const [activeId, setActiveId] = useState("");
  const [name, setName] = useState("");
  const [columnName, setColumnName] = useState("");
  const [ready, setReady] = useState(false);
  const [cloud, setCloud] = useState(false);
  const active = useMemo(() => sheets.find((sheet) => sheet.id === activeId) ?? sheets[0], [sheets, activeId]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/manual-sheets", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("Cloud sheets unavailable");
      const json = await response.json() as { sheets?: ManualSheet[] };
      if (cancelled) return;
      const stored = normalizeSheets(json.sheets ?? []);
      setSheets(stored);
      setActiveId(initialSheetId ?? stored[0]?.id ?? "");
      setCloud(true);
      setReady(true);
    }).catch(() => {
      try {
        const stored = normalizeSheets(JSON.parse(localStorage.getItem(storageKey) ?? "[]") as ManualSheet[]);
        if (!cancelled) {
          setSheets(stored);
          setActiveId(initialSheetId ?? stored[0]?.id ?? "");
        }
      } catch {
        if (!cancelled) setSheets([]);
      }
      if (!cancelled) setReady(true);
    });
    return () => { cancelled = true; };
  }, [initialSheetId]);

  useEffect(() => {
    if (ready && !cloud) {
      localStorage.setItem(storageKey, JSON.stringify(sheets));
      window.dispatchEvent(new Event("fd-manual-sheets-updated"));
    }
    if (ready && cloud) {
      void Promise.all(sheets.map((sheet) => fetch("/api/manual-sheets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sheet) })))
        .then(() => window.dispatchEvent(new Event("fd-manual-sheets-updated")));
    }
  }, [ready, cloud, sheets]);

  function createSheet() {
    const sheet: ManualSheet = { id: newId(), name: name.trim() || `Manual list ${sheets.length + 1}`, columns: [...defaultColumns], rows: [] };
    setSheets((current) => [...current, sheet]);
    setActiveId(sheet.id);
    setName("");
  }

  function updateSheet(update: (sheet: ManualSheet) => ManualSheet) {
    if (!active) return;
    setSheets((current) => current.map((sheet) => sheet.id === active.id ? update(sheet) : sheet));
  }

  function addRow() {
    updateSheet((sheet) => ({ ...sheet, rows: [...sheet.rows, Object.fromEntries(sheet.columns.map((column) => [column, ""]))] }));
  }

  function addColumn() {
    const column = columnName.trim();
    if (!column || active?.columns.includes(column)) return;
    updateSheet((sheet) => ({ ...sheet, columns: [...sheet.columns, column], rows: sheet.rows.map((row) => ({ ...row, [column]: "" })) }));
    setColumnName("");
  }

  function updateCell(rowIndex: number, column: string, value: string) {
    updateSheet((sheet) => ({ ...sheet, rows: sheet.rows.map((row, index) => index === rowIndex ? { ...row, [column]: value } : row) }));
  }

  function deleteRow(rowIndex: number) {
    updateSheet((sheet) => ({ ...sheet, rows: sheet.rows.filter((_, index) => index !== rowIndex) }));
  }

  async function deleteSheet() {
    if (!active || !window.confirm(`Delete the entire list "${active.name}"?`)) return;
    if (cloud) {
      const response = await fetch("/api/manual-sheets", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: active.id }) });
      if (!response.ok) return;
    } else {
      const remaining = sheets.filter((sheet) => sheet.id !== active.id);
      localStorage.setItem(storageKey, JSON.stringify(remaining));
    }
    const remaining = sheets.filter((sheet) => sheet.id !== active.id);
    setSheets(remaining);
    setActiveId(remaining[0]?.id ?? "");
    window.dispatchEvent(new Event("fd-manual-sheets-updated"));
    onDeleted?.();
  }

  function exportSheet() {
    if (!active) return;
    exportExcel(`${active.name.replace(/\s+/g, "-").toLowerCase()}.xlsx`, active.rows, active.name, { widths: active.columns.map(() => 24) });
  }

  async function importSheet(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const parsed = await readExcel(file);
    const columns = uniqueColumns(Object.keys(parsed[0] ?? {}));
    if (!columns.length) return;
    const sourceColumns = Object.keys(parsed[0] ?? {});
    const sheet: ManualSheet = { id: newId(), name: file.name.replace(/\.[^.]+$/, ""), columns, rows: parsed.map((row) => Object.fromEntries(columns.map((column, index) => [column, String(row[sourceColumns[index]] ?? "")])) ) };
    setSheets((current) => [...current, sheet]);
    setActiveId(sheet.id);
    event.target.value = "";
  }

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-white p-4">
      {(!embedded || !active) && <><Input className="max-w-sm" value={name} onChange={(event) => setName(event.target.value)} placeholder="New list name" /><Button onClick={createSheet}><Plus size={16} /> Create list</Button></>}
      {!embedded && <select className="h-10 min-w-52 rounded-md border bg-white px-3 text-sm" value={active?.id ?? ""} onChange={(event) => setActiveId(event.target.value)}><option value="">Choose a saved list</option>{sheets.map((sheet, index) => <option key={`${sheet.id}-${index}`} value={sheet.id}>{sheet.name}</option>)}</select>}
      <Button type="button" variant="outline" onClick={() => void deleteSheet()} disabled={!active} title="Delete entire list"><Trash2 size={16} /> Delete list</Button>
      <Button variant="outline" onClick={exportSheet} disabled={!active}><Upload size={16} /> Export sheet</Button>
      <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border bg-white px-4 text-sm font-medium hover:bg-muted"><Download size={16} /> Import sheet<input className="hidden" type="file" accept=".csv,.xlsx,.xls" onChange={importSheet} /></label>
    </div>
    {!active ? <div className="rounded-lg border bg-white p-10 text-center text-muted-foreground">Create a list to start entering rows.</div> : <>
      <div className="flex flex-wrap items-center gap-2"><Button onClick={addRow}><Plus size={16} /> Add row</Button><Input className="max-w-xs" value={columnName} onChange={(event) => setColumnName(event.target.value)} placeholder="New column name" /><Button variant="outline" onClick={addColumn}>Add column</Button><span className="text-sm text-muted-foreground">{cloud ? "Saved to the academy database" : "Saved in this browser while offline"}</span></div>
      <div className="max-h-[70vh] overflow-auto rounded-lg border bg-white"><table className="min-w-max border-collapse text-sm"><thead className="sticky top-0 z-10 bg-[#1B4332] text-white"><tr>{active.columns.map((column, columnIndex) => <th key={`${column}-${columnIndex}`} className="min-w-44 border-r border-white/20 px-3 py-3 text-left">{column}</th>)}<th className="sticky right-0 bg-[#1B4332] px-3 py-3">Actions</th></tr></thead><tbody>{active.rows.map((row, rowIndex) => <tr key={`${active.id}-${rowIndex}`} className={rowIndex % 2 ? "bg-[#F5F1EA]" : "bg-white"}>{active.columns.map((column, columnIndex) => <td key={`${column}-${columnIndex}`} className="border-b border-r p-1"><Input className="min-w-40 border-transparent bg-transparent" value={row[column] ?? ""} onChange={(event) => updateCell(rowIndex, column, event.target.value)} /></td>)}<td className="sticky right-0 border-b bg-inherit p-2"><Button size="icon" variant="ghost" onClick={() => deleteRow(rowIndex)} aria-label="Delete row"><Trash2 size={16} /></Button></td></tr>)}</tbody></table>{!active.rows.length && <p className="p-8 text-center text-muted-foreground">No rows yet. Add a row to begin.</p>}</div>
    </>}
  </div>;
}
