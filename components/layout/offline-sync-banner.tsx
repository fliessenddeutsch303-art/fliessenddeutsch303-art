"use client";

import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearOfflineQueues, pendingWriteCount, offlineSyncEventName, syncPendingWrites } from "@/lib/offline-write-queue";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { pendingAttendanceCount, syncAttendanceQueue } from "@/hooks/use-offline-queue";

export function OfflineSyncBanner() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [synced, setSynced] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);

  useEffect(() => {
    const nativeFetch = window.fetch.bind(window);
    const refresh = () => {
      setOnline(navigator.onLine);
      setPending(pendingWriteCount() + pendingAttendanceCount());
    };
    const sync = () => {
      refresh();
      const getAccessToken = async () => (await createSupabaseBrowserClient().auth.getSession()).data.session?.access_token ?? null;
      void Promise.all([syncPendingWrites(nativeFetch, getAccessToken), syncAttendanceQueue()]).then(([writes, attendance]) => {
        setPending(writes.pending + attendance.pending);
        if (writes.synced + attendance.synced) setSynced(writes.synced + attendance.synced);
        const rejected = [...writes.failed, ...attendance.failed];
        if (rejected.length) setFailed(rejected);
      });
    };
    refresh();
    window.addEventListener("online", sync);
    window.addEventListener("offline", refresh);
    window.addEventListener(offlineSyncEventName(), refresh);
    sync();
    const timer = window.setInterval(() => { if (pendingWriteCount() + pendingAttendanceCount() > 0) sync(); }, 30000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", refresh);
      window.removeEventListener(offlineSyncEventName(), refresh);
    };
  }, []);

  useEffect(() => {
    if (!synced) return;
    const timer = window.setTimeout(() => setSynced(0), 5000);
    return () => window.clearTimeout(timer);
  }, [synced]);

  if (failed.length) {
    return (
      <div className="fixed inset-x-0 bottom-3 z-[100] flex justify-center px-3" role="alert">
        <div className="max-w-xl rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-lg">
          <p className="font-semibold">{failed.length} offline change{failed.length === 1 ? " was" : "s were"} rejected by the server and not saved. Please re-enter {failed.length === 1 ? "it" : "them"}.</p>
          <p className="mt-1 break-words text-xs">{failed.join(" · ")}</p>
          <button type="button" className="mt-2 text-xs font-semibold underline" onClick={() => setFailed([])}>Dismiss</button>
        </div>
      </div>
    );
  }
  if (online && pending === 0 && synced === 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-3 z-[100] flex justify-center px-3" role="status" aria-live="polite">
      <div className={`rounded-md border px-4 py-3 text-sm shadow-lg ${online && pending === 0 ? "border-green-200 bg-green-50 text-green-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
        {!online ? `You are offline. ${pending} change${pending === 1 ? "" : "s"} waiting to upload; they will upload when you reconnect.` : pending > 0 ? `${pending} change${pending === 1 ? "" : "s"} waiting to upload.${synced ? ` ${synced} uploaded.` : ""}` : `Uploaded ${synced} change${synced === 1 ? "" : "s"}.`}
      </div>
    </div>
  );
}

// clears offline queues and caches on sign out (shared PCs)
export function SignOutForm({ label, className, wrapperClassName }: { label: string; className?: string; wrapperClassName?: string }) {
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    event.preventDefault();
    const waiting = pendingWriteCount() + pendingAttendanceCount();
    if (waiting > 0 && !window.confirm(`${waiting} change${waiting === 1 ? " is" : "s are"} still waiting to upload and will be lost if you sign out. Sign out anyway?`)) return;
    clearOfflineQueues();
    try {
      if (typeof caches !== "undefined") await Promise.all((await caches.keys()).map((name) => caches.delete(name)));
    } catch {}
    form.submit();
  }
  return (
    <form action="/api/auth/signout" method="post" className={wrapperClassName} onSubmit={(event) => void onSubmit(event)}>
      <Button className={className} variant="outline"><LogOut size={16} /> {label}</Button>
    </form>
  );
}
