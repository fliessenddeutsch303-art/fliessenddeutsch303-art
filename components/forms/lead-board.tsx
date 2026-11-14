"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Download, MessageCircle, MessageSquarePlus, Phone, Plus, Search, Upload, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { exportExcel, normalizePhone, readExcel, type ExcelRow } from "@/lib/excel";
import { hasSupabaseEnv } from "@/lib/env";
import { toWhatsApp } from "@/lib/utils";
import { academyDateOf } from "@/lib/dates";
import { NAME_ALIASES, PHONE_ALIASES } from "@/lib/lead-columns";
import { ManualLeadSheet } from "@/components/forms/manual-lead-sheet";

type Interaction = { id: string; note: string; created_at: string; users?: { full_name: string } | null };
type CrmData = Record<string, string>;
type Lead = {
  id: string;
  full_name: string;
  phone: string;
  source?: string | null;
  tags?: string[] | null;
  assigned_to?: string | null;
  status: string;
  created_at: string;
  converted_to_student_id?: string | null;
  crm_data?: CrmData | null;
  lead_interactions?: Interaction[];
};

const PAGE_SIZE = 25;
const statuses = ["new", "interested", "thinking", "no_answer", "booked", "not_interested", "waiting"];
const sheetColumns = [
  { key: "full_name", label: "Name", type: "text" },
  { key: "phone", label: "Number", type: "text" },
  { key: "source", label: "Campaign / source", type: "text" },
  { key: "tags", label: "Tags", type: "text" },
  { key: "level", label: "Level", type: "text" },
  { key: "first_date", label: "Date 1", type: "date" },
  { key: "contact_1", label: "Contact 1", type: "text" },
  { key: "second_date", label: "Date 2", type: "date" },
  { key: "contact_2", label: "Contact 2", type: "text" },
  { key: "third_date", label: "Date 3", type: "date" },
  { key: "comment_hossam", label: "Comment 1", type: "text" },
  { key: "fourth_date", label: "Date 4", type: "date" },
  { key: "comment_kayther", label: "Comment 2", type: "text" },
  { key: "next_follow_up", label: "Next follow-up", type: "date" },
  { key: "reminder_date", label: "Reminder date", type: "date" },
  { key: "reminder_note", label: "Reminder note", type: "text" },
] as const;

function valueOf(lead: Lead, key: string) {
  if (key === "full_name") return lead.full_name;
  if (key === "phone") return lead.phone;
  if (key === "source") return lead.source ?? "";
  if (key === "tags") return (lead.tags ?? []).join(", ");
  return lead.crm_data?.[key] ?? "";
}

const isoDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

function normalize(value: unknown) {
  return String(value ?? "").trim();
}

function importedValue(row: ExcelRow, names: string[]) {
  const entry = Object.entries(row).find(([key]) => names.some((name) => key.toLowerCase().replace(/[\s_-]/g, "") === name.toLowerCase().replace(/[\s_-]/g, "")));
  return normalize(entry?.[1]);
}

type SalesRep = { id: string; full_name: string };

