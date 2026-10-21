"use client";

const STORAGE_KEY = "fd_pending_writes";
const EVENT_NAME = "fd-offline-sync";
const mutatingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
let syncPromise: Promise<{ synced: number; pending: number }> | null = null;

export type PendingWrite = {
  id: string;
  url: string;
  method: string;
  headers: [string, string][];
  body: string | null;
  createdAt: string;
  lastError?: string;
};

function readQueue(): PendingWrite[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: PendingWrite[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function pendingWriteCount() {
  return readQueue().length;
}

function isSupabaseMutation(url: string, method: string) {
  if (!mutatingMethods.has(method.toUpperCase())) return false;
  try {
    const parsed = new URL(url, window.location.href);
    return parsed.pathname.includes("/rest/v1/");
  } catch {
    return false;
  }
}

function optimisticResponse(body: string | null, headers: Headers) {
  let parsed: unknown = null;
  try {
    parsed = body ? JSON.parse(body) : null;
  } catch {
    parsed = null;
  }
  const acceptsObject = headers.get("accept")?.includes("vnd.pgrst.object") ?? false;
  const value = Array.isArray(parsed) ? (parsed[0] ?? null) : parsed;
  const responseBody = acceptsObject ? value : Array.isArray(parsed) ? parsed : parsed == null ? [] : [parsed];
  return new Response(JSON.stringify(responseBody), {
    status: 201,
    headers: { "content-type": "application/json" },
  });
}

async function enqueueRequest(url: string, method: string, headers: Headers, body: string | null) {
  const queue = readQueue();
  queue.push({
    id: crypto.randomUUID(),
    url,
    method,
    headers: Array.from(headers.entries()).filter(([key]) => key.toLowerCase() !== "content-length"),
    body,
    createdAt: new Date().toISOString(),
  });
  writeQueue(queue);
}

export async function syncPendingWrites(nativeFetch: typeof window.fetch) {
  if (typeof window === "undefined" || !navigator.onLine) return { synced: 0, pending: pendingWriteCount() };
  if (syncPromise) return syncPromise;

  syncPromise = (async () => {
    let queue = readQueue();
    let synced = 0;
    for (const item of queue) {
      try {
        const response = await nativeFetch(item.url, {
          method: item.method,
          headers: new Headers(item.headers),
          body: item.body ?? undefined,
        });
        if (!response.ok) {
          queue = queue.map((entry) => entry.id === item.id ? { ...entry, lastError: `HTTP ${response.status}` } : entry);
          break;
        }
        queue = queue.filter((entry) => entry.id !== item.id);
        synced += 1;
        writeQueue(queue);
      } catch (error) {
        queue = queue.map((entry) => entry.id === item.id ? { ...entry, lastError: error instanceof Error ? error.message : "Network error" } : entry);
        writeQueue(queue);
        break;
      }
    }
    writeQueue(queue);
    return { synced, pending: queue.length };
  })().finally(() => {
    syncPromise = null;
  });
  return syncPromise;
}

export function createOfflineFetch(nativeFetch: typeof window.fetch) {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = input instanceof Request ? input.clone() : null;
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
    const headers = new Headers(init?.headers ?? request?.headers);
    const body = typeof init?.body === "string" ? init.body : request ? await request.text() : null;
    if (!isSupabaseMutation(url, method)) return nativeFetch(input, init);

    if (!navigator.onLine) {
      await enqueueRequest(url, method, headers, body);
      return optimisticResponse(body, headers);
    }

    try {
      return await nativeFetch(input, init);
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
      await enqueueRequest(url, method, headers, body);
      return optimisticResponse(body, headers);
    }
  };
}

export function offlineSyncEventName() {
  return EVENT_NAME;
}
