import Image from "next/image";
import { PrintButton } from "@/components/ui/print-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { calculatePayslips } from "@/lib/payslip";
import { formatMoney } from "@/lib/utils";

function defaultStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

export default async function PayslipPage({ params, searchParams }: { params: Promise<{ kind: "teacher" | "worker"; id: string }>; searchParams: Promise<{ start?: string; end?: string }> }) {
  const { kind, id } = await params;
  const query = await searchParams;
  const start = query.start ?? defaultStart();
  const end = query.end ?? new Date().toISOString().slice(0, 10);
  const { supabase } = await getCurrentUser("admin");
  const row = (await calculatePayslips(supabase, start, end)).find((item) => item.kind === kind && item.id === id);
  if (!row) return <div className="rounded-lg border bg-white p-6">Payslip not found.</div>;

  return (
    <main className="min-h-screen bg-white p-6 text-black print:p-0">
      <Card className="mx-auto max-w-3xl border-black/20 print:border-0 print:shadow-none">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-4">
            <Image src="/fliessend-logo-transparent.webp" alt="Fließend Deutsch" width={150} height={85} className="object-contain" />
            <div className="text-right">
              <CardTitle>Payslip</CardTitle>
              <p className="text-sm text-muted-foreground">{start} to {end}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          <section className="grid gap-2 md:grid-cols-2">
            <p><strong>Name:</strong> {row.name}</p>
            <p><strong>Role:</strong> {row.role}</p>
            <p><strong>Pay type:</strong> {row.payType}</p>
            <p><strong>Generated:</strong> {new Date().toISOString().slice(0, 10)}</p>
          </section>

          <section className="grid gap-4 md:grid-cols-4">
            <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Hours</p><p className="text-2xl font-semibold">{row.hours.toFixed(2)}</p></div>
            <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Sessions</p><p className="text-2xl font-semibold">{row.sessions}</p></div>
            <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Bonuses</p><p className="text-2xl font-semibold">{formatMoney(row.bonuses)}</p></div>
            <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Deductions</p><p className="text-2xl font-semibold">{formatMoney(row.deductions)}</p></div>
          </section>

          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b"><td className="py-3">Base pay</td><td className="text-right">{formatMoney(row.basePay)}</td></tr>
              <tr className="border-b"><td className="py-3">Bonuses</td><td className="text-right">{formatMoney(row.bonuses)}</td></tr>
              <tr className="border-b"><td className="py-3">Deductions</td><td className="text-right">-{formatMoney(row.deductions)}</td></tr>
              <tr className="text-lg font-semibold"><td className="py-3">Total payable</td><td className="text-right">{formatMoney(row.net)}</td></tr>
            </tbody>
          </table>

          {row.notes.length > 0 && (
            <section>
              <h2 className="mb-2 font-semibold">Adjustment notes</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {row.notes.map((note) => <li key={note}>{note}</li>)}
              </ul>
            </section>
          )}

          <div className="flex justify-between pt-10 text-sm">
            <p>Employee signature</p>
            <p>Admin signature</p>
          </div>
          <div className="print:hidden"><PrintButton label="Print payslip" /></div>
        </CardContent>
      </Card>
    </main>
  );
}
