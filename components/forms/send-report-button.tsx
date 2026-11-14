"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SendReportButton({ label }: { label: string }) {
  const [state, setState] = useState<{ busy: boolean; message: string; ok: boolean }>({ busy: false, message: "", ok: true });
  async function send() {
    setState({ busy: true, message: "", ok: true });
    const response = await fetch("/api/reports/daily", { method: "POST" }).catch(() => null);
    const json = await response?.json().catch(() => null) as { sent?: boolean; reason?: string; error?: string } | null;
    if (response?.ok && json?.sent) setState({ busy: false, message: "Daily report sent.", ok: true });
    else setState({ busy: false, message: json?.reason ?? json?.error ?? "The report could not be sent.", ok: false });
  }
  return <div className="grid gap-1"><Button type="button" variant="accent" disabled={state.busy} onClick={() => void send()}><Send size={16} /> {state.busy ? "Sending…" : label}</Button>{state.message && <p role="status" className={`text-xs ${state.ok ? "text-green-700" : "text-red-700"}`}>{state.message}</p>}</div>;
}
