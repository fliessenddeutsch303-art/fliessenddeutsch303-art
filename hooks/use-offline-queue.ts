"use client";

import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { offlineSyncEventName } from "@/lib/offline-write-queue";

type AttendanceTable = "student_attendance" | "teacher_attendance" | "employee_attendance";
type QueueItem = { id: string; table: AttendanceTable; payload: Record<string, unknown>; timestamp: string; status: "pending" | "synced"; lastError?: string };
const key = "fd_pending_sync";

// upsert so re-saving the same day doesn't hit the unique key
const conflictTargets: Record<AttendanceTable, string> = {
  student_attendance: "student_id,class_id,date",
  teacher_attendance: "teacher_id,date",
  employee_attendance: "employee_profile_id,date",
};

function readQueue(): QueueItem[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueueItem[]) {
  localStorage.setItem(key, JSON.stringify(items));
  window.dispatchEvent(new Event(offlineSyncEventName()));
}

function isNetworkError(message: string) {
  return /fetch|network|offline|load failed/i.test(message);
}

type SyncError = { message: string; code?: string; status?: number };

// keep transient failures for a retry
function isTransient(error: SyncError) {
  const status = error.status ?? 0;
  if (isNetworkError(error.message)) return true;
  if (error.code === "PGRST301" || /jwt|token.*expired|expired.*token/i.test(error.message)) return true;
  if (status === 401 || status === 408 || status === 429 || status >= 500) return true;
  if (error.code?.startsWith("22") || error.code?.startsWith("23") || error.code === "PGRST204" || error.code === "42501") return false;
  if ([400, 403, 409, 422].includes(status)) return false;
  return status < 400;
}

export function pendingAttendanceCount() {
  return readQueue().filter((item) => item.status === "pending").length;
}

type SyncResult = { synced: number; pending: number; failed: string[]; failedIds: string[] };
let syncing: Promise<SyncResult> | null = null;

export function syncAttendanceQueue() {
  if (syncing) return syncing;
  syncing = (async () => {
    const items = readQueue().filter((item) => item.status === "pending");
    if (typeof navigator === "undefined" || !navigator.onLine || !items.length) return { synced: 0, pending: items.length, failed: [] as string[], failedIds: [] as string[] };
    const supabase = createSupabaseBrowserClient();
    // the token may have expired while offline
    await supabase.auth.getSession().catch(() => null);
    const done = new Set<string>();
    const failures: string[] = [];
    const failedIds: string[] = [];
    for (const item of items) {
      const { error: upsertError, status } = await supabase.from(item.table).upsert(item.payload, { onConflict: conflictTargets[item.table] });
      if (!upsertError) {
        done.add(item.id);
        continue;
      }
      if (isTransient({ message: upsertError.message, code: upsertError.code, status })) break;
      done.add(item.id);
      failures.push(upsertError.message);
      failedIds.push(item.id);
    }
    const remaining = readQueue().filter((item) => !done.has(item.id));
    writeQueue(remaining);
    return { synced: done.size - failures.length, pending: remaining.filter((item) => item.status === "pending").length, failed: failures, failedIds };
  })().catch(() => ({ synced: 0, pending: pendingAttendanceCount(), failed: [] as string[], failedIds: [] as string[] })).finally(() => { syncing = null; });
  return syncing;
}

export function useOfflineQueue() {
  const [pending, setPending] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const sync = useCallback(async () => {
    const result = await syncAttendanceQueue();
    setPending(result.pending);
    setError(result.failed.length ? `${result.failed.length} record${result.failed.length === 1 ? "" : "s"} could not be saved: ${[...new Set(result.failed)].join("; ")}` : "");
    setMessage(result.synced ? `Saved ${result.synced} record${result.synced === 1 ? "" : "s"}` : "");
    return result;
  }, []);

  const enqueue = useCallback(async (table: AttendanceTable, payload: Record<string, unknown>) => {
    const item: QueueItem = { id: crypto.randomUUID(), table, payload, timestamp: new Date().toISOString(), status: "pending" };
    writeQueue([...readQueue(), item]);
    setPending((value) => value + 1);
    return item.id;
  }, []);

  useEffect(() => {
    void sync();
    window.addEventListener("online", sync);
    const timer = window.setInterval(() => { if (pendingAttendanceCount() > 0) void sync(); }, 30000);
    return () => {
      window.removeEventListener("online", sync);
      window.clearInterval(timer);
    };
  }, [sync]);

  return { enqueue, sync, pending, message, error };
}
