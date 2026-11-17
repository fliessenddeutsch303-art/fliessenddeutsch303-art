import { getCurrentUser } from "@/lib/auth";
import { getCurrentLanguage } from "@/lib/i18n-server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { academyDate, academyMonthStart } from "@/lib/dates";
import { loadMoney, moneyTotals } from "@/lib/revenue";
import { formatMoney } from "@/lib/utils";
import { PrintActions } from "./print-actions";

// numbers and dates keep their order inside Arabic text
const Ltr = ({ children }: { children: React.ReactNode }) => <span dir="ltr" className="inline-block">{children}</span>;
const cash = (value: number) => <Ltr>{formatMoney(value)}</Ltr>;

const EN = {
  title: "Monthly treasury report", month: "Month", generated: "Generated", print: "Download PDF", back: "Back to treasury",
  income: "Total income", expenses: "Total expenses", profit: "Net profit", treasury: "Treasury income", studentPayments: "Student payments", books: "Books",
  daily: "Daily totals", date: "Date", categories: "By category", category: "Category", entries: "Treasury entries", type: "Type", amount: "Amount", description: "Description",
  incomeType: "Income", expenseType: "Expense", net: "Net", total: "Total", from: "from", to: "to", incomeRows: "Income entries", expenseRows: "Expense entries", subtotal: "Subtotal", enteredBy: "Entered by", forWhat: "Details", noIncome: "No income entered this month.", noExpense: "No expenses entered this month.", otherIncome: "Also counted in total income (not entered in treasury)", none: "No entries this month.", page: "Fließend Deutsch Academy",
};
const AR: typeof EN = {
  title: "تقرير الخزينة الشهري", month: "الشهر", generated: "تاريخ الإصدار", print: "تحميل PDF", back: "العودة إلى الخزينة",
  income: "إجمالي الإيرادات", expenses: "إجمالي المصروفات", profit: "صافي الربح", treasury: "إيرادات الخزينة", studentPayments: "مدفوعات الطلاب", books: "الكتب",
  daily: "الإجمالي اليومي", date: "التاريخ", categories: "حسب التصنيف", category: "التصنيف", entries: "قيود الخزينة", type: "النوع", amount: "المبلغ", description: "الوصف",
  incomeType: "إيراد", expenseType: "مصروف", net: "الصافي", total: "الإجمالي", from: "من", to: "إلى", incomeRows: "قيود الإيرادات", expenseRows: "قيود المصروفات", subtotal: "الإجمالي الفرعي", enteredBy: "أدخله", forWhat: "التفاصيل", noIncome: "لا توجد إيرادات مسجلة هذا الشهر.", noExpense: "لا توجد مصروفات مسجلة هذا الشهر.", otherIncome: "محسوب أيضًا في إجمالي الإيرادات (غير مسجل في الخزينة)", none: "لا توجد قيود في هذا الشهر.", page: "أكاديمية Fließend Deutsch",
};

function monthEnd(month: string) {
  const [year, value] = month.split("-").map(Number);
  return new Date(Date.UTC(year, value, 0)).toISOString().slice(0, 10);
}

