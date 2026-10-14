import { ManualLeadSheet } from "@/components/forms/manual-lead-sheet";
import { getCurrentUser } from "@/lib/auth";

export default async function AdminManualSalesListsPage() {
  const { supabase } = await getCurrentUser("admin");
  const { data: reps } = await supabase.from("users").select("id,full_name").eq("role", "sales").order("full_name");
  return <ManualLeadSheet canManage salesReps={(reps ?? []) as Array<{ id: string; full_name: string }>} canConvert />;
}
