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

export function ManualLeadSheet({ initialSheetId, embedded = false }: { initialSheetId?: string; embedded?: boolean }) {
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
      const stored = json.sheets ?? [];
      setSheets(stored);
      setActiveId(initialSheetId ?? stored[0]?.id ?? "");
      setCloud(true);
      setReady(true);
    }).catch(() => {
      try {
        const stored = JSON.parse(localStorage.getItem(storageKey) ?? "[]") as ManualSheet[];
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
      for (const sheet of sheets) {
        void fetch("/api/manual-sheets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sheet) });
      }
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

  function exportSheet() {
    if (!active) return;
    exportExcel(`${active.name.replace(/\s+/g, "-").toLowerCase()}.xlsx`, active.rows, active.name, { widths: active.columns.map(() => 24) });
  }

  async function importSheet(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const parsed = await readExcel(file);
    const columns = Object.keys(parsed[0] ?? {});
    if (!columns.length) return;
    const sheet: ManualSheet = { id: newId(), name: file.name.replace(/\.[^.]+$/, ""), columns, rows: parsed.map((row) => Object.fromEntries(columns.map((column) => [column, String(row[column] ?? "")])) ) };
    setSheets((current) => [...current, sheet]);
    setActiveId(sheet.id);
    event.target.value = "";
  }

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-white p-4">
      {(!embedded || !active) && <><Input className="max-w-sm" value={name} onChange={(event) => setName(event.target.value)} placeholder="New list name" /><Button onClick={createSheet}><Plus size={16} /> Create list</Button></>}
      {!embedded && <select className="h-10 min-w-52 rounded-md border bg-white px-3 text-sm" value={active?.id ?? ""} onChange={(event) => setActiveId(event.target.value)}><option value="">Choose a saved list</option>{sheets.map((sheet) => <option key={sheet.id} value={sheet.id}>{sheet.name}</option>)}</select>}
      <Button variant="outline" onClick={exportSheet} disabled={!active}><Download size={16} /> Export sheet</Button>
      <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border bg-white px-4 text-sm font-medium hover:bg-muted"><Upload size={16} /> Import sheet<input className="hidden" type="file" accept=".csv,.xlsx,.xls" onChange={importSheet} /></label>
    </div>
    {!active ? <div className="rounded-lg border bg-white p-10 text-center text-muted-foreground">Create a list to start entering rows.</div> : <>
      <div className="flex flex-wrap items-center gap-2"><Button onClick={addRow}><Plus size={16} /> Add row</Button><Input className="max-w-xs" value={columnName} onChange={(event) => setColumnName(event.target.value)} placeholder="New column name" /><Button variant="outline" onClick={addColumn}>Add column</Button><span className="text-sm text-muted-foreground">{cloud ? "Saved to the academy database" : "Saved in this browser while offline"}</span></div>
      <div className="max-h-[70vh] overflow-auto rounded-lg border bg-white"><table className="min-w-max border-collapse text-sm"><thead className="sticky top-0 z-10 bg-[#1B4332] text-white"><tr>{active.columns.map((column) => <th key={column} className="min-w-44 border-r border-white/20 px-3 py-3 text-left">{column}</th>)}<th className="sticky right-0 bg-[#1B4332] px-3 py-3">Actions</th></tr></thead><tbody>{active.rows.map((row, rowIndex) => <tr key={`${active.id}-${rowIndex}`} className={rowIndex % 2 ? "bg-[#F5F1EA]" : "bg-white"}>{active.columns.map((column) => <td key={column} className="border-b border-r p-1"><Input className="min-w-40 border-transparent bg-transparent" value={row[column] ?? ""} onChange={(event) => updateCell(rowIndex, column, event.target.value)} /></td>)}<td className="sticky right-0 border-b bg-inherit p-2"><Button size="icon" variant="ghost" onClick={() => deleteRow(rowIndex)} aria-label="Delete row"><Trash2 size={16} /></Button></td></tr>)}</tbody></table>{!active.rows.length && <p className="p-8 text-center text-muted-foreground">No rows yet. Add a row to begin.</p>}</div>
    </>}
  </div>;
}
