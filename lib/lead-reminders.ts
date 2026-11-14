import type { SupabaseClient } from "@supabase/supabase-js";

export const isoDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);

// assigned rep + active admins
export async function reminderRecipients(admin: SupabaseClient, assignedTo: string | null | undefined) {
  const { data: admins, error } = await admin.from("users").select("id").eq("role", "admin").eq("is_active", true);
  if (error) return { ids: [] as string[], error };
  const ids = new Set((admins ?? []).map((user: { id: string }) => user.id));
  if (assignedTo) {
    const { data: rep } = await admin.from("users").select("id").eq("id", assignedTo).eq("is_active", true).maybeSingle();
    if (rep) ids.add(rep.id);
  }
  return { ids: [...ids], error: null };
}
