"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Download, Plus, Search, Trash2, Upload, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { exportExcel, readExcel } from "@/lib/excel";

type ManualSheet = { id: string; name: string; columns: string[]; rows: Array<Record<string, string>>; assigned_sales_ids?: string[] };
type ClassOption = { id: string; name: string; level?: string | null; learning_mode?: string | null; class_status?: string | null };
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
  return { ...sheet, columns: uniqueColumns(sheet.columns), assigned_sales_ids: sheet.assigned_sales_ids ?? [] };
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

export function ManualLeadSheet({ initialSheetId, embedded = false, onDeleted, canManage = false, salesReps = [], canConvert = false, canEdit = true }: { initialSheetId?: string; embedded?: boolean; onDeleted?: () => void; canManage?: boolean; salesReps?: Array<{ id: string; full_name: string }>; canConvert?: boolean; canEdit?: boolean }) {
  const [sheets, setSheets] = useState<ManualSheet[]>([]);
  const [activeId, setActiveId] = useState("");
  const [name, setName] = useState("");
  const [columnName, setColumnName] = useState("");
  const [ready, setReady] = useState(false);
  const [cloud, setCloud] = useState(false);
  const [sheetQuery, setSheetQuery] = useState("");
  const [sheetSearchOpen, setSheetSearchOpen] = useState(false);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [transferRowIndex, setTransferRowIndex] = useState<number | null>(null);
  const [transferClassId, setTransferClassId] = useState("");
  const [transferMessage, setTransferMessage] = useState("");
  const [transferring, setTransferring] = useState(false);
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
    void fetch("/api/manual-sheets/options", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) return;
      const json = await response.json() as { classes?: ClassOption[] };
      setClasses(json.classes ?? []);
    }).catch(() => setClasses([]));
  }, []);

  useEffect(() => {
    if (ready && !cloud) {
      localStorage.setItem(storageKey, JSON.stringify(sheets));
      window.dispatchEvent(new Event("fd-manual-sheets-updated"));
    }
    if (ready && cloud && canEdit) {
      void Promise.all(sheets.map((sheet) => fetch("/api/manual-sheets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sheet) })))
        .then(() => window.dispatchEvent(new Event("fd-manual-sheets-updated")));
    }
  }, [ready, cloud, sheets, canEdit]);

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

  function assignSheet(repId: string, checked: boolean) {
    if (!canManage) return;
    updateSheet((sheet) => {
      const assigned = new Set(sheet.assigned_sales_ids ?? []);
      if (checked) assigned.add(repId); else assigned.delete(repId);
      return { ...sheet, assigned_sales_ids: [...assigned] };
    });
  }

  function findValue(row: Record<string, string>, aliases: string[]) {
    const normalize = (value: string) => value.toLowerCase().replace(/[\s_-]/g, "");
    const match = Object.keys(row).find((key) => aliases.some((alias) => normalize(key) === normalize(alias)));
    return match ? String(row[match] ?? "") : "";
  }

  function openTransfer(rowIndex: number) {
    setTransferRowIndex(rowIndex);
    setTransferClassId("");
    setTransferMessage("");
  }

  async function convertRow() {
    if (transferRowIndex === null) return;
    if (!active) return;
    const rowIndex = transferRowIndex;
    const row = active.rows[rowIndex];
    const fullName = findValue(row, ["Name", "Full name", "Student name"]);
    const phone = findValue(row, ["Phone", "Number", "Mobile"]);
    if (!fullName || !phone) { setTransferMessage("Name and phone are required in this row."); return; }
    setTransferring(true);
    const response = await fetch("/api/manual-sheets/convert", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sheet_id: active.id, row_index: rowIndex, full_name: fullName, phone, email: findValue(row, ["Email", "E-mail"]), level: findValue(row, ["Level", "Niveau"]), class_id: transferClassId || null }) });
    const result = await response.json() as { studentId?: string };
    setTransferring(false);
    if (!response.ok || !result.studentId) { setTransferMessage("The student could not be transferred."); return; }
    updateSheet((sheet) => ({ ...sheet, rows: sheet.rows.map((item, index) => index === rowIndex ? { ...item, __converted_student_id: result.studentId ?? "" } : item) }));
    setTransferRowIndex(null);
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
      {canEdit && (!embedded || !active) && <><Input className="max-w-sm" value={name} onChange={(event) => setName(event.target.value)} placeholder="New list name" /><Button onClick={createSheet}><Plus size={16} /> Create list</Button></>}
      {!embedded && <><Button type="button" size="icon" variant={sheetSearchOpen ? "default" : "outline"} onClick={() => setSheetSearchOpen((open) => !open)} title="Search saved lists" aria-label="Search saved lists"><Search size={16} /></Button>{sheetSearchOpen && <Input autoFocus className="w-52" value={sheetQuery} onChange={(event) => setSheetQuery(event.target.value)} placeholder="Search saved lists..." />}<select className="h-10 min-w-52 rounded-md border bg-white px-3 text-sm" value={active?.id ?? ""} onChange={(event) => setActiveId(event.target.value)}><option value="">Choose a saved list</option>{sheets.filter((sheet) => !sheetQuery.trim() || sheet.name.toLowerCase().includes(sheetQuery.toLowerCase())).map((sheet, index) => <option key={`${sheet.id}-${index}`} value={sheet.id}>{sheet.name}</option>)}</select></>}
      {canManage && <Button type="button" variant="outline" onClick={() => void deleteSheet()} disabled={!active} title="Delete entire list"><Trash2 size={16} /> Delete list</Button>}
      {canManage && active && salesReps.length > 0 && <details className="relative"><summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-md border bg-white px-3 text-sm font-medium"><Users size={16} /> Assign sales</summary><div className="absolute right-0 z-20 mt-2 min-w-64 rounded-md border bg-white p-3 shadow-lg"><p className="mb-2 text-xs font-semibold text-muted-foreground">Sales people who can see this sheet</p>{salesReps.map((rep) => <label key={rep.id} className="flex items-center gap-2 py-1 text-sm"><input type="checkbox" checked={(active.assigned_sales_ids ?? []).includes(rep.id)} onChange={(event) => assignSheet(rep.id, event.target.checked)} />{rep.full_name}</label>)}</div></details>}
      <Button variant="outline" onClick={exportSheet} disabled={!active}><Upload size={16} /> Export sheet</Button>
      {canEdit && <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border bg-white px-4 text-sm font-medium hover:bg-muted"><Download size={16} /> Import sheet<input className="hidden" type="file" accept=".csv,.xlsx,.xls" onChange={importSheet} /></label>}
    </div>
    {!embedded && <div className="overflow-x-auto rounded-lg border bg-[#F5F1EA] p-2"><div className="flex min-w-max items-end gap-1" role="tablist" aria-label="Saved sheets">{sheets.filter((sheet) => !sheetQuery.trim() || sheet.name.toLowerCase().includes(sheetQuery.toLowerCase())).map((sheet) => <button key={sheet.id} type="button" role="tab" aria-selected={active?.id === sheet.id} onClick={() => setActiveId(sheet.id)} className={`rounded-t-md border px-4 py-2 text-sm font-medium transition-colors ${active?.id === sheet.id ? "border-b-white bg-white text-[#1B4332]" : "border-transparent text-muted-foreground hover:bg-white/70"}`}>{sheet.name}</button>)}</div></div>}
    {!active ? <div className="rounded-lg border bg-white p-10 text-center text-muted-foreground">Create a list to start entering rows.</div> : <>
      {canEdit && <div className="flex flex-wrap items-center gap-2"><Button onClick={addRow}><Plus size={16} /> Add row</Button><Input className="max-w-xs" value={columnName} onChange={(event) => setColumnName(event.target.value)} placeholder="New column name" /><Button variant="outline" onClick={addColumn}>Add column</Button><span className="text-sm text-muted-foreground">{cloud ? "Saved to the academy database" : "Saved in this browser while offline"}</span></div>}
      <div className="max-h-[70vh] overflow-auto rounded-lg border bg-white"><table className="min-w-max border-collapse text-sm"><thead className="sticky top-0 z-10 bg-[#1B4332] text-white"><tr>{active.columns.map((column, columnIndex) => <th key={`${column}-${columnIndex}`} className="min-w-44 border-r border-white/20 px-3 py-3 text-left">{column}</th>)}<th className="sticky right-0 bg-[#1B4332] px-3 py-3">Actions</th></tr></thead><tbody>{active.rows.map((row, rowIndex) => <tr key={`${active.id}-${rowIndex}`} className={rowIndex % 2 ? "bg-[#F5F1EA]" : "bg-white"}>{active.columns.map((column, columnIndex) => <td key={`${column}-${columnIndex}`} className="border-b border-r p-1"><Input disabled={!canEdit} className="min-w-40 border-transparent bg-transparent" value={row[column] ?? ""} onChange={(event) => updateCell(rowIndex, column, event.target.value)} /></td>)}<td className="sticky right-0 border-b bg-inherit p-2"><div className="flex items-center gap-1">{canConvert && <Button size="sm" variant="outline" disabled={Boolean(row.__converted_student_id)} onClick={() => openTransfer(rowIndex)}>{row.__converted_student_id ? "In students" : "Transfer to student"}</Button>}{canEdit && <Button size="icon" variant="ghost" onClick={() => deleteRow(rowIndex)} aria-label="Delete row"><Trash2 size={16} /></Button>}</div></td></tr>)}</tbody></table>{!active.rows.length && <p className="p-8 text-center text-muted-foreground">No rows yet. Add a row to begin.</p>}</div>
      {transferRowIndex !== null && active.rows[transferRowIndex] && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Transfer lead to student"><div className="w-full max-w-lg rounded-xl border border-[#D4AF37] bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">Transfer to students</h2><p className="mt-1 text-sm text-muted-foreground">Create the student and assign a class or group now.</p></div><Button size="icon" variant="ghost" onClick={() => setTransferRowIndex(null)} aria-label="Close"><X size={18} /></Button></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-md border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">Name</p><p className="font-semibold">{findValue(active.rows[transferRowIndex], ["Name", "Full name", "Student name"]) || "Not provided"}</p></div><div className="rounded-md border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">Phone</p><p className="font-semibold">{findValue(active.rows[transferRowIndex], ["Phone", "Number", "Mobile"]) || "Not provided"}</p></div></div><label className="mt-4 block text-sm font-medium">Class / group<select className="mt-1 h-11 w-full rounded-md border bg-white px-3" value={transferClassId} onChange={(event) => setTransferClassId(event.target.value)}><option value="">No class yet</option>{classes.map((classOption) => <option key={classOption.id} value={classOption.id}>{classOption.name}{classOption.level ? ` · ${classOption.level}` : ""}{classOption.class_status ? ` · ${classOption.class_status}` : ""}</option>)}</select></label>{!classes.length && <p className="mt-2 text-sm text-amber-700">No classes are available yet. The student will be created without a class.</p>}{transferMessage && <p className="mt-3 text-sm text-red-600">{transferMessage}</p>}<div className="mt-6 flex justify-end gap-2"><Button variant="outline" onClick={() => setTransferRowIndex(null)}>Cancel</Button><Button onClick={() => void convertRow()} disabled={transferring}>{transferring ? "Transferring..." : "Create student and assign"}</Button></div></div></div>}
    </>}
  </div>;
}
