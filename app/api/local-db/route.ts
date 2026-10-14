import { NextResponse } from "next/server";
import { createLocalSupabaseClient } from "@/lib/local-db";

type Filter = { type: "eq" | "neq" | "in" | "gte" | "lte"; key: string; value: unknown };

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      table: string;
      operation: "select" | "insert" | "update" | "upsert" | "delete";
      payload?: Record<string, unknown> | Array<Record<string, unknown>> | null;
      filters?: Filter[];
      sortKey?: string | null;
      ascending?: boolean;
      singleRow?: boolean;
      head?: boolean;
      wantsCount?: boolean;
    };
    if (!body.table || !/^[a-z_]+$/.test(body.table)) return NextResponse.json({ error: "Invalid local table" }, { status: 400 });
    const client = createLocalSupabaseClient() as any;
    let query = client.from(body.table);
    if (body.operation === "insert") query = query.insert(body.payload ?? []);
    if (body.operation === "upsert") query = query.upsert(body.payload ?? []);
    if (body.operation === "update") query = query.update(body.payload ?? {});
    if (body.operation === "delete") query = query.delete();
    query = query.select("*", { count: body.wantsCount ? "exact" : undefined, head: body.head });
    for (const filter of body.filters ?? []) {
      if (filter.type === "eq") query = query.eq(filter.key, filter.value);
      if (filter.type === "neq") query = query.neq(filter.key, filter.value);
      if (filter.type === "in") query = query.in(filter.key, Array.isArray(filter.value) ? filter.value : []);
      if (filter.type === "gte") query = query.gte(filter.key, String(filter.value));
      if (filter.type === "lte") query = query.lte(filter.key, String(filter.value));
    }
    if (body.sortKey) query = query.order(body.sortKey, { ascending: body.ascending ?? true });
    const result = body.singleRow ? await query.single() : await query;
    if (body.operation !== "select" && body.table !== "audit_logs" && !result.error) {
      const changedRows = (Array.isArray(result.data) ? result.data : result.data ? [result.data] : []) as Array<Record<string, unknown>>;
      const auditClient = createLocalSupabaseClient() as any;
      for (const row of changedRows) {
        await auditClient.from("audit_logs").insert({
          actor_user_id: "local-admin",
          actor_name: "Admin",
          actor_email: "admin@local.test",
          action: body.operation === "upsert" ? "created" : body.operation === "insert" ? "created" : body.operation,
          entity_type: body.table,
          entity_id: String(row.id ?? "unknown"),
          details: { changed_fields: Object.keys(body.payload ?? {}), snapshot: row },
          created_at: new Date().toISOString(),
        });
      }
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Local database request failed" }, { status: 400 });
  }
}
