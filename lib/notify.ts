import { Resend } from "resend";

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.FROM_EMAIL);
}

/** Sends an email when Resend is configured. Returns why it was not sent instead of throwing. */
export async function sendEmail(message: { to: string; subject: string; html?: string; text?: string }) {
  if (!emailConfigured()) return { sent: false, reason: "Email is not configured (RESEND_API_KEY / FROM_EMAIL)." };
  const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({ from: process.env.FROM_EMAIL!, ...message } as Parameters<Resend["emails"]["send"]>[0]);
  return error ? { sent: false, reason: error.message } : { sent: true, reason: null };
}

export async function sendSecurityAlert(alert: { actor: string; entityType: string; entityId: string; details?: unknown }) {
  const to = process.env.SECURITY_ALERT_EMAIL || process.env.REPORT_EMAIL;
  if (!to) return { sent: false, reason: "SECURITY_ALERT_EMAIL is not configured." };
  return sendEmail({
    to,
    subject: "Fließend Deutsch security alert: record deleted",
    text: `A record was deleted.\nActor: ${alert.actor}\nType: ${alert.entityType}\nID: ${alert.entityId}\nDetails: ${JSON.stringify(alert.details ?? {})}`,
  });
}
