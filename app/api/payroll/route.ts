import { NextResponse } from "next/server";
import { calculatePayslips } from "@/lib/payslip";
import { requireApiUser } from "@/lib/api-auth";

export async function GET(request: Request) {
  const auth = await requireApiUser(["admin"]);
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const start = url.searchParams.get("start") ?? "";
  const end = url.searchParams.get("end") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return NextResponse.json({ error: "Valid start and end dates are required" }, { status: 400 });
  if (start > end) return NextResponse.json({ error: "The start date must be before the end date." }, { status: 400 });
  try {
    const rows = (await calculatePayslips(auth.supabase, start, end)).map((row) => ({
      id: row.id,
      kind: row.kind,
      employee: row.name,
      role: row.role,
      payType: row.payType,
      hours: row.hours,
      sessions: row.sessions,
      basePay: row.basePay,
      bonuses: row.bonuses,
      deductions: row.deductions,
      net: row.net,
      notes: row.notes,
    }));
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Payroll could not be calculated." }, { status: 500 });
  }
}
