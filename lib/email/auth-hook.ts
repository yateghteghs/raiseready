import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import type { EmailMessage } from "@/lib/email/mailtrap";
import { accountEmail } from "@/lib/email/templates";

/**
 * Supabase's "Send Email" auth hook: instead of sending sign-up and password
 * emails over SMTP, Supabase posts them here and we send them with Mailtrap's
 * Email API. Requests are signed (Standard Webhooks) with the hook secret.
 */

/** Rejects requests older (or newer) than this, so a captured request can't be replayed later. */
const TOLERANCE_SECONDS = 5 * 60;

/**
 * Checks a Standard Webhooks signature. `secret` is what Supabase shows,
 * e.g. "v1,whsec_<base64>"; the signature header can hold several
 * space-separated "v1,<base64>" values.
 */
export function verifyHookSignature(
  body: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  secret: string,
  now = Date.now(),
): boolean {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature || !secret) return false;
  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt) || Math.abs(now / 1000 - sentAt) > TOLERANCE_SECONDS) return false;
  const key = Buffer.from(secret.replace(/^v1,/, "").replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest();
  return signature.split(" ").some((part) => {
    const [version, value] = part.split(",");
    if (version !== "v1" || !value) return false;
    const given = Buffer.from(value, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

export const hookPayloadSchema = z.object({
  user: z.object({
    email: z.string(),
    user_metadata: z.record(z.string(), z.unknown()).nullish(),
  }),
  email_data: z.object({
    token: z.string().nullish(),
    token_hash: z.string().nullish(),
    email_action_type: z.string(),
    site_url: z.string().nullish(),
    token_new: z.string().nullish(),
    token_hash_new: z.string().nullish(),
  }),
});

export type HookPayload = z.infer<typeof hookPayloadSchema>;

/** Where each kind of link lands, and the `type` our /auth/callback passes to verifyOtp. */
const ACTIONS: Record<string, { type: string; next: string; kind: "confirm" | "reset" | "signin" | "email_change" }> = {
  signup: { type: "email", next: "/app/onboarding", kind: "confirm" },
  recovery: { type: "recovery", next: "/reset-password", kind: "reset" },
  magiclink: { type: "magiclink", next: "/app", kind: "signin" },
  invite: { type: "invite", next: "/admin/welcome", kind: "signin" },
  email_change: { type: "email_change", next: "/app/settings", kind: "email_change" },
};

/**
 * The email to send for a hook request, or null for kinds we don't handle.
 * Links use `token_hash`, so they work in any browser or device.
 */
export function emailForHook(payload: HookPayload, siteUrl: string): EmailMessage | null {
  const { user, email_data: data } = payload;
  const name = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : undefined;
  const to = [{ email: user.email, ...(name ? { name } : {}) }];

  if (data.email_action_type === "reauthentication") {
    if (!data.token) return null;
    return { to, ...accountEmail({ kind: "code", name, code: data.token }), category: "Auth: reauthentication" };
  }
  const action = ACTIONS[data.email_action_type];
  // For an email change, the link to confirm the new address uses the "new" token when both are present.
  const tokenHash = data.email_action_type === "email_change" ? data.token_hash_new || data.token_hash : data.token_hash;
  if (!action || !tokenHash) return null;
  const base = siteUrl.replace(/\/+$/, "");
  const link = `${base}/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=${action.type}&next=${encodeURIComponent(action.next)}`;
  return { to, ...accountEmail({ kind: action.kind, name, link }), category: `Auth: ${data.email_action_type}` };
}
