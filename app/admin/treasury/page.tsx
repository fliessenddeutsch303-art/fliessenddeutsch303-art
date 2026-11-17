import { TreasuryForm } from "@/components/forms/simple-record-forms";
import { TreasuryRecordsTable } from "@/components/tables/treasury-records-table";
import { getCurrentUser } from "@/lib/auth";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { dictionaries } from "@/lib/i18n";
import { getCurrentLanguage } from "@/lib/i18n-server";

export default async function TreasuryPage() {
  const { supabase } = await getCurrentUser("admin");
  const lang = await getCurrentLanguage();
  const t = dictionaries[lang].treasuryPage;
  const { data } = await fetchAll((from, to) => supabase.from("treasury_records").select("*").order("date", { ascending: false }).order("id").range(from, to));
  const rows = (data ?? []).map((row) => ({ ...row, type: row.type === "income" ? t.income : t.expense, type_value: row.type })) as unknown as Array<Record<string, unknown> & { id: string; type_value: "income" | "expense" }>;
  return <div className="space-y-6"><TreasuryForm labels={t} /><TreasuryRecordsTable rows={rows} labels={t} canDelete /></div>;
}
