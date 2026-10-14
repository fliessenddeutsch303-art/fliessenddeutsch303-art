"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Download, MessageCircle, Phone, Plus, Upload, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { exportExcel, readExcel, type ExcelRow } from "@/lib/excel";
import { hasSupabaseEnv } from "@/lib/env";
import { toWhatsApp } from "@/lib/utils";
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
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAssignee, setBulkAssignee] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
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

  function updateLocal(id: string, key: string, value: string) {
    setLeads((rows) => rows.map((lead) => {
      if (lead.id !== id) return lead;
      if (key === "full_name" || key === "phone" || key === "source") return { ...lead, [key]: value };
      if (key === "tags") return { ...lead, tags: value.split(",").map((tag) => tag.trim()).filter(Boolean) };
      return { ...lead, crm_data: { ...(lead.crm_data ?? {}), [key]: value } };
    }));
  }

  async function saveLeadValue(id: string, key: string, value: string) {
    const current = leads.find((item) => item.id === id);
    if (!current) return;
    const next: Lead = key === "full_name" || key === "phone" || key === "source"
      ? { ...current, [key]: value }
      : key === "tags" ? { ...current, tags: value.split(",").map((tag) => tag.trim()).filter(Boolean) }
      : { ...current, crm_data: { ...(current.crm_data ?? {}), [key]: value } };
    setSaving(id);
    const { error } = await supabase.from("leads").update({ full_name: next.full_name, phone: next.phone, source: next.source ?? "", tags: next.tags ?? [], crm_data: next.crm_data ?? {} }).eq("id", id);
    setSaving(null);
    if (!error && key === "reminder_date" && value && next.status === "waiting") await createReminder(next);
    setMessage(error ? error.message : "Lead saved");
  }

  async function assignLead(lead: Lead, assignedTo: string) {
    const { error } = await supabase.from("leads").update({ assigned_to: assignedTo || null }).eq("id", lead.id);
    if (!error) setLeads((rows) => rows.map((item) => item.id === lead.id ? { ...item, assigned_to: assignedTo || null } : item));
    setMessage(error ? error.message : "Lead assignment saved");
  }

  async function assignSelected() {
    const ids = Array.from(selected);
    if (!ids.length) return setMessage("Select at least one lead first");
    const assignedTo = bulkAssignee === "__unassigned" ? null : bulkAssignee || null;
    setSaving("bulk");
    const results = await Promise.all(ids.map((id) => supabase.from("leads").update({ assigned_to: assignedTo }).eq("id", id)));
    const error = results.find((result) => result.error)?.error;
    if (!error) {
      setLeads((rows) => rows.map((lead) => selected.has(lead.id) ? { ...lead, assigned_to: assignedTo } : lead));
      setSelected(new Set());
    }
    setSaving(null);
    setMessage(error ? error.message : `Assigned ${ids.length} lead${ids.length === 1 ? "" : "s"} successfully`);
  }

  async function createReminder(lead: Lead) {
    const reminderDate = lead.crm_data?.reminder_date;
    if (!reminderDate) return;
    if (hasSupabaseEnv()) {
      const response = await fetch("/api/lead-reminders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ leadId: lead.id, dueAt: reminderDate, note: lead.crm_data?.reminder_note ?? `Follow up with ${lead.full_name}` }) });
      if (!response.ok) setMessage((await response.json()).error ?? "Reminder could not be created");
      return;
    }
    const current = JSON.parse(localStorage.getItem("fd_lead_reminders") ?? "[]") as Array<Record<string, string>>;
    const next = [...current.filter((item) => item.leadId !== lead.id), { leadId: lead.id, leadName: lead.full_name, dueAt: reminderDate, note: lead.crm_data?.reminder_note ?? "Follow up with lead" }];
    localStorage.setItem("fd_lead_reminders", JSON.stringify(next));
    window.dispatchEvent(new Event("fd-reminders-updated"));
  }

  async function setStatus(lead: Lead, status: string) {
    const { error } = await supabase.from("leads").update({ status }).eq("id", lead.id);
    if (!error) {
      const updated = { ...lead, status };
      setLeads((rows) => rows.map((item) => item.id === lead.id ? updated : item));
      if (status === "waiting") await createReminder(updated);
    }
    setMessage(error ? error.message : "Status saved");
  }

  async function convert(lead: Lead) {
    const { data, error } = await supabase.from("students").insert({ full_name: lead.full_name, phone: lead.phone, status: "active", enrolled_at: new Date().toISOString() }).select("id").single();
    if (error || !data) return setMessage(error?.message ?? "Could not convert lead");
    await supabase.from("leads").update({ converted_to_student_id: data.id, status: "booked" }).eq("id", lead.id);
    setLeads((rows) => rows.map((item) => item.id === lead.id ? { ...item, converted_to_student_id: data.id, status: "booked" } : item));
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
    const rows = (selectedRows.length ? selectedRows : filtered).map((lead) => Object.fromEntries([
      ...sheetColumns.map((column) => [column.label, valueOf(lead, column.key)]),
      ["Status", lead.status], ["Source", lead.source ?? ""], ["Created", lead.created_at],
    ]));
    exportExcel(`${listView}-leads-filtered.xlsx`, rows, listView === "waiting" ? "Waiting List" : "Active Leads", { widths: [24, 18, 12, 14, 28, 14, 28, 14, 30, 14, 30, 16, 16, 28, 18, 18, 24] });
    setMessage(`Exported ${rows.length} leads`);
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const rows = await readExcel(file);
    const imported = rows.map((row) => ({
      full_name: importedValue(row, ["Name", "Full name"]),
      phone: importedValue(row, ["Number", "Phone", "Mobile"]),
      source: importedValue(row, ["Campaign / source", "Source", "Campaign"]) || "CRM sheet import",
      tags: importedValue(row, ["Tags", "Tag"]).split(",").map((tag) => tag.trim()).filter(Boolean),
      status: listView === "waiting" ? "waiting" : "new",
      assigned_to: canAssign ? null : currentUserId,
      crm_data: {
        level: importedValue(row, ["Level", "Niveau"]), first_date: importedValue(row, ["Date 1", "Datum"]), contact_1: importedValue(row, ["Contact 1", "Kontakt 1"]),
        second_date: importedValue(row, ["Date 2", "Datum 2"]), contact_2: importedValue(row, ["Contact 2", "Kontakt 2"]), third_date: importedValue(row, ["Date 3", "Datum 3"]),
        comment_hossam: importedValue(row, ["Comment 1", "Comment Hossam"]), fourth_date: importedValue(row, ["Date 4", "Datum 4"]), comment_kayther: importedValue(row, ["Comment 2", "Comment Kayther"]), next_follow_up: importedValue(row, ["Next follow-up", "Next Follow Up"]), reminder_date: importedValue(row, ["Reminder date", "Reminder Date"]), reminder_note: importedValue(row, ["Reminder note", "Reminder Note"]),
      },
    })).filter((row) => row.full_name || row.phone);
    if (!imported.length) return setMessage("No lead rows found in the file");
    if (hasSupabaseEnv()) {
      const response = await fetch("/api/leads/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ campaign: "CRM sheet import", assignedTo: canAssign ? "" : currentUserId, rows: imported }) });
      const result = await response.json();
      setMessage(response.ok ? `Imported ${result.count} leads` : result.error);
      return;
    }
    const { data, error } = await supabase.from("leads").insert(imported).select();
    if (error) return setMessage(error.message);
    setLeads((current) => [...(data as Lead[]), ...current]);
    setMessage(`Imported ${imported.length} leads`);
  }

  const listTabs = <div className="flex flex-wrap gap-2 border-b pb-3"><Button variant={listView === "active" ? "default" : "outline"} onClick={() => { setListView("active"); setPage(1); setSelected(new Set()); }}>Active Leads ({leads.filter((lead) => lead.status !== "waiting").length})</Button><Button variant={listView === "waiting" ? "default" : "outline"} onClick={() => { setListView("waiting"); setPage(1); setSelected(new Set()); }}>Waiting List ({leads.filter((lead) => lead.status === "waiting").length})</Button>{manualSheets.map((sheet) => <Button key={sheet.id} variant={listView === `manual:${sheet.id}` ? "default" : "outline"} onClick={() => setListView(`manual:${sheet.id}`)}>{sheet.name}</Button>)}<Button variant={listView === "manual:new" ? "default" : "outline"} onClick={() => setListView("manual:new")}><Plus size={16} /> New list</Button></div>;

  if (listView.startsWith("manual:")) return <div className="space-y-4">{listTabs}<ManualLeadSheet embedded initialSheetId={listView === "manual:new" ? undefined : listView.slice("manual:".length)} onDeleted={() => setListView("active")} /></div>;

  return <div className="space-y-4">
    {listTabs}
    <div className="flex flex-wrap items-center gap-2">
      <Input className="min-w-[220px] flex-1" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search name, number, level, comments..." />
      <Input className="w-44" value={sourceFilter} onChange={(event) => { setSourceFilter(event.target.value); setPage(1); }} placeholder="Campaign / source" />
      <Input className="w-36" value={tagFilter} onChange={(event) => { setTagFilter(event.target.value); setPage(1); }} placeholder="Tag" />
      <Select className="w-44" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}><option value="">All statuses</option>{statuses.filter((status) => listView === "waiting" ? status === "waiting" : status !== "waiting").map((status) => <option key={status} value={status}>{status}</option>)}</Select>
      {canAssign && <><Select className="w-52" value={bulkAssignee} onChange={(event) => setBulkAssignee(event.target.value)}><option value="">Choose sales person</option><option value="__unassigned">Unassign selected</option>{reps.map((rep) => <option key={rep.id} value={rep.id}>{rep.full_name}</option>)}</Select><Button type="button" disabled={!selected.size || !bulkAssignee || saving === "bulk"} onClick={() => void assignSelected()}>Assign selected ({selected.size})</Button></>}
      <Button variant="outline" onClick={exportRows}><Upload size={16} /> Export {listView === "waiting" ? "waiting" : "active"} {selectedRows.length ? "selected" : "filtered"}</Button>
      <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border bg-white px-4 text-sm font-medium hover:bg-muted"><Download size={16} /> Import {listView === "waiting" ? "waiting" : "active"}<input className="hidden" type="file" accept=".csv,.xlsx,.xls" onChange={importFile} /></label>
    </div>
    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground"><span>{filtered.length} leads</span><span>{selected.size} selected</span>{message && <span className="text-primary">{message}</span>}</div>
    <div className="overflow-x-auto rounded-md border bg-white"><table className="min-w-[1800px] border-collapse text-sm">
      <thead className="bg-[#1B4332] text-left text-white"><tr><th className="sticky left-0 z-10 bg-[#1B4332] px-3 py-3"><input type="checkbox" checked={visible.length > 0 && visible.every((lead) => selected.has(lead.id))} onChange={togglePage} aria-label="Select page" /></th>{sheetColumns.map((column) => <th key={column.key} className="whitespace-nowrap border-r border-white/20 px-3 py-3">{column.label}</th>)}{canAssign && <th className="whitespace-nowrap px-3 py-3">Assigned sales</th>}<th className="px-3 py-3">Status</th><th className="px-3 py-3">Actions</th></tr></thead>
      <tbody>{visible.map((lead, index) => <tr key={lead.id} className={index % 2 ? "bg-[#F5F1EA]" : "bg-white"}>
        <td className="sticky left-0 z-[1] border-b px-3 py-2"><input type="checkbox" checked={selected.has(lead.id)} onChange={() => toggle(lead.id)} aria-label={`Select ${lead.full_name}`} /></td>
        {sheetColumns.map((column) => <td key={column.key} className="min-w-[130px] border-b border-r px-2 py-2 align-top"><Input className="min-w-[120px] border-transparent bg-transparent focus:border-primary" type={column.type} value={valueOf(lead, column.key)} onChange={(event) => updateLocal(lead.id, column.key, event.target.value)} onBlur={(event) => void saveLeadValue(lead.id, column.key, event.currentTarget.value)} aria-label={`${column.label} for ${lead.full_name}`} /></td>)}
        {canAssign && <td className="min-w-[170px] border-b px-2 py-2 align-top"><Select value={lead.assigned_to ?? ""} onChange={(event) => void assignLead(lead, event.target.value)}><option value="">Unassigned</option>{reps.map((rep) => <option key={rep.id} value={rep.id}>{rep.full_name}</option>)}</Select></td>}
        <td className="min-w-[150px] border-b px-2 py-2 align-top"><Select value={lead.status} disabled={Boolean(lead.converted_to_student_id)} onChange={(event) => setStatus(lead, event.target.value)}>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</Select>{lead.converted_to_student_id && <Badge className="mt-2">Converted</Badge>}</td>
        <td className="border-b px-2 py-2 align-top"><div className="flex min-w-[330px] flex-wrap gap-1"><Button size="icon" variant="outline" title="WhatsApp" asChild><a href={toWhatsApp(lead.phone)} target="_blank"><MessageCircle size={15} /></a></Button><Button size="icon" variant="outline" title="Call" asChild><a href={`tel:${lead.phone}`}><Phone size={15} /></a></Button>{lead.status !== "waiting" && <Button size="sm" variant="outline" onClick={() => setStatus(lead, "waiting")}>Waiting</Button>}{lead.status === "waiting" && <Button size="sm" variant="outline" onClick={() => setStatus(lead, "new")}>Move to leads</Button>}{!lead.converted_to_student_id && <Button size="sm" onClick={() => convert(lead)}><UserPlus size={14} /> Convert to student</Button>}{saving === lead.id && <span className="px-2 py-2 text-xs text-muted-foreground">Saving...</span>}</div></td>
      </tr>)}</tbody>
    </table></div>
    <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Page {page} of {pages}</span><div className="flex gap-2"><Button variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button variant="outline" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div>
  </div>;
}
