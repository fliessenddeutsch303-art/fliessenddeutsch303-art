import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils";

export default async function StudentReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const [studentResult, accounts] = await Promise.all([
    supabase.from("students").select("*").eq("id", id).single(),
    supabase.from("student_account_records").select("*").eq("student_id", id).order("created_at", { ascending: false }),
  ]);
  const student = studentResult.data;
  if (!student) return <div className="p-8">Receipt not found.</div>;
  const paid = Number(student.amount_paid ?? 0);
  const price = Number(student.total_price ?? 0);
  const balance = Math.max(0, price - paid);
  return (
    <main className="min-h-screen bg-white p-6 text-black print:p-0">
      <Card className="mx-auto max-w-3xl border-black/20 print:border-0 print:shadow-none">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-4">
            <Image src="/fliessend-logo-transparent.webp" alt="Fließend Deutsch" width={160} height={90} className="object-contain" />
            <div className="text-right">
              <CardTitle>Student Receipt</CardTitle>
              <p className="text-sm text-muted-foreground">Receipt date: {new Date().toISOString().slice(0, 10)}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          <section className="grid gap-2 md:grid-cols-2">
            <p><strong>Student:</strong> {student.full_name}</p>
            <p><strong>Phone:</strong> {student.phone}</p>
            <p><strong>Level:</strong> {student.level ?? ""}</p>
            <p><strong>Payment date arranged:</strong> {student.payment_due_date ?? ""}</p>
          </section>
          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Course price</p><p className="text-2xl font-semibold">{formatMoney(price)}</p></div>
            <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Paid</p><p className="text-2xl font-semibold">{formatMoney(paid)}</p></div>
            <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Not paid</p><p className="text-2xl font-semibold">{formatMoney(balance)}</p></div>
          </section>
          <section>
            <h2 className="mb-2 font-semibold">Payment records</h2>
            <table className="w-full text-sm">
              <thead><tr className="border-b"><th className="py-2 text-left">Receipt</th><th className="text-left">Amount</th><th className="text-left">Status</th><th className="text-left">Due date</th><th className="text-left">Notes</th></tr></thead>
              <tbody>{(accounts.data ?? []).map((item) => <tr key={item.id} className="border-b"><td className="py-2">{item.receipt_no ?? ""}</td><td>{formatMoney(Number(item.amount))}</td><td>{item.status}</td><td>{item.due_date ?? ""}</td><td>{item.notes ?? ""}</td></tr>)}</tbody>
            </table>
          </section>
          <div className="flex justify-between pt-8 text-sm">
            <p>Student signature</p>
            <p>Fließend Deutsch signature</p>
          </div>
          <p className="rounded-md bg-black px-4 py-2 text-center text-sm text-white print:hidden">Use the browser print command to print or save as PDF.</p>
        </CardContent>
      </Card>
    </main>
  );
}
