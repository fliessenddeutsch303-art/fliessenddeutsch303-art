import { ManualLeadSheet } from "@/components/forms/manual-lead-sheet";
import { getCurrentUser } from "@/lib/auth";

export default async function ReceptionManualSalesListsPage() {
  await getCurrentUser("reception");
  return <ManualLeadSheet canConvert canEdit={false} />;
}
