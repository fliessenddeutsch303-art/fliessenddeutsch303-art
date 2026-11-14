"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Download, Plus, Search, Trash2, Upload, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { exportExcel, readExcel } from "@/lib/excel";
import { normalizePhone } from "@/lib/phone";
import { NAME_ALIASES, PHONE_ALIASES, findColumn } from "@/lib/lead-columns";

type ManualSheet = { id: string; name: string; columns: string[]; rows: Array<Record<string, string>>; assigned_sales_ids?: string[]; updated_at?: string };
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

export function ManualLeadSheet({ initialSheetId, embedded = false, onDeleted, canManage = false, salesReps = [], canConvert = false, canEdit = true, newList = false }: { initialSheetId?: string; embedded?: boolean; onDeleted?: () => void; canManage?: boolean; salesReps?: Array<{ id: string; full_name: string }>; canConvert?: boolean; canEdit?: boolean; newList?: boolean }) {
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
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");
  const [conflicts, setConflicts] = useState<Set<string>>(new Set());
  const [dirtyTick, setDirtyTick] = useState(0);
  const [transferNameCol, setTransferNameCol] = useState("");
  const [transferPhoneCol, setTransferPhoneCol] = useState("");
  const [transferDuplicate, setTransferDuplicate] = useState("");
  const hydratedRef = useRef(false);
  const dirtyRef = useRef(new Map<string, number>());
  const conflictRef = useRef(new Set<string>());
  const savingRef = useRef(false);
  const sheetsRef = useRef<ManualSheet[]>([]);
  sheetsRef.current = sheets;
  const active = useMemo(() => sheets.find((sheet) => sheet.id === activeId) ?? (newList ? undefined : sheets[0]), [sheets, activeId, newList]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/manual-sheets", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("Cloud sheets unavailable");
      const json = await response.json() as { sheets?: ManualSheet[]; unavailable?: boolean };
      // The API answers 200 with `unavailable` when the cloud table is not installed; saving would then fail.
      if (json.unavailable) throw new Error("Cloud sheets unavailable");
      if (cancelled) return;
      const stored = normalizeSheets(json.sheets ?? []);
      // Keep sheets with unsaved edits; everything else takes the server copy.
      const kept = sheetsRef.current.filter((sheet) => dirtyRef.current.has(sheet.id));
      stored.forEach((sheet) => { if (!dirtyRef.current.has(sheet.id)) conflictRef.current.delete(sheet.id); });
      setConflicts(new Set(conflictRef.current));
      setSheets([...stored.filter((sheet) => !kept.some((item) => item.id === sheet.id)), ...kept]);
      setActiveId(initialSheetId ?? (newList ? "" : stored[0]?.id ?? ""));
      setCloud(true);
      setReady(true);
      hydratedRef.current = true;
    }).catch(() => {
      try {
        const stored = normalizeSheets(JSON.parse(localStorage.getItem(storageKey) ?? "[]") as ManualSheet[]);
        if (!cancelled) {
          setSheets(stored);
          setActiveId(initialSheetId ?? (newList ? "" : stored[0]?.id ?? ""));
        }
      } catch {
        if (!cancelled) setSheets([]);
      }
      if (!cancelled) setReady(true);
    });
    return () => { cancelled = true; };
  }, [initialSheetId, newList]);

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
    if (!ready || !cloud || !canEdit || !hydratedRef.current || !dirtyRef.current.size) return;
    const timer = window.setTimeout(() => void saveDirty(), 450);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, cloud, canEdit, sheets, dirtyTick]);

  function markDirty(id: string) {
    dirtyRef.current.set(id, (dirtyRef.current.get(id) ?? 0) + 1);
    setDirtyTick((tick) => tick + 1);
  }

  /** Posts only sheets the user changed; a sheet changed elsewhere is held back until reloaded. */
  async function saveDirty() {
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      for (const [id, rev] of [...dirtyRef.current]) {
        const sheet = sheetsRef.current.find((item) => item.id === id);
        if (!sheet) { dirtyRef.current.delete(id); continue; }
        if (conflictRef.current.has(id)) continue;
        try {
          const response = await fetch("/api/manual-sheets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sheet) });
          const json = await response.json().catch(() => ({})) as { error?: string; updated_at?: string };
          if (response.status === 409) {
            conflictRef.current.add(id);
            setConflicts(new Set(conflictRef.current));
            continue;
          }
          if (!response.ok) { setSaveError(`Changes were NOT saved: ${json.error ?? `HTTP ${response.status}`}`); continue; }
          setSaveError("");
          if (dirtyRef.current.get(id) === rev) dirtyRef.current.delete(id);
          if (json.updated_at) setSheets((current) => current.map((item) => item.id === id ? { ...item, updated_at: json.updated_at } : item));
          window.dispatchEvent(new Event("fd-manual-sheets-updated"));
        } catch {
          setSaveError("Changes were NOT saved: the connection was lost. Keep this page open and try again.");
        }
      }
    } finally {
      savingRef.current = false;
    }
    if ([...dirtyRef.current.keys()].some((id) => !conflictRef.current.has(id))) setDirtyTick((tick) => tick + 1);
  }

  function createSheet() {
    const sheet: ManualSheet = { id: newId(), name: name.trim() || `Manual list ${sheets.length + 1}`, columns: [...defaultColumns], rows: [] };
    setSheets((current) => [...current, sheet]);
    setActiveId(sheet.id);
    markDirty(sheet.id);
    setName("");
  }

  function updateSheet(update: (sheet: ManualSheet) => ManualSheet) {
    if (!active) return;
    setSheets((current) => current.map((sheet) => sheet.id === active.id ? update(sheet) : sheet));
    markDirty(active.id);
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

  const dataColumns = (sheet: ManualSheet) => sheet.columns.filter((column) => !column.startsWith("__"));
  const nameColumnOf = (sheet: ManualSheet) => transferNameCol || findColumn(dataColumns(sheet), NAME_ALIASES) || "";
  const phoneColumnOf = (sheet: ManualSheet) => transferPhoneCol || findColumn(dataColumns(sheet), PHONE_ALIASES) || "";
  const valueIn = (sheet: ManualSheet, row: Record<string, string>, aliases: string[]) => { const column = findColumn(dataColumns(sheet), aliases); return column ? String(row[column] ?? "") : ""; };

  function openTransfer(rowIndex: number) {
    setTransferRowIndex(rowIndex);
    setTransferClassId("");
    setTransferMessage("");
    setTransferNameCol("");
    setTransferPhoneCol("");
    setTransferDuplicate("");
  }

  async function convertRow(force = false) {
    if (transferRowIndex === null) return;
    if (!active) return;
    const rowIndex = transferRowIndex;
    const row = active.rows[rowIndex];
    const nameColumn = nameColumnOf(active);
    const phoneColumn = phoneColumnOf(active);
    const fullName = nameColumn ? String(row[nameColumn] ?? "").trim() : "";
    const phone = phoneColumn ? String(row[phoneColumn] ?? "").trim() : "";
    if (!fullName || !phone) { setTransferMessage("Name and phone are required in this row."); return; }
    setTransferring(true);
    setTransferMessage("");
    // The server reads the stored row, so pending edits must be saved first.
    if (dirtyRef.current.has(active.id)) {
      await saveDirty();
      if (dirtyRef.current.has(active.id) || conflictRef.current.has(active.id)) { setTransferring(false); setTransferMessage("Save the pending changes to this sheet before transferring (see the message above)."); return; }
    }
    const response = await fetch("/api/manual-sheets/convert", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sheet_id: active.id, row_index: rowIndex, full_name: fullName, phone, name_column: nameColumn, phone_column: phoneColumn, class_id: transferClassId || null, force }) }).catch(() => null);
    const result = (await response?.json().catch(() => ({})) ?? {}) as { studentId?: string; error?: string; updated_at?: string; duplicate?: { full_name: string } };
    setTransferring(false);
    if (!response) { setTransferMessage("The connection was lost. Try again."); return; }
    if (response.status === 409 && result.duplicate) { setTransferDuplicate(result.duplicate.full_name); setTransferMessage(result.error ?? ""); return; }
    if (!response.ok || !result.studentId) { setTransferMessage(result.error ?? "The student could not be transferred."); return; }
    // The server already stored the marker and bumped updated_at, so this is not an unsaved edit.
    setSheets((current) => current.map((sheet) => sheet.id === active.id ? { ...sheet, updated_at: result.updated_at ?? sheet.updated_at, rows: sheet.rows.map((item, index) => index === rowIndex ? { ...item, __converted_student_id: result.studentId ?? "" } : item) } : sheet));
    setTransferRowIndex(null);
  }

  async function deleteSheet() {
    if (!active || !window.confirm(`Delete the entire list "${active.name}"?`)) return;
    if (cloud) {
      const response = await fetch("/api/manual-sheets", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: active.id }) }).catch(() => null);
      if (!response) { setNotice("The list was not deleted: the connection was lost."); return; }
      if (!response.ok) {
        const json = await response.json().catch(() => ({})) as { error?: string };
        setNotice(`The list was not deleted: ${json.error ?? `HTTP ${response.status}`}`);
        return;
      }
    } else {
      const remaining = sheets.filter((sheet) => sheet.id !== active.id);
      localStorage.setItem(storageKey, JSON.stringify(remaining));
    }
    const remaining = sheets.filter((sheet) => sheet.id !== active.id);
    dirtyRef.current.delete(active.id);
    setNotice("");
    setSheets(remaining);
    setActiveId(remaining[0]?.id ?? "");
    window.dispatchEvent(new Event("fd-manual-sheets-updated"));
    onDeleted?.();
  }

  function exportSheet() {
    if (!active) return;
    const columns = dataColumns(active);
    exportExcel(`${active.name.replace(/\s+/g, "-").toLowerCase()}.xlsx`, active.rows.map((row) => Object.fromEntries(columns.map((column) => [column, row[column] ?? ""]))), active.name, { widths: columns.map(() => 24) });
  }

  async function importSheet(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const parsed = await readExcel(file);
      const sourceColumns = Object.keys(parsed[0] ?? {});
      if (!parsed.length || !sourceColumns.length) { setNotice("The file has no rows to import."); return; }
      const columns = uniqueColumns(sourceColumns);
      const phoneLike = columns.map((column, index) => Boolean(findColumn([sourceColumns[index]], PHONE_ALIASES)) || /phone|mobile|number|هاتف|موبايل|جوال|تليفون|واتساب/i.test(sourceColumns[index]));
      const sheet: ManualSheet = { id: newId(), name: file.name.replace(/\.[^.]+$/, ""), columns, rows: parsed.map((row) => Object.fromEntries(columns.map((column, index) => [column, phoneLike[index] ? normalizePhone(row[sourceColumns[index]]) : String(row[sourceColumns[index]] ?? "")]))) };
      setSheets((current) => [...current, sheet]);
      setActiveId(sheet.id);
      markDirty(sheet.id);
      setNotice("");
    } catch {
      setNotice("The file could not be read. Check that it is a valid .xlsx, .xls or .csv file.");
    } finally {
      input.value = "";
    }
  }

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-white p-4">
      {canEdit && (!embedded || !active || newList) && <><Input className="max-w-sm" value={name} onChange={(event) => setName(event.target.value)} placeholder="New list name" /><Button onClick={createSheet}><Plus size={16} /> Create list</Button></>}
      {!embedded && <><Button type="button" size="icon" variant={sheetSearchOpen ? "default" : "outline"} onClick={() => setSheetSearchOpen((open) => !open)} title="Search saved lists" aria-label="Search saved lists"><Search size={16} /></Button>{sheetSearchOpen && <Input autoFocus className="w-52" value={sheetQuery} onChange={(event) => setSheetQuery(event.target.value)} data-search placeholder="Search saved lists..." />}<select className="h-10 min-w-52 rounded-md border bg-white px-3 text-sm" value={active?.id ?? ""} onChange={(event) => setActiveId(event.target.value)}><option value="">Choose a saved list</option>{sheets.filter((sheet) => !sheetQuery.trim() || sheet.name.toLowerCase().includes(sheetQuery.toLowerCase())).map((sheet, index) => <option key={`${sheet.id}-${index}`} value={sheet.id}>{sheet.name}</option>)}</select></>}
      {canManage && <Button type="button" variant="outline" onClick={() => void deleteSheet()} disabled={!active} title="Delete entire list"><Trash2 size={16} /> Delete list</Button>}
      {canManage && active && salesReps.length > 0 && <details className="relative"><summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-md border bg-white px-3 text-sm font-medium"><Users size={16} /> Assign sales</summary><div className="absolute right-0 z-20 mt-2 min-w-64 rounded-md border bg-white p-3 shadow-lg"><p className="mb-2 text-xs font-semibold text-muted-foreground">Sales people who can see this sheet</p>{salesReps.map((rep) => <label key={rep.id} className="flex items-center gap-2 py-1 text-sm"><input type="checkbox" checked={(active.assigned_sales_ids ?? []).includes(rep.id)} onChange={(event) => assignSheet(rep.id, event.target.checked)} />{rep.full_name}</label>)}</div></details>}
      <Button variant="outline" onClick={exportSheet} disabled={!active}><Upload size={16} /> Export sheet</Button>
      {canEdit && <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border bg-white px-4 text-sm font-medium hover:bg-muted"><Download size={16} /> Import sheet<input className="hidden" type="file" accept=".csv,.xlsx,.xls" onChange={importSheet} /></label>}
    </div>
    {!embedded && <div className="overflow-x-auto rounded-lg border bg-[#F5F1EA] p-2"><div className="flex min-w-max items-end gap-1" role="tablist" aria-label="Saved sheets">{sheets.filter((sheet) => !sheetQuery.trim() || sheet.name.toLowerCase().includes(sheetQuery.toLowerCase())).map((sheet) => <button key={sheet.id} type="button" role="tab" aria-selected={active?.id === sheet.id} onClick={() => setActiveId(sheet.id)} className={`rounded-t-md border px-4 py-2 text-sm font-medium transition-colors ${active?.id === sheet.id ? "border-b-white bg-white text-[#1B4332]" : "border-transparent text-muted-foreground hover:bg-white/70"}`}>{sheet.name}</button>)}</div></div>}
    {!active ? <div className="rounded-lg border bg-white p-10 text-center text-muted-foreground">Create a list to start entering rows.</div> : <>
      {canEdit && <div className="flex flex-wrap items-center gap-2"><Button onClick={addRow}><Plus size={16} /> Add row</Button><Input className="max-w-xs" value={columnName} onChange={(event) => setColumnName(event.target.value)} placeholder="New column name" /><Button variant="outline" onClick={addColumn}>Add column</Button>{active && conflicts.has(active.id) ? <span className="text-sm font-semibold text-red-700">This sheet was changed by someone else. Reload to get the latest version. <button type="button" className="underline" onClick={() => window.location.reload()}>Reload</button></span> : <span className={`text-sm ${saveError ? "font-semibold text-red-700" : cloud ? "text-muted-foreground" : "text-amber-700"}`}>{saveError || (cloud ? "Saved to the academy database" : "Cloud sheets are unavailable — this list is saved only in this browser")}</span>}</div>}
      {notice && <p className="text-sm font-semibold text-red-700">{notice}</p>}
      <div className="max-h-[70vh] overflow-auto rounded-lg border bg-white"><table className="min-w-max border-collapse text-sm"><thead className="sticky top-0 z-10 bg-[#1B4332] text-white"><tr>{active.columns.map((column, columnIndex) => <th key={`${column}-${columnIndex}`} className="min-w-44 border-r border-white/20 px-3 py-3 text-left">{column}</th>)}<th className="sticky right-0 bg-[#1B4332] px-3 py-3">Actions</th></tr></thead><tbody>{active.rows.map((row, rowIndex) => <tr key={`${active.id}-${rowIndex}`} className={rowIndex % 2 ? "bg-[#F5F1EA]" : "bg-white"}>{active.columns.map((column, columnIndex) => <td key={`${column}-${columnIndex}`} className="border-b border-r p-1"><Input disabled={!canEdit} className="min-w-40 border-transparent bg-transparent" value={row[column] ?? ""} onChange={(event) => updateCell(rowIndex, column, event.target.value)} /></td>)}<td className="sticky right-0 border-b bg-inherit p-2"><div className="flex items-center gap-1">{canConvert && <Button size="sm" variant="outline" disabled={Boolean(row.__converted_student_id) || !active.updated_at} title={active.updated_at ? undefined : "Save the sheet before transferring rows"} onClick={() => openTransfer(rowIndex)}>{row.__converted_student_id ? "In students" : "Transfer to student"}</Button>}{canEdit && <Button size="icon" variant="ghost" onClick={() => deleteRow(rowIndex)} aria-label="Delete row"><Trash2 size={16} /></Button>}</div></td></tr>)}</tbody></table>{!active.rows.length && <p className="p-8 text-center text-muted-foreground">No rows yet. Add a row to begin.</p>}</div>
      {transferRowIndex !== null && active.rows[transferRowIndex] && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Transfer lead to student"><div className="w-full max-w-lg rounded-xl border border-[#D4AF37] bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">Transfer to students</h2><p className="mt-1 text-sm text-muted-foreground">Create the student and assign a class or group now.</p></div><Button size="icon" variant="ghost" onClick={() => setTransferRowIndex(null)} aria-label="Close"><X size={18} /></Button></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-md border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">Name</p><p className="font-semibold">{String(active.rows[transferRowIndex][nameColumnOf(active)] ?? "") || "Not provided"}</p></div><div className="rounded-md border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">Phone</p><p className="font-semibold">{String(active.rows[transferRowIndex][phoneColumnOf(active)] ?? "") || "Not provided"}</p></div></div>{(!findColumn(dataColumns(active), NAME_ALIASES) || !findColumn(dataColumns(active), PHONE_ALIASES)) && <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="block text-sm font-medium">Name column<select className="mt-1 h-11 w-full rounded-md border bg-white px-3" value={transferNameCol} onChange={(event) => setTransferNameCol(event.target.value)}><option value="">Choose column</option>{dataColumns(active).map((column) => <option key={column} value={column}>{column}</option>)}</select></label><label className="block text-sm font-medium">Phone column<select className="mt-1 h-11 w-full rounded-md border bg-white px-3" value={transferPhoneCol} onChange={(event) => setTransferPhoneCol(event.target.value)}><option value="">Choose column</option>{dataColumns(active).map((column) => <option key={column} value={column}>{column}</option>)}</select></label></div>}<label className="mt-4 block text-sm font-medium">Class / group<select className="mt-1 h-11 w-full rounded-md border bg-white px-3" value={transferClassId} onChange={(event) => setTransferClassId(event.target.value)}><option value="">No class yet</option>{classes.map((classOption) => <option key={classOption.id} value={classOption.id}>{classOption.name}{classOption.level ? ` · ${classOption.level}` : ""}{classOption.class_status ? ` · ${classOption.class_status}` : ""}</option>)}</select></label>{!classes.length && <p className="mt-2 text-sm text-amber-700">No classes are available yet. The student will be created without a class.</p>}{transferMessage && <p className="mt-3 text-sm text-red-600">{transferMessage}</p>}<div className="mt-6 flex justify-end gap-2"><Button variant="outline" onClick={() => setTransferRowIndex(null)}>Cancel</Button><Button onClick={() => void convertRow(Boolean(transferDuplicate))} disabled={transferring}>{transferring ? "Transferring..." : transferDuplicate ? "Create anyway" : "Create student and assign"}</Button></div></div></div>}
    </>}
  </div>;
}
