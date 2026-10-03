import { emailForHook, hookPayloadSchema, verifyHookSignature } from "@/lib/email/auth-hook";
import { sendEmail } from "@/lib/email/mailtrap";

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
  if (!signed) return hookError(401, "Invalid signature");

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
  if (!sent.ok) return hookError(502, `Email not sent: ${sent.reason}`);
  return Response.json({});
}

function hookError(status: number, message: string) {
  return Response.json({ error: { http_code: status, message } }, { status });
}
