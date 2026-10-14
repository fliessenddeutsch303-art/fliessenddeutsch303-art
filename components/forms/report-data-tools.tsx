"use client";

import { useEffect, useState } from "react";
import { Download, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { exportExcel, readExcel, type ExcelRow } from "@/lib/excel";

type ReportSection = "summary" | "courses" | "sales" | "campaigns";
type ReportData = Record<ReportSection, ExcelRow[]>;

const sectionNames: Record<ReportSection, string> = {
  summary: "Summary",
  courses: "Course and payment reports",
  sales: "Sales KPIs",
  campaigns: "Campaign performance",
};

const storageKey = "fd_imported_report_snapshot";

function filename(section: ReportSection) {
  return `fliessend-deutsch-${section}-report.xlsx`;
}

export function ReportDataTools({ reportData }: { reportData: ReportData }) {
  const [section, setSection] = useState<ReportSection>("summary");
  const [snapshot, setSnapshot] = useState<Partial<ReportData>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/report-snapshots", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("Cloud snapshots unavailable");
      const json = await response.json() as { snapshots?: Array<{ section: ReportSection; rows: ExcelRow[] }> };
      if (!cancelled) setSnapshot(Object.fromEntries((json.snapshots ?? []).map((item) => [item.section, item.rows])) as Partial<ReportData>);
    }).catch(() => {
      try {
        const saved = window.localStorage.getItem(storageKey);
        if (saved && !cancelled) setSnapshot(JSON.parse(saved) as Partial<ReportData>);
      } catch {
        // Ignore malformed local snapshots and keep the live report available.
      }
    });
    return () => { cancelled = true; };
  }, []);

  function rowsFor(sectionName: ReportSection) {
    return snapshot[sectionName] ?? reportData[sectionName];
  }

  function exportSection(sectionName: ReportSection) {
    const rows = rowsFor(sectionName);
    exportExcel(filename(sectionName), rows, sectionNames[sectionName], { widths: [30, 24, 24, 24, 24, 24, 24] });
    setError(false);
    setMessage(`Exported ${rows.length} rows from ${sectionNames[sectionName]}`);
  }

  async function importSection(file: File) {
    try {
      const rows = await readExcel(file);
      if (!rows.length) throw new Error("The selected file has no report rows.");
      const next = { ...snapshot, [section]: rows };
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      setSnapshot(next);
      const response = await fetch("/api/report-snapshots", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ section, rows }) });
      if (!response.ok) throw new Error("Report imported locally; cloud save failed.");
      setError(false);
      setMessage(`Imported and saved ${rows.length} rows in ${sectionNames[section]}`);
    } catch (importError) {
      setError(true);
      setMessage(importError instanceof Error ? importError.message : "The report could not be imported.");
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Report import and export</CardTitle></CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-2">
          <Select className="min-w-[230px]" value={section} onChange={(event) => setSection(event.target.value as ReportSection)}>
            {Object.entries(sectionNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
          <Button type="button" variant="outline" onClick={() => exportSection(section)}><Upload size={16} /> Export selected report</Button>
          <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border bg-white px-4 text-sm font-medium hover:bg-muted">
            <Download size={16} /> Import selected report
            <input className="hidden" type="file" accept=".xlsx,.xls,.csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importSection(file); event.currentTarget.value = ""; }} />
          </label>
          <Button type="button" variant="secondary" onClick={() => Object.keys(sectionNames).forEach((name) => exportSection(name as ReportSection))}><Upload size={16} /> Export all reports</Button>
        </div>
        {message && <p role="status" className={`mt-3 text-sm ${error ? "text-red-700" : "text-green-700"}`}>{message}</p>}
        {snapshot[section] && <p className="mt-2 text-xs text-muted-foreground">A locally saved imported snapshot is being used for this section’s export. Live operational records remain unchanged.</p>}
      </CardContent>
    </Card>
  );
}
