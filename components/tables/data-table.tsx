"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownUp, Check, Edit2, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type Column<T> = { key: keyof T | string; header: string; render?: (row: T) => React.ReactNode };

export type EditField = { key: string; label: string; type?: "text" | "number" | "date" | "textarea" | "select" | "boolean"; options?: Array<{ value: string; label: string }>; required?: boolean };

// Rows are display rows, so the raw values to edit travel in `_edit` and the table in `_table` (or edit.table).
export type EditConfig = { table?: string; fields: EditField[]; canDelete?: boolean };

export function DataTable<T extends Record<string, unknown>>({ rows, columns, empty = "No records yet.", labels = { search: "Search...", previous: "Previous", next: "Next" }, edit }: { rows: T[]; columns: Column<T>[]; empty?: string; labels?: { search?: string; previous?: string; next?: string }; edit?: EditConfig }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<string>(String(columns[0]?.key ?? ""));
  const [page, setPage] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const pageSize = 25;
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return rows
      .filter((row) => JSON.stringify(row).toLowerCase().includes(q))
      .sort((a, b) => String(a[sort] ?? "").localeCompare(String(b[sort] ?? "")));
  }, [query, rows, sort]);
  const visible = filtered.slice(page * pageSize, page * pageSize + pageSize);
  const tableOf = (row: T) => String(row._table ?? edit?.table ?? "");
  const rawOf = (row: T) => (row._edit && typeof row._edit === "object" ? row._edit : row) as Record<string, unknown>;

  function startEdit(row: T) {
    const raw = rawOf(row);
    setEditingId(String(row.id));
    setMessage("");
    setDraft(Object.fromEntries((edit?.fields ?? []).map((field) => [field.key, raw[field.key] == null ? "" : field.type === "date" ? String(raw[field.key]).slice(0, 10) : String(raw[field.key])])));
  }

  async function save(row: T) {
    const fields = edit?.fields ?? [];
    const missing = fields.filter((field) => field.required && !draft[field.key]?.trim()).map((field) => field.label);
    if (missing.length) return setMessage(`Please complete: ${missing.join(", ")}.`);
    const bad = fields.find((field) => field.type === "number" && draft[field.key]?.trim() && !Number.isFinite(Number(draft[field.key])));
    if (bad) return setMessage(`${bad.label} must be a number.`);
    const payload = Object.fromEntries(fields.map((field) => {
      const value = draft[field.key]?.trim() ?? "";
      return [field.key, field.type === "boolean" ? value === "true" : value === "" ? null : field.type === "number" ? Number(value) : value];
    }));
    setBusy(true);
    const { data, error } = await createSupabaseBrowserClient().from(tableOf(row)).update(payload).eq("id", String(row.id)).select("id");
    setBusy(false);
    if (error || !data?.length) return setMessage(error?.message ?? "This row could not be changed.");
    setEditingId(null);
    setMessage("Saved.");
    router.refresh();
  }

  async function remove(row: T) {
    if (!window.confirm("Delete this row? This cannot be undone.")) return;
    setBusy(true);
    const { data, error } = await createSupabaseBrowserClient().from(tableOf(row)).delete().eq("id", String(row.id)).select("id");
    setBusy(false);
    if (error || !data?.length) return setMessage(error?.message ?? "This row could not be deleted.");
    setMessage("Deleted.");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm print:hidden">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" data-search placeholder={labels.search} value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      {message && <p key={message} role="status" className="text-sm text-muted-foreground">{message}</p>}
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full min-w-max text-sm">
          <thead className="bg-muted">
            <tr>
              {columns.map((column) => (
                <th key={String(column.key)} className="px-4 py-3 text-start font-semibold">
                  <button className="inline-flex items-center gap-2 print:pointer-events-none" onClick={() => setSort(String(column.key))}>
                    {column.header}
                    <ArrowDownUp className="print:hidden" size={14} />
                  </button>
                </th>
              ))}
              {edit && <th className="px-4 py-3 print:hidden" />}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, index) => (
              <FragmentRow key={String(row.id ?? index)}>
                <tr className="border-t">
                  {columns.map((column) => (
                    <td key={String(column.key)} className="px-4 py-3 align-top">
                      {column.render ? column.render(row) : String(row[column.key] ?? "")}
                    </td>
                  ))}
                  {edit && (
                    <td className="px-4 py-3 align-top print:hidden">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => startEdit(row)} aria-label="Edit row"><Edit2 size={14} /></Button>
                        {edit.canDelete && <Button size="sm" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" disabled={busy} onClick={() => void remove(row)} aria-label="Delete row"><Trash2 size={14} /></Button>}
                      </div>
                    </td>
                  )}
                </tr>
                {edit && editingId === String(row.id) && (
                  <tr className="border-t bg-muted/40">
                    <td colSpan={columns.length + 1} className="px-4 py-3">
                      <div className="grid gap-3 md:grid-cols-3">
                        {edit.fields.map((field) => (
                          <label key={field.key} className={`grid gap-1 text-sm ${field.type === "textarea" ? "md:col-span-3" : ""}`}>
                            <span className="font-medium">{field.label}{field.required ? " *" : ""}</span>
                            {field.type === "boolean" ? (
                              <Select value={draft[field.key] === "true" ? "true" : "false"} onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}><option value="true">Yes</option><option value="false">No</option></Select>
                            ) : field.type === "select" ? (
                              <Select value={draft[field.key] ?? ""} onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}>
                                {!field.required && <option value="">-</option>}
                                {(field.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                              </Select>
                            ) : field.type === "textarea" ? (
                              <Textarea value={draft[field.key] ?? ""} onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })} />
                            ) : (
                              <Input type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"} step={field.type === "number" ? "any" : undefined} value={draft[field.key] ?? ""} onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })} />
                            )}
                          </label>
                        ))}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" disabled={busy} onClick={() => void save(row)}><Check size={14} /> Save changes</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)}><X size={14} /> Cancel</Button>
                      </div>
                    </td>
                  </tr>
                )}
              </FragmentRow>
            ))}
          </tbody>
        </table>
        {!visible.length && <div className="p-8 text-center text-muted-foreground">{empty}</div>}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
        <Button variant="outline" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>{labels.previous}</Button>
        <Button variant="outline" disabled={(page + 1) * pageSize >= filtered.length} onClick={() => setPage((value) => value + 1)}>{labels.next}</Button>
      </div>
    </div>
  );
}

function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
