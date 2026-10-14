"use client";

import { useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type User = { id: string; full_name: string };
type Row = Record<string, string>;

export function LeadImporter({ reps }: { reps: User[] }) {
  const [campaign, setCampaign] = useState("");
  const [assignedTo, setAssignedTo] = useState(reps[0]?.id ?? "");
  const [rows, setRows] = useState<Row[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [nameCol, setNameCol] = useState("");
  const [phoneCol, setPhoneCol] = useState("");
  const [message, setMessage] = useState("");

  async function parseFile(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "xlsx" || ext === "xls") {
      const buffer = await file.arrayBuffer();
      const sheet = XLSX.read(buffer).Sheets[XLSX.read(buffer).SheetNames[0]];
      const parsed = XLSX.utils.sheet_to_json<Row>(sheet);
      hydrate(parsed);
    } else {
      Papa.parse<Row>(file, { header: true, skipEmptyLines: true, complete: (result) => hydrate(result.data) });
    }
  }
  function hydrate(parsed: Row[]) {
    const cols = Object.keys(parsed[0] ?? {});
    setRows(parsed);
    setColumns(cols);
    setNameCol(cols.find((col) => /name/i.test(col)) ?? cols[0] ?? "");
    setPhoneCol(cols.find((col) => /phone|mobile/i.test(col)) ?? cols[1] ?? "");
  }
  async function importRows() {
    const response = await fetch("/api/leads/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ campaign, assignedTo, rows: rows.map((row) => ({ full_name: row[nameCol], phone: row[phoneCol], source: campaign })) }) });
    const json = await response.json();
    setMessage(response.ok ? `Imported ${json.count} leads` : json.error);
  }
  return (
    <Card>
      <CardHeader><CardTitle>Upload Lead File</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3"><Input value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="Campaign name" /><Select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>{reps.map((rep) => <option key={rep.id} value={rep.id}>{rep.full_name}</option>)}</Select><Input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => e.target.files?.[0] && parseFile(e.target.files[0])} /></div>
        {rows.length > 0 && <div className="space-y-3"><div className="grid gap-3 md:grid-cols-2"><Select value={nameCol} onChange={(e) => setNameCol(e.target.value)}>{columns.map((col) => <option key={col}>{col}</option>)}</Select><Select value={phoneCol} onChange={(e) => setPhoneCol(e.target.value)}>{columns.map((col) => <option key={col}>{col}</option>)}</Select></div><div className="overflow-auto rounded-md border"><table className="w-full text-sm"><tbody>{rows.slice(0, 10).map((row, i) => <tr key={i} className="border-t"><td className="p-2">{row[nameCol]}</td><td className="p-2">{row[phoneCol]}</td></tr>)}</tbody></table></div><Button onClick={importRows}><Download size={16} /> Confirm Import</Button></div>}
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </CardContent>
    </Card>
  );
}
