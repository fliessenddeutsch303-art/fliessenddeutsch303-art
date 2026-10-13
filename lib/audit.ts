"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export async function recordAudit(action: string, entityType: string, entityId: string, details: Record<string, unknown> = {}) {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase.auth.getUser();
  const actor = data.user;
  await supabase.from("audit_logs").insert({
    actor_user_id: actor?.id ?? null,
    actor_name: actor?.user_metadata?.full_name ?? actor?.email ?? "Admin",
    actor_email: actor?.email ?? "admin@local.test",
    action,
    entity_type: entityType,
    entity_id: entityId,
    details,
  });
  if (action === "deleted" && typeof window !== "undefined") {
    void fetch("/api/security-alert", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ actor: actor?.email ?? "Admin", entityType, entityId, details }) });
  }
}
