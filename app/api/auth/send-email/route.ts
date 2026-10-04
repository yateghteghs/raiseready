import { emailForHook, hookPayloadSchema, verifyHookSignature } from "@/lib/email/auth-hook";
import { emailConfigured, sendEmail } from "@/lib/email/mailtrap";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Supabase "Send Email" auth hook (Authentication → Hooks). Supabase signs
 * each request with SEND_EMAIL_HOOK_SECRET; we send the email with Mailtrap.
 * A non-2xx reply makes Supabase report the sign-up or reset as failed.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const signed = verifyHookSignature(
    raw,
    {
      id: request.headers.get("webhook-id"),
      timestamp: request.headers.get("webhook-timestamp"),
      signature: request.headers.get("webhook-signature"),
    },
    process.env.SEND_EMAIL_HOOK_SECRET ?? "",
  );
  if (!signed) {
    // Most often the secret in Vercel doesn't match Supabase's hook. Record it
    // (Admin → Emails) only for requests that look like Supabase's, so the
    // reason is visible without digging through logs.
    const secretSet = Boolean(process.env.SEND_EMAIL_HOOK_SECRET);
    const reason = secretSet
      ? "Not sent: the hook secret in Vercel (SEND_EMAIL_HOOK_SECRET) doesn't match the one in Supabase → Authentication → Hooks"
      : "Not sent: SEND_EMAIL_HOOK_SECRET isn't set in Vercel (copy it from Supabase → Authentication → Hooks, then redeploy)";
    console.error(`[email] auth hook: ${reason}`);
    if (request.headers.get("webhook-id")) await recordHookRejection(raw, reason);
    return hookError(401, "Invalid signature");
  }

  let payload;
  try {
    payload = hookPayloadSchema.parse(JSON.parse(raw));
  } catch {
    return hookError(400, "Invalid payload");
  }

  const siteUrl = process.env.APP_URL || payload.email_data.site_url || "";
  const message = emailForHook(payload, siteUrl);
  if (!message) {
    console.error(`[email] auth hook: unsupported email type "${payload.email_data.email_action_type}"`);
    return hookError(400, "Unsupported email type");
  }
  const sent = await sendEmail(message);
  if (!sent.ok && !emailConfigured()) {
    // Without a token nothing can be sent; say so plainly in the logs.
    console.error("[email] auth hook: MAILTRAP_API_TOKEN isn't set, so the confirmation email can't be sent");
    return hookError(503, "Email isn't set up on RaiseReady (MAILTRAP_API_TOKEN missing)");
  }
  if (!sent.ok) {
    console.error(`[email] auth hook: Mailtrap didn't send "${message.category}": ${sent.reason}`);
    return hookError(502, `Email not sent: ${sent.reason}`);
  }
  return Response.json({});
}

function hookError(status: number, message: string) {
  return Response.json({ error: { http_code: status, message } }, { status });
}

/** Best-effort note in the email log for a hook call we had to reject. */
async function recordHookRejection(raw: string, reason: string) {
  try {
    const parsed = hookPayloadSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return;
    await createAdminClient()
      .from("email_log")
      .insert({
        to_email: parsed.data.user.email.slice(0, 320),
        category: `Auth: ${parsed.data.email_data.email_action_type}`.slice(0, 80),
        sender: "Supabase hook",
        accepted: false,
        reason,
      });
  } catch {
    // Nothing more to do: the reason is also in the server logs.
  }
}
