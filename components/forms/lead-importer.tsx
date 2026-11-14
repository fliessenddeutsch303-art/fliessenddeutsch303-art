"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { normalizePhone, readExcel } from "@/lib/excel";
import { NAME_ALIASES, PHONE_ALIASES, findColumn } from "@/lib/lead-columns";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type User = { id: string; full_name: string };
type Row = Record<string, string>;

export function LeadImporter({ reps }: { reps: User[] }) {
  const router = useRouter();
  const [campaign, setCampaign] = useState("");
  const [assignedTo, setAssignedTo] = useState(reps[0]?.id ?? "");
  const [rows, setRows] = useState<Row[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [nameCol, setNameCol] = useState("");
  const [phoneCol, setPhoneCol] = useState("");
  const [message, setMessage] = useState("");
  const [importing, setImporting] = useState(false);

  async function parseFile(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase();
    const failed = () => setMessage("The file could not be read. Check that it is a valid .xlsx, .xls or .csv file.");
    setMessage("");
    try {
      if (ext === "xlsx" || ext === "xls") {
        const parsed = await readExcel(file);
        hydrate(parsed.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, String(value ?? "")]))));
      } else {
        Papa.parse<Row>(file, { header: true, skipEmptyLines: true, complete: (result) => hydrate(result.data), error: failed });
      }
    } catch { failed(); }
  }
  function hydrate(parsed: Row[]) {
    const cols = Object.keys(parsed[0] ?? {});
    setRows(parsed);
    setColumns(cols);
    setNameCol(findColumn(cols, NAME_ALIASES) ?? cols.find((col) => /name/i.test(col)) ?? cols[0] ?? "");
    setPhoneCol(findColumn(cols, PHONE_ALIASES) ?? cols.find((col) => /phone|mobile/i.test(col)) ?? cols[1] ?? "");
  }
  async function importRows() {
    if (!campaign.trim()) return setMessage("Enter a campaign name first.");
    const payload = rows.map((row) => ({ full_name: String(row[nameCol] ?? "").trim(), phone: normalizePhone(row[phoneCol]), source: campaign })).filter((row) => row.full_name && row.phone);
    const skipped = rows.length - payload.length;
    setImporting(true);
    const response = await fetch("/api/leads/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ campaign, assignedTo, rows: payload }) }).catch(() => null);
    const json = await response?.json().catch(() => ({})) ?? {};
    setImporting(false);
    if (!response || !response.ok) return setMessage(json.error ?? "Import failed");
    setMessage(`Imported ${json.imported ?? 0} leads, skipped ${json.skippedDuplicates ?? 0} duplicates${skipped ? ` · ${skipped} rows skipped (missing name or phone)` : ""}${json.warning ? ` · ${json.warning}` : ""}`);
    setRows([]);
    router.refresh();
  }
  return (
    <Card>
      <CardHeader><CardTitle>Upload Lead File</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3"><Input value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="Campaign name" /><Select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} aria-label="Assign to">{reps.length > 1 && <option value="">Unassigned</option>}{reps.map((rep) => <option key={rep.id} value={rep.id}>{rep.full_name}</option>)}</Select><Input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => e.target.files?.[0] && parseFile(e.target.files[0])} /></div>
        {rows.length > 0 && <div className="space-y-3"><div className="grid gap-3 md:grid-cols-2"><Select value={nameCol} onChange={(e) => setNameCol(e.target.value)} aria-label="Name column">{columns.map((col) => <option key={col}>{col}</option>)}</Select><Select value={phoneCol} onChange={(e) => setPhoneCol(e.target.value)} aria-label="Phone column">{columns.map((col) => <option key={col}>{col}</option>)}</Select></div><div className="overflow-auto rounded-md border"><table className="w-full text-sm"><tbody>{rows.slice(0, 10).map((row, i) => <tr key={i} className="border-t"><td className="p-2">{row[nameCol]}</td><td className="p-2">{row[phoneCol]}</td></tr>)}</tbody></table></div><p className="text-xs text-muted-foreground">{rows.length} rows found. Preview of the first 10:</p><Button onClick={() => void importRows()} disabled={importing}><Download size={16} /> {importing ? "Importing..." : `Confirm Import (${rows.length})`}</Button></div>}
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </CardContent>
    </Card>
  );
}