export default async function TreasuryMonthReport({ searchParams }: { searchParams: Promise<{ month?: string; print?: string }> }) {
  const { supabase } = await getCurrentUser("admin");
  const lang = await getCurrentLanguage();
  const L = lang === "ar" ? AR : EN;
  const params = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(params.month ?? "") ? params.month! : academyMonthStart().slice(0, 7);
  const from = `${month}-01`;
  const to = monthEnd(month);
  const [money, treasury, users] = await Promise.all([
    loadMoney(supabase, from, to),
    fetchAll((start, end) => supabase.from("treasury_records").select("id,type,amount,date,category,description,created_by").gte("date", from).lte("date", to).order("date").order("id").range(start, end)),
    supabase.from("users").select("id,full_name"),
  ]).then(([loaded, records, people]) => [loaded, records, people] as const);
  const totals = moneyTotals(money.entries, () => true);
  const days = [...new Set(money.entries.map((entry) => entry.date))].sort().map((date) => ({ date, ...moneyTotals(money.entries, (value) => value === date) }));
  const categories = new Map<string, { income: number; expense: number }>();
  for (const entry of money.entries) {
    const label = entry.source === "student_payment" ? L.studentPayments : entry.source === "book" ? L.books : entry.category || "-";
    const current = categories.get(label) ?? { income: 0, expense: 0 };
    current[entry.type === "expense" ? "expense" : "income"] += entry.amount;
    categories.set(label, current);
  }
  const rows = [...(treasury.data ?? [])].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const who = (id: string | null) => (users.data ?? []).find((user) => user.id === id)?.full_name ?? "";
  const incomeRows = rows.filter((row) => row.type !== "expense");
  const expenseRows = rows.filter((row) => row.type === "expense");
  const sumOf = (list: typeof rows) => list.reduce((total, row) => total + Number(row.amount ?? 0), 0);
  const cell = "border border-black/20 px-2 py-1.5 text-start";
  const head = `${cell} bg-black/5 font-semibold`;

  return (
    <main dir={lang === "ar" ? "rtl" : "ltr"} className="treasury-report mx-auto min-h-screen max-w-[210mm] bg-white p-8 text-[12px] text-black print:max-w-none print:p-0">
      <PrintActions label={L.print} back="/admin/treasury" backLabel={L.back} autoPrint={params.print === "1"} />
      <div className="flex items-start justify-between gap-4 border-b-4 border-[#DD0000] pb-3">
        <div>
          <h1 className="text-xl font-bold">{L.title}</h1>
          <p className="mt-1">{L.month}: <strong><Ltr>{month}</Ltr></strong> · {L.from} <Ltr>{from}</Ltr> {L.to} <Ltr>{to}</Ltr></p>
          <p className="text-black/60">{L.generated}: <Ltr>{academyDate()}</Ltr></p>
        </div>
        <img src="/fliessend-logo-transparent.webp" alt="Fließend Deutsch" className="h-14 w-auto" />
      </div>

      <section className="mt-5 grid grid-cols-3 gap-3">
        <div className="rounded border border-black/20 p-3"><p className="text-black/60">{L.income}</p><p className="text-lg font-bold">{cash(totals.income)}</p><p className="mt-1 text-[10px] text-black/60">{L.treasury} {cash(totals.treasuryIncome)} · {L.studentPayments} {cash(totals.studentPayments)} · {L.books} {cash(totals.books)}</p></div>
        <div className="rounded border border-black/20 p-3"><p className="text-black/60">{L.expenses}</p><p className="text-lg font-bold">{cash(totals.expenses)}</p></div>
        <div className="rounded border border-black/20 p-3"><p className="text-black/60">{L.profit}</p><p className="text-lg font-bold">{cash(totals.profit)}</p></div>
      </section>


      {[{ title: L.incomeRows, list: incomeRows, empty: L.noIncome, tone: "text-green-800" }, { title: L.expenseRows, list: expenseRows, empty: L.noExpense, tone: "text-red-800" }].map((part) => (
        <section key={part.title} className="mt-6">
          <h2 className={`mb-2 text-sm font-bold ${part.tone}`}>{part.title} (<Ltr>{part.list.length}</Ltr>)</h2>
          <table className="w-full border-collapse">
            <thead><tr><th className={head}>#</th><th className={head}>{L.date}</th><th className={head}>{L.category}</th><th className={head}>{L.forWhat}</th><th className={head}>{L.enteredBy}</th><th className={head}>{L.amount}</th></tr></thead>
            <tbody>{part.list.map((row, index) => <tr key={row.id} className="break-inside-avoid"><td className={cell}><Ltr>{index + 1}</Ltr></td><td className={`${cell} whitespace-nowrap`}><Ltr>{row.date}</Ltr></td><td className={cell} dir="auto" translate="no">{row.category}</td><td className={cell} dir="auto" translate="no">{row.description ?? ""}</td><td className={cell} translate="no">{who(row.created_by)}</td><td className={`${cell} whitespace-nowrap`}>{cash(Number(row.amount ?? 0))}</td></tr>)}</tbody>
            {part.list.length > 0 && <tfoot><tr className="font-bold"><td className={cell} colSpan={5}>{L.subtotal}</td><td className={`${cell} whitespace-nowrap`}>{cash(sumOf(part.list))}</td></tr></tfoot>}
          </table>
          {!part.list.length && <p className="mt-2 text-black/60">{part.empty}</p>}
        </section>
      ))}
      {(totals.studentPayments > 0 || totals.books > 0) && <p className="mt-2 text-[11px] text-black/60">{L.otherIncome}: {L.studentPayments} {cash(totals.studentPayments)} · {L.books} {cash(totals.books)}</p>}

      <section className="mt-6 break-inside-avoid">
        <h2 className="mb-2 text-sm font-bold">{L.categories}</h2>
        <table className="w-full border-collapse">
          <thead><tr><th className={head}>{L.category}</th><th className={head}>{L.income}</th><th className={head}>{L.expenses}</th><th className={head}>{L.net}</th></tr></thead>
          <tbody>{[...categories].map(([name, value]) => <tr key={name}><td className={cell} dir="auto" translate="no">{name}</td><td className={cell}>{cash(value.income)}</td><td className={cell}>{cash(value.expense)}</td><td className={cell}>{cash(value.income - value.expense)}</td></tr>)}</tbody>
        </table>
        {!categories.size && <p className="mt-2 text-black/60">{L.none}</p>}
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-bold">{L.daily}</h2>
        <table className="w-full border-collapse">
          <thead><tr><th className={head}>{L.date}</th><th className={head}>{L.income}</th><th className={head}>{L.expenses}</th><th className={head}>{L.net}</th></tr></thead>
          <tbody>{days.map((day) => <tr key={day.date} className="break-inside-avoid"><td className={cell}><Ltr>{day.date}</Ltr></td><td className={cell}>{cash(day.income)}</td><td className={cell}>{cash(day.expenses)}</td><td className={cell}>{cash(day.profit)}</td></tr>)}</tbody>
          {days.length > 0 && <tfoot><tr className="font-bold"><td className={cell}>{L.total}</td><td className={cell}>{cash(totals.income)}</td><td className={cell}>{cash(totals.expenses)}</td><td className={cell}>{cash(totals.profit)}</td></tr></tfoot>}
        </table>
      </section>


      <p className="mt-8 border-t pt-2 text-[10px] text-black/50">{L.page} · {L.title} · <Ltr>{month}</Ltr></p>
    </main>
  );
}
