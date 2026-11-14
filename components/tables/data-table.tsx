"use client";

import { useMemo, useState } from "react";
import { ArrowDownUp, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type Column<T> = { key: keyof T | string; header: string; render?: (row: T) => React.ReactNode };

export function DataTable<T extends Record<string, unknown>>({ rows, columns, empty = "No records yet.", labels = { search: "Search...", previous: "Previous", next: "Next" } }: { rows: T[]; columns: Column<T>[]; empty?: string; labels?: { search?: string; previous?: string; next?: string } }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<string>(String(columns[0]?.key ?? ""));
  const [page, setPage] = useState(0);
  const pageSize = 25;
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return rows
      .filter((row) => JSON.stringify(row).toLowerCase().includes(q))
      .sort((a, b) => String(a[sort] ?? "").localeCompare(String(b[sort] ?? "")));
  }, [query, rows, sort]);
  const visible = filtered.slice(page * pageSize, page * pageSize + pageSize);

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm print:hidden">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" data-search placeholder={labels.search} value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full min-w-max text-sm">
          <thead className="bg-muted">
            <tr>
              {columns.map((column) => (
                <th key={String(column.key)} className="px-4 py-3 text-left font-semibold">
                  <button className="inline-flex items-center gap-2 print:pointer-events-none" onClick={() => setSort(String(column.key))}>
                    {column.header}
                    <ArrowDownUp className="print:hidden" size={14} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, index) => (
              <tr key={String(row.id ?? index)} className="border-t">
                {columns.map((column) => (
                  <td key={String(column.key)} className="px-4 py-3 align-top">
                    {column.render ? column.render(row) : String(row[column.key] ?? "")}
                  </td>
                ))}
              </tr>
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