export function LeadBoard({ initialLeads, currentUserId, canAssign = false, reps = [] }: { initialLeads: Lead[]; currentUserId: string; canAssign?: boolean; reps?: SalesRep[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [listView, setListView] = useState<"active" | "waiting" | string>("active");
  const [manualSheets, setManualSheets] = useState<Array<{ id: string; name: string }>>([]);
  const [manualSheetQuery, setManualSheetQuery] = useState("");
  const [manualSheetSearchOpen, setManualSheetSearchOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAssignee, setBulkAssignee] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [followUpLeadId, setFollowUpLeadId] = useState<string | null>(null);
  const [followUpNote, setFollowUpNote] = useState("");
  const focusValues = useRef(new Map<string, string>());
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    const loadManualSheets = async () => {
      try {
        const response = await fetch("/api/manual-sheets", { cache: "no-store" });
        if (response.ok) {
          const json = await response.json() as { sheets?: Array<{ id: string; name: string }> };
          setManualSheets(json.sheets ?? []);
          return;
        }
      } catch { /* use local fallback while offline */ }
      try { setManualSheets(JSON.parse(localStorage.getItem("fd_manual_lead_sheets") ?? "[]")); } catch { setManualSheets([]); }
    };
    void loadManualSheets();
    const refresh = () => void loadManualSheets();
    window.addEventListener("fd-manual-sheets-updated", refresh);
    return () => window.removeEventListener("fd-manual-sheets-updated", refresh);
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return leads.filter((lead) => (listView === "waiting" ? lead.status === "waiting" : listView === "active" ? lead.status !== "waiting" : false) && (!needle || JSON.stringify(lead).toLowerCase().includes(needle)) && (!statusFilter || lead.status === statusFilter) && (!sourceFilter || (lead.source ?? "").toLowerCase().includes(sourceFilter.toLowerCase())) && (!tagFilter || (lead.tags ?? []).some((tag) => tag.toLowerCase().includes(tagFilter.toLowerCase()))));
  }, [leads, query, statusFilter, sourceFilter, tagFilter, listView]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selectedRows = filtered.filter((lead) => selected.has(lead.id));
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);

  function updateLocal(id: string, key: string, value: string) {
    setLeads((rows) => rows.map((lead) => {
      if (lead.id !== id) return lead;
      if (key === "full_name" || key === "phone" || key === "source") return { ...lead, [key]: value };
      if (key === "tags") return { ...lead, tags: value.split(",").map((tag) => tag.trim()).filter(Boolean) };
      return { ...lead, crm_data: { ...(lead.crm_data ?? {}), [key]: value } };
    }));
  }

  async function saveLeadValue(id: string, key: string, value: string, before?: string) {
    const column = sheetColumns.find((item) => item.key === key);
    // A date input cannot display a non-ISO imported string, so an empty read-back is not a change.
    const shown = before !== undefined && column?.type === "date" && !isoDay(before) ? "" : before;
    if (value === shown) return;
    setSaving(id);
    const { data: latest, error: readError } = await supabase.from("leads").select("full_name,phone,source,tags,crm_data").eq("id", id).single();
    if (readError || !latest) { setSaving(null); return setMessage(readError?.message ?? "Lead could not be loaded"); }
    const latestCrm = (latest.crm_data ?? {}) as CrmData;
    const changes: Record<string, unknown> = key === "full_name" || key === "phone" || key === "source" ? { [key]: value }
      : key === "tags" ? { tags: value.split(",").map((tag) => tag.trim()).filter(Boolean) }
      : { crm_data: { ...latestCrm, [key]: value } };
    const { error } = await supabase.from("leads").update(changes).eq("id", id);
    setSaving(null);
    if (error) return setMessage(error.message);
    const current = leads.find((item) => item.id === id);
    if (current) {
      const merged: Lead = { ...current, ...(changes as Partial<Lead>) };
      setLeads((rows) => rows.map((lead) => lead.id === id ? { ...lead, ...(changes as Partial<Lead>) } : lead));
      if (key === "reminder_date" || key === "reminder_note") await syncReminder(merged);
    }
    setMessage("Lead saved");
  }

  /** Reassignment goes through the API so the new rep also gets access to the leads' files. */
  async function runAssign(ids: string[], assignedTo: string | null) {
    if (!hasSupabaseEnv()) {
      const results = await Promise.all(ids.map((id) => supabase.from("leads").update({ assigned_to: assignedTo }).eq("id", id)));
      const updatedIds = ids.filter((_, index) => !results[index].error);
      return { updatedIds, failed: ids.length - updatedIds.length, error: results.find((result) => result.error)?.error?.message, warning: "" };
    }
    const response = await fetch("/api/leads/assign", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ leadIds: ids, assignedTo }) }).catch(() => null);
    const result = await response?.json().catch(() => ({})) as { updatedIds?: string[]; failed?: number; error?: string; warning?: string } | undefined;
    if (!response || !response.ok) return { updatedIds: [] as string[], failed: ids.length, error: result?.error ?? "Assignment failed", warning: "" };
    return { updatedIds: result?.updatedIds ?? [], failed: result?.failed ?? 0, error: result?.error, warning: result?.warning ?? "" };
  }

  function applyAssign(updatedIds: string[], assignedTo: string | null) {
    const done = new Set(updatedIds);
    setLeads((rows) => rows.map((lead) => done.has(lead.id) ? { ...lead, assigned_to: assignedTo } : lead));
  }

  async function assignLead(lead: Lead, assignedTo: string) {
    const target = assignedTo || null;
    const result = await runAssign([lead.id], target);
    applyAssign(result.updatedIds, target);
    setMessage(result.updatedIds.length ? `Lead assignment saved${result.warning ? `. ${result.warning}` : ""}` : result.error ?? "Lead assignment failed");
  }

  async function assignSelected() {
    const ids = selectedRows.map((lead) => lead.id);
    if (!ids.length) return setMessage("Select at least one lead first");
    const assignedTo = bulkAssignee === "__unassigned" ? null : bulkAssignee || null;
    setSaving("bulk");
    const result = await runAssign(ids, assignedTo);
    applyAssign(result.updatedIds, assignedTo);
    setSelected((current) => { const next = new Set(current); result.updatedIds.forEach((id) => next.delete(id)); return next; });
    setSaving(null);
    const done = result.updatedIds.length;
    setMessage(done ? `Assigned ${done} lead${done === 1 ? "" : "s"}${result.failed ? `, ${result.failed} failed${result.error ? `: ${result.error}` : ""}` : " successfully"}${result.warning ? `. ${result.warning}` : ""}` : result.error ?? "Assignment failed");
  }

  /** Creates, replaces or (when the date is cleared) removes the reminder for a lead. */
  async function syncReminder(lead: Lead) {
    const reminderDate = lead.crm_data?.reminder_date ?? "";
    if (reminderDate && !isoDay(reminderDate)) return;
    const note = lead.crm_data?.reminder_note || `Follow up with ${lead.full_name}`;
    if (hasSupabaseEnv()) {
      const response = await fetch("/api/lead-reminders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ leadId: lead.id, dueAt: reminderDate || null, note }) });
      if (!response.ok) setMessage((await response.json().catch(() => ({}))).error ?? "Reminder could not be saved");
      else window.dispatchEvent(new Event("fd-reminders-updated"));
      return;
    }
    const current = JSON.parse(localStorage.getItem("fd_lead_reminders") ?? "[]") as Array<Record<string, string>>;
    const next = [...current.filter((item) => item.leadId !== lead.id), ...(reminderDate ? [{ leadId: lead.id, leadName: lead.full_name, dueAt: reminderDate, note }] : [])];
    localStorage.setItem("fd_lead_reminders", JSON.stringify(next));
    window.dispatchEvent(new Event("fd-reminders-updated"));
  }

  /** Follow-ups feed the dashboard, reports and sales KPIs. */
  async function logInteraction(lead: Lead, note: string) {
    const { data, error } = await supabase.from("lead_interactions").insert({ lead_id: lead.id, note, created_by: currentUserId }).select("id,note,created_at").single();
    if (error) return error;
    const interaction = { ...(data as Interaction), users: null };
    setLeads((rows) => rows.map((item) => item.id === lead.id ? { ...item, lead_interactions: [interaction, ...(item.lead_interactions ?? [])] } : item));
    return null;
  }

  async function saveFollowUp(lead: Lead) {
    const note = followUpNote.trim();
    if (!note) return setMessage("Write a follow-up note first");
    const error = await logInteraction(lead, note);
    if (error) return setMessage(error.message);
    setFollowUpLeadId(null);
    setFollowUpNote("");
    setMessage("Follow-up logged");
  }

  async function setStatus(lead: Lead, status: string) {
    const { error } = await supabase.from("leads").update({ status }).eq("id", lead.id);
    if (!error) {
      const updated = { ...lead, status };
      setLeads((rows) => rows.map((item) => item.id === lead.id ? { ...updated, lead_interactions: item.lead_interactions } : item));
      const interactionError = await logInteraction(updated, `Status changed to ${status}`);
      if (interactionError) return setMessage(`Status saved, but the follow-up could not be logged: ${interactionError.message}`);
    }
    setMessage(error ? error.message : "Status saved");
  }

  async function convert(lead: Lead, force = false) {
    if (!hasSupabaseEnv()) {
      const { data, error } = await supabase.from("students").insert({ full_name: lead.full_name, phone: lead.phone, status: "active", enrolled_at: new Date().toISOString() }).select("id").single();
      if (error || !data) return setMessage(error?.message ?? "Could not convert lead");
      await supabase.from("leads").update({ converted_to_student_id: data.id, status: "booked" }).eq("id", lead.id);
      setLeads((rows) => rows.map((item) => item.id === lead.id ? { ...item, converted_to_student_id: data.id, status: "booked" } : item));
      return setMessage("Lead converted to student");
    }
    setSaving(lead.id);
    const response = await fetch("/api/leads/convert", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lead_id: lead.id, force }) });
    const result = await response.json().catch(() => ({})) as { studentId?: string; error?: string; duplicate?: { full_name: string } };
    setSaving(null);
    if (response.status === 409 && result.duplicate) {
      if (window.confirm(`${result.error ?? `A student with this phone already exists: ${result.duplicate.full_name}`}\n\nCreate another student anyway?`)) await convert(lead, true);
      return;
    }
    if (!response.ok || !result.studentId) return setMessage(result.error ?? "Could not convert lead");
    setLeads((rows) => rows.map((item) => item.id === lead.id ? { ...item, converted_to_student_id: result.studentId, status: "booked" } : item));
    setMessage("Lead converted to student");
  }

  function toggle(id: string) {
    setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  function togglePage() {
    const allSelected = visible.length > 0 && visible.every((lead) => selected.has(lead.id));
    setSelected((current) => { const next = new Set(current); visible.forEach((lead) => allSelected ? next.delete(lead.id) : next.add(lead.id)); return next; });
  }

  function exportRows() {
    const repName = (id?: string | null) => reps.find((rep) => rep.id === id)?.full_name ?? "";
    const rows = (selectedRows.length ? selectedRows : filtered).map((lead) => Object.fromEntries([
      ...sheetColumns.map((column) => [column.label, valueOf(lead, column.key)]),
      ["Assigned to", repName(lead.assigned_to)], ["Status", lead.status], ["Created", academyDateOf(lead.created_at)],
    ]));
    exportExcel(`${listView}-leads-filtered.xlsx`, rows, listView === "waiting" ? "Waiting List" : "Active Leads", { widths: [24, 18, 24, 14, 12, 14, 28, 14, 30, 14, 30, 16, 16, 28, 18, 18, 20, 14, 14] });
    setMessage(`Exported ${rows.length} leads`);
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    let rows: ExcelRow[];
    try { rows = await readExcel(file); } catch { input.value = ""; return setMessage("The file could not be read. Check that it is a valid .xlsx, .xls or .csv file."); }
    input.value = "";
    const imported = rows.map((row) => {
      const status = importedValue(row, ["Status"]).toLowerCase().replace(/[\s-]+/g, "_");
      return {
        full_name: importedValue(row, ["Name", "Full name", ...NAME_ALIASES]),
        phone: normalizePhone(importedValue(row, ["Number", "Phone", "Mobile", ...PHONE_ALIASES])),
        source: importedValue(row, ["Campaign / source", "Source", "Campaign"]) || "CRM sheet import",
        tags: importedValue(row, ["Tags", "Tag"]).split(",").map((tag) => tag.trim()).filter(Boolean),
        status: statuses.includes(status) ? status : listView === "waiting" ? "waiting" : "new",
        assigned_to: canAssign ? null : currentUserId,
        crm_data: {
          level: importedValue(row, ["Level", "Niveau"]), first_date: importedValue(row, ["Date 1", "Datum"]), contact_1: importedValue(row, ["Contact 1", "Kontakt 1"]),
          second_date: importedValue(row, ["Date 2", "Datum 2"]), contact_2: importedValue(row, ["Contact 2", "Kontakt 2"]), third_date: importedValue(row, ["Date 3", "Datum 3"]),
          comment_hossam: importedValue(row, ["Comment 1", "Comment Hossam"]), fourth_date: importedValue(row, ["Date 4", "Datum 4"]), comment_kayther: importedValue(row, ["Comment 2", "Comment Kayther"]), next_follow_up: importedValue(row, ["Next follow-up", "Next Follow Up"]), reminder_date: importedValue(row, ["Reminder date", "Reminder Date"]), reminder_note: importedValue(row, ["Reminder note", "Reminder Note"]),
        },
      };
    }).filter((row) => row.full_name && row.phone);
    if (!imported.length) return setMessage("No lead rows found in the file");
    if (hasSupabaseEnv()) {
      setMessage("Importing...");
      const response = await fetch("/api/leads/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ campaign: "CRM sheet import", assignedTo: canAssign ? "" : currentUserId, rows: imported }) }).catch(() => null);
      const result = await response?.json().catch(() => ({})) as { imported?: number; skippedDuplicates?: number; error?: string; warning?: string } | undefined;
      if (!response || !response.ok) return setMessage(result?.error ?? "Import failed");
      setMessage(`Imported ${result?.imported ?? 0} leads, skipped ${result?.skippedDuplicates ?? 0} duplicates${result?.warning ? `. ${result.warning}` : ""}${result?.imported ? " — reloading…" : ""}`);
      if (result?.imported) window.setTimeout(() => window.location.reload(), result.warning ? 4000 : 1500);
      return;
    }
    const { data, error } = await supabase.from("leads").insert(imported).select();
    if (error) return setMessage(error.message);
    setLeads((current) => [...(data as Lead[]), ...current]);
    setMessage(`Imported ${imported.length} leads`);
  }

  const visibleManualSheets = manualSheets.filter((sheet) => !manualSheetQuery.trim() || sheet.name.toLowerCase().includes(manualSheetQuery.toLowerCase()));
  const listTabs = <div className="space-y-2 border-b pb-3"><div className="flex flex-wrap items-center gap-2"><Button variant={listView === "active" ? "default" : "outline"} onClick={() => { setListView("active"); setPage(1); setSelected(new Set()); }}>Active Leads ({leads.filter((lead) => lead.status !== "waiting").length})</Button><Button variant={listView === "waiting" ? "default" : "outline"} onClick={() => { setListView("waiting"); setPage(1); setSelected(new Set()); }}>Waiting List ({leads.filter((lead) => lead.status === "waiting").length})</Button>{manualSheets.length > 0 && <><Button type="button" size="icon" variant={manualSheetSearchOpen ? "default" : "outline"} onClick={() => setManualSheetSearchOpen((open) => !open)} title="Search saved sheets" aria-label="Search saved sheets"><Search size={16} /></Button>{manualSheetSearchOpen && <Input autoFocus className="w-48" value={manualSheetQuery} onChange={(event) => setManualSheetQuery(event.target.value)} placeholder="Search saved sheets..." />}<Select className="min-w-52" value={listView.startsWith("manual:") && listView !== "manual:new" ? listView : ""} onChange={(event) => { setManualSheetQuery(""); setListView(event.target.value); }}><option value="">Saved sheets ({manualSheets.length})</option>{visibleManualSheets.map((sheet) => <option key={sheet.id} value={`manual:${sheet.id}`}>{sheet.name}</option>)}</Select></>}<Button variant={listView === "manual:new" ? "default" : "outline"} onClick={() => { setListView("manual:new"); setSelected(new Set()); }}><Plus size={16} /> New list</Button></div>{manualSheets.length > 0 && <div className="overflow-x-auto rounded-md border bg-[#F5F1EA] p-1"><div className="flex min-w-max gap-1" role="tablist" aria-label="Saved sheets">{visibleManualSheets.map((sheet) => <button key={sheet.id} type="button" role="tab" aria-selected={listView === `manual:${sheet.id}`} onClick={() => { setManualSheetQuery(""); setListView(`manual:${sheet.id}`); }} className={`rounded-md border px-3 py-2 text-sm font-medium ${listView === `manual:${sheet.id}` ? "border-[#D4AF37] bg-white text-[#1B4332]" : "border-transparent text-muted-foreground hover:bg-white/70"}`}>{sheet.name}</button>)}</div></div>}</div>;

  if (listView.startsWith("manual:")) return <div className="space-y-4">{listTabs}<ManualLeadSheet embedded initialSheetId={listView === "manual:new" ? undefined : listView.slice("manual:".length)} onDeleted={() => setListView("active")} canManage={canAssign} salesReps={reps} canConvert newList={listView === "manual:new"} /></div>;

  return <div className="space-y-4">
    {listTabs}
    <div className="flex flex-wrap items-center gap-2">
      <Input className="min-w-[220px] flex-1" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); setSelected(new Set()); }} placeholder="Search name, number, level, comments..." />
      <Input className="w-44" value={sourceFilter} onChange={(event) => { setSourceFilter(event.target.value); setPage(1); setSelected(new Set()); }} placeholder="Campaign / source" />
      <Input className="w-36" value={tagFilter} onChange={(event) => { setTagFilter(event.target.value); setPage(1); setSelected(new Set()); }} placeholder="Tag" />
      <Select className="w-44" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); setSelected(new Set()); }}><option value="">All statuses</option>{statuses.filter((status) => listView === "waiting" ? status === "waiting" : status !== "waiting").map((status) => <option key={status} value={status}>{status}</option>)}</Select>
      {canAssign && <><Select className="w-52" value={bulkAssignee} onChange={(event) => setBulkAssignee(event.target.value)}><option value="">Choose sales person</option><option value="__unassigned">Unassign selected</option>{reps.map((rep) => <option key={rep.id} value={rep.id}>{rep.full_name}</option>)}</Select><Button type="button" disabled={!selectedRows.length || !bulkAssignee || saving === "bulk"} onClick={() => void assignSelected()}>Assign selected ({selectedRows.length})</Button></>}
      <Button variant="outline" onClick={exportRows}><Upload size={16} /> Export {listView === "waiting" ? "waiting" : "active"} {selectedRows.length ? "selected" : "filtered"}</Button>
      <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border bg-white px-4 text-sm font-medium hover:bg-muted"><Download size={16} /> Import {listView === "waiting" ? "waiting" : "active"}<input className="hidden" type="file" accept=".csv,.xlsx,.xls" onChange={importFile} /></label>
    </div>
    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground"><span>{filtered.length} leads</span><span>{selectedRows.length} selected</span>{message && <span className="text-primary">{message}</span>}</div>
    <div className="overflow-x-auto rounded-md border bg-white"><table className="min-w-[1800px] border-collapse text-sm">
      <thead className="bg-[#1B4332] text-left text-white"><tr><th className="sticky left-0 z-10 bg-[#1B4332] px-3 py-3"><input type="checkbox" checked={visible.length > 0 && visible.every((lead) => selected.has(lead.id))} onChange={togglePage} aria-label="Select page" /></th>{sheetColumns.map((column) => <th key={column.key} className="whitespace-nowrap border-r border-white/20 px-3 py-3">{column.label}</th>)}{canAssign && <th className="whitespace-nowrap px-3 py-3">Assigned sales</th>}<th className="px-3 py-3">Status</th><th className="px-3 py-3">Follow-ups</th><th className="px-3 py-3">Actions</th></tr></thead>
      <tbody>{visible.map((lead, index) => <tr key={lead.id} className={index % 2 ? "bg-[#F5F1EA]" : "bg-white"}>
        <td className="sticky left-0 z-[1] border-b px-3 py-2"><input type="checkbox" checked={selected.has(lead.id)} onChange={() => toggle(lead.id)} aria-label={`Select ${lead.full_name}`} /></td>
        {sheetColumns.map((column) => <td key={column.key} className="min-w-[130px] border-b border-r px-2 py-2 align-top"><Input className="min-w-[120px] border-transparent bg-transparent focus:border-primary" type={column.type} value={valueOf(lead, column.key)} onFocus={() => focusValues.current.set(`${lead.id}:${column.key}`, valueOf(lead, column.key))} onChange={(event) => updateLocal(lead.id, column.key, event.target.value)} onBlur={(event) => void saveLeadValue(lead.id, column.key, event.currentTarget.value, focusValues.current.get(`${lead.id}:${column.key}`))} aria-label={`${column.label} for ${lead.full_name}`} /></td>)}
        {canAssign && <td className="min-w-[170px] border-b px-2 py-2 align-top"><Select value={lead.assigned_to ?? ""} onChange={(event) => void assignLead(lead, event.target.value)}><option value="">Unassigned</option>{reps.map((rep) => <option key={rep.id} value={rep.id}>{rep.full_name}</option>)}</Select></td>}
        <td className="min-w-[150px] border-b px-2 py-2 align-top"><Select value={lead.status} disabled={Boolean(lead.converted_to_student_id)} onChange={(event) => setStatus(lead, event.target.value)}>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</Select>{lead.converted_to_student_id && <Badge className="mt-2">Converted</Badge>}</td>
        <td className="min-w-[260px] border-b px-2 py-2 align-top text-xs">{followUpLeadId === lead.id ? <div className="grid gap-1"><Input autoFocus value={followUpNote} onChange={(event) => setFollowUpNote(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void saveFollowUp(lead); }} placeholder="What happened on this contact?" aria-label={`Follow-up note for ${lead.full_name}`} /><div className="flex gap-1"><Button size="sm" onClick={() => void saveFollowUp(lead)}>Save</Button><Button size="sm" variant="ghost" onClick={() => { setFollowUpLeadId(null); setFollowUpNote(""); }}>Cancel</Button></div></div> : <div className="grid gap-1"><span className="text-muted-foreground">{(lead.lead_interactions ?? []).length} logged</span>{lead.lead_interactions?.[0] && <span className="line-clamp-2">{academyDateOf(lead.lead_interactions[0].created_at)}: {lead.lead_interactions[0].note}</span>}<Button size="sm" variant="outline" className="w-fit" onClick={() => { setFollowUpLeadId(lead.id); setFollowUpNote(""); }}><MessageSquarePlus size={14} /> Log follow-up</Button></div>}</td>
        <td className="border-b px-2 py-2 align-top"><div className="flex min-w-[330px] flex-wrap gap-1"><Button size="icon" variant="outline" title="WhatsApp" asChild><a href={toWhatsApp(lead.phone)} target="_blank"><MessageCircle size={15} /></a></Button><Button size="icon" variant="outline" title="Call" asChild><a href={`tel:${lead.phone}`}><Phone size={15} /></a></Button>{lead.status !== "waiting" && <Button size="sm" variant="outline" onClick={() => setStatus(lead, "waiting")}>Waiting</Button>}{lead.status === "waiting" && <Button size="sm" variant="outline" onClick={() => setStatus(lead, "new")}>Move to leads</Button>}{!lead.converted_to_student_id && <Button size="sm" disabled={saving === lead.id} onClick={() => convert(lead)}><UserPlus size={14} /> Convert to student</Button>}{saving === lead.id && <span className="px-2 py-2 text-xs text-muted-foreground">Saving...</span>}</div></td>
      </tr>)}</tbody>
    </table></div>
    <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Page {page} of {pages}</span><div className="flex gap-2"><Button variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button variant="outline" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div>
  </div>;
}
