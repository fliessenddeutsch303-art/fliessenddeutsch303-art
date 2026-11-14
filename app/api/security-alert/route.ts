import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { sendSecurityAlert } from "@/lib/notify";

const short = (value: unknown, fallback: string) => String(value ?? "").trim().slice(0, 80) || fallback;

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const payload = await request.json().catch(() => null) as { entityType?: string; entityId?: string; details?: unknown } | null;
  const details = JSON.stringify(payload?.details ?? {}).length <= 2000 ? payload?.details : { truncated: true };
  const result = await sendSecurityAlert({ actor: auth.profile.email ?? auth.profile.full_name, entityType: short(payload?.entityType, "Unknown"), entityId: short(payload?.entityId, "Unknown"), details });
  return NextResponse.json({ status: result.sent ? "sent" : "skipped", reason: result.reason });
}
