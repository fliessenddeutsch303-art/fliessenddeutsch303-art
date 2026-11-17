import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { academyDateOf, academyDayStartIso } from "@/lib/dates";

function nextDay(day: string) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export type MoneyEntry = { date: string; amount: number; source: "treasury" | "student_payment" | "book"; type: "income" | "expense"; category: string };

// Every place money is recorded: treasury entries, paid student account records and paid books.
// Student payments and books are kept as their own sources so they can be told apart from manual treasury income.
export async function loadMoney(supabase: SupabaseClient, from: string, to?: string) {
  const [treasury, payments, books] = await Promise.all([
    fetchAll((start, end) => (to ? supabase.from("treasury_records").select("id,type,amount,date,category").gte("date", from).lte("date", to) : supabase.from("treasury_records").select("id,type,amount,date,category").gte("date", from)).order("id").range(start, end)),
    fetchAll((start, end) => (to ? supabase.from("student_account_records").select("id,amount,paid_at").eq("status", "paid").gte("paid_at", academyDayStartIso(from)).lt("paid_at", academyDayStartIso(nextDay(to))) : supabase.from("student_account_records").select("id,amount,paid_at").eq("status", "paid").gte("paid_at", academyDayStartIso(from))).order("id").range(start, end)),
    fetchAll((start, end) => (to ? supabase.from("student_books").select("id,price,paid_at,title").eq("payment_status", "paid").gte("paid_at", from).lte("paid_at", to) : supabase.from("student_books").select("id,price,paid_at,title").eq("payment_status", "paid").gte("paid_at", from)).order("id").range(start, end)),
  ]);
  const entries: MoneyEntry[] = [
    ...(treasury.data ?? []).map((row) => ({ date: String(row.date), amount: Number(row.amount ?? 0), source: "treasury" as const, type: row.type === "expense" ? "expense" as const : "income" as const, category: String(row.category ?? "") })),
    ...(payments.data ?? []).map((row) => ({ date: academyDateOf(row.paid_at), amount: Number(row.amount ?? 0), source: "student_payment" as const, type: "income" as const, category: "Student payments" })),
    ...(books.data ?? []).map((row) => ({ date: String(row.paid_at), amount: Number(row.price ?? 0), source: "book" as const, type: "income" as const, category: "Books" })),
  ];
  return { entries, error: treasury.error ?? payments.error ?? books.error };
}

export function moneyTotals(entries: MoneyEntry[], match: (date: string) => boolean) {
  const rows = entries.filter((entry) => match(entry.date));
  const sum = (filter: (entry: MoneyEntry) => boolean) => rows.filter(filter).reduce((total, entry) => total + entry.amount, 0);
  const treasuryIncome = sum((entry) => entry.source === "treasury" && entry.type === "income");
  const studentPayments = sum((entry) => entry.source === "student_payment");
  const books = sum((entry) => entry.source === "book");
  const income = treasuryIncome + studentPayments + books;
  const expenses = sum((entry) => entry.type === "expense");
  return { treasuryIncome, studentPayments, books, income, expenses, profit: income - expenses };
}
