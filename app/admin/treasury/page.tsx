import { TreasuryForm } from "@/components/forms/simple-record-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TreasuryRecordsTable } from "@/components/tables/treasury-records-table";
import { getCurrentUser } from "@/lib/auth";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { academyMonthStart } from "@/lib/dates";
import { dictionaries } from "@/lib/i18n";
import { getCurrentLanguage } from "@/lib/i18n-server";
import { formatMoney } from "@/lib/utils";

export default async function TreasuryPage() {
  const { supabase } = await getCurrentUser("admin");
  const lang = await getCurrentLanguage();
  const t = dictionaries[lang].treasuryPage;
  const { data } = await fetchAll((from, to) => supabase.from("treasury_records").select("*").order("date", { ascending: false }).order("id").range(from, to));
  const monthStart = academyMonthStart();
  const monthRows = (data ?? []).filter((row) => String(row.date) >= monthStart);
  const monthTotal = monthRows.reduce((sum, row) => sum + (row.type === "income" ? Number(row.amount) : -Number(row.amount)), 0);
  const byCategory = monthRows.reduce<Record<string, number>>((acc, row) => ({ ...acc, [row.category]: (acc[row.category] ?? 0) + (row.type === "income" ? Number(row.amount) : -Number(row.amount)) }), {});
  const rows = (data ?? []).map((row) => ({ ...row, type: row.type === "income" ? t.income : t.expense, type_value: row.type })) as unknown as Array<Record<string, unknown> & { id: string; type_value: "income" | "expense" }>;
  return <div className="space-y-6"><TreasuryForm labels={t} /><Card><CardHeader><CardTitle>{t.monthlyBreakdown} · {monthStart.slice(0, 7)}</CardTitle></CardHeader><CardContent>{!monthRows.length && <p className="text-sm text-muted-foreground">{t.noRecords}</p>}{Object.entries(byCategory).map(([category, amount]) => <p key={category} className="flex justify-between border-b py-2"><span>{category}</span><span>{formatMoney(amount)}</span></p>)}{monthRows.length > 0 && <p className="flex justify-between pt-2 font-semibold"><span>Net</span><span>{formatMoney(monthTotal)}</span></p>}</CardContent></Card><TreasuryRecordsTable rows={rows} labels={t} /></div>;
}
