import { ManualLeadSheet } from "@/components/forms/manual-lead-sheet";
import { getCurrentUser } from "@/lib/auth";

export default async function SalesManualListsPage() {
  await getCurrentUser("sales");
  return <ManualLeadSheet canConvert />;
}
