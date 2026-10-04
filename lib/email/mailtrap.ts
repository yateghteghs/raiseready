import { serverEnv } from "@/lib/env";
import { SITE } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";

/** Mailtrap's transactional Email API (the "Transactional Stream"). */
export const MAILTRAP_SEND_URL = "https://send.api.mailtrap.io/api/send";

export type EmailMessage = {
  to: { email: string; name?: string }[];
  subject: string;
  text: string;
  html?: string;
  /** Groups messages in Mailtrap's Email Logs and stats, e.g. "Staff invite". */
  category: string;
  /** Which sender in `SITE.email` it comes from; account emails default to the no-reply one. */
  sender?: keyof typeof SITE.email;
};

export type SendResult = { ok: true; ids: string[] } | { ok: false; reason: string };

/** Whether a Mailtrap token is set. Without one, callers fall back to showing links on screen. */
export function emailConfigured(): boolean {
  return Boolean(process.env.MAILTRAP_API_TOKEN?.trim());
}

/**
 * Sends one email through Mailtrap. Never throws: email is best-effort, so a
 * failure is returned (and logged without the message body or token) for the
 * caller to explain, instead of breaking the action that triggered it.
 */
export async function sendEmail(message: EmailMessage, fetcher: typeof fetch = fetch): Promise<SendResult> {
  if (!emailConfigured()) return { ok: false, reason: "not_configured" };
  const result = await deliver(message, fetcher);
  await logEmail(message, result);
  return result;
}

/** Records what was handed to Mailtrap (Admin → Emails). Best-effort. */
async function logEmail(message: EmailMessage, result: SendResult): Promise<void> {
  try {
    const sender = SITE.email[message.sender ?? "system"].email;
    const { error } = await createAdminClient()
      .from("email_log")
      .insert(
        message.to.map((to) => ({
          to_email: to.email.slice(0, 320),
          category: message.category.slice(0, 80),
          sender,
          accepted: result.ok,
          message_id: result.ok ? (result.ids[0] ?? null) : null,
          reason: result.ok ? null : result.reason.slice(0, 500),
        })),
      );
    if (error) throw new Error(error.message);
  } catch (error) {
    console.error(`[email] couldn't record "${message.category}" in the email log: ${error instanceof Error ? error.message : error}`);
  }
}

async function deliver(message: EmailMessage, fetcher: typeof fetch): Promise<SendResult> {
  const { MAILTRAP_API_TOKEN } = serverEnv("MAILTRAP_API_TOKEN");
  try {
    const response = await fetcher(MAILTRAP_SEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${MAILTRAP_API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: SITE.email[message.sender ?? "system"],
        to: message.to,
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
        category: message.category,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await response.json().catch(() => null)) as { success?: boolean; message_ids?: string[]; errors?: string[] } | null;
    if (response.ok && body?.success) return { ok: true, ids: body.message_ids ?? [] };
    const reason = body?.errors?.join("; ") || `HTTP ${response.status}`;
    console.error(`[email] Mailtrap refused "${message.category}" (${response.status}): ${reason}`);
    return { ok: false, reason };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`[email] Mailtrap request failed for "${message.category}": ${reason}`);
    return { ok: false, reason };
  }
}
