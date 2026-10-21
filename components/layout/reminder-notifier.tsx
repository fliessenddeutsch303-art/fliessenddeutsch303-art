"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Reminder = { id?: string; lead_id?: string; leadName?: string; due_at?: string; dueAt?: string; note: string; leads?: { full_name?: string } | null };

export function ReminderNotifier() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const refresh = async () => {
    const local = JSON.parse(localStorage.getItem("fd_lead_reminders") ?? "[]") as Reminder[];
    let remote: Reminder[] = [];
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 2500);
    try { const response = await fetch("/api/lead-reminders", { cache: "no-store", signal: controller.signal }); if (response.ok) remote = (await response.json()).reminders ?? []; } catch { /* local mode, offline, or slow reminder service */ } finally { window.clearTimeout(timeout); }
    const today = new Date().toISOString().slice(0, 10);
    setReminders([...remote, ...local.filter((item) => (item.dueAt ?? "") <= today)]);
  };
  useEffect(() => { const initial = window.setTimeout(() => void refresh(), 750); const interval = window.setInterval(() => void refresh(), 60000); window.addEventListener("fd-reminders-updated", refresh); return () => { window.clearTimeout(initial); window.clearInterval(interval); window.removeEventListener("fd-reminders-updated", refresh); }; }, []);
  if (!reminders.length) return null;
  return <div className="fixed bottom-4 left-4 right-4 z-[90] mx-auto max-w-3xl rounded-lg border-2 border-red-500 bg-red-50 p-3 text-red-900 shadow-xl"><div className="flex items-start gap-3"><Bell className="mt-1 shrink-0" size={20} /><div className="min-w-0 flex-1"><p className="font-semibold">Lead reminders due ({reminders.length})</p><div className="mt-1 grid gap-1 text-sm">{reminders.slice(0, 4).map((reminder, index) => <p key={reminder.id ?? reminder.lead_id ?? index}><strong>{reminder.leads?.full_name ?? reminder.leadName ?? "Lead"}</strong>: {reminder.note}</p>)}</div></div><Button size="icon" variant="ghost" onClick={() => setReminders([])} aria-label="Dismiss reminders"><X size={18} /></Button></div></div>;
}
