"use client";

import { useEffect, useState } from "react";
import { pendingWriteCount, offlineSyncEventName, syncPendingWrites } from "@/lib/offline-write-queue";

export function OfflineSyncBanner() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [synced, setSynced] = useState(0);

  useEffect(() => {
    const nativeFetch = window.fetch.bind(window);
    const refresh = () => {
      setOnline(navigator.onLine);
      setPending(pendingWriteCount());
    };
    const sync = () => {
      refresh();
      void syncPendingWrites(nativeFetch).then((result) => {
        setPending(result.pending);
        if (result.synced) setSynced(result.synced);
      });
    };
    refresh();
    window.addEventListener("online", sync);
    window.addEventListener("offline", refresh);
    window.addEventListener(offlineSyncEventName(), refresh);
    sync();
    return () => {
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

  if (online && pending === 0 && synced === 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-3 z-[100] flex justify-center px-3" role="status" aria-live="polite">
      <div className={`rounded-md border px-4 py-3 text-sm shadow-lg ${online ? "border-green-200 bg-green-50 text-green-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
        {!online ? `You are offline. ${pending} change${pending === 1 ? "" : "s"} saved locally and will sync when reconnected.` : `Synced ${synced} change${synced === 1 ? "" : "s"}. ${pending ? `${pending} still pending.` : ""}`}
      </div>
    </div>
  );
}
