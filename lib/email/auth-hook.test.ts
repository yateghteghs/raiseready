import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { emailForHook, hookPayloadSchema, verifyHookSignature } from "@/lib/email/auth-hook";

const rawKey = Buffer.from("a-test-secret-for-the-hook");
const secret = `v1,whsec_${rawKey.toString("base64")}`;
const now = 1_790_000_000_000;

function sign(body: string, id = "msg_1", timestamp = String(now / 1000)) {
  const sig = createHmac("sha256", rawKey).update(`${id}.${timestamp}.${body}`).digest("base64");
  return { id, timestamp, signature: `v1,${sig}` };
}

const payload = (type: string, extra: Record<string, unknown> = {}) =>
  hookPayloadSchema.parse({
    user: { email: "ada@x.example", user_metadata: { full_name: "Ada Obi" } },
    email_data: { token: "123456", token_hash: "HASH", email_action_type: type, site_url: "https://ignored.example", ...extra },
  });

describe("Supabase send-email hook", () => {
  it("accepts only correctly signed, recent requests", () => {
    const body = '{"a":1}';
    expect(verifyHookSignature(body, sign(body), secret, now)).toBe(true);
    expect(verifyHookSignature('{"a":2}', sign(body), secret, now)).toBe(false);
    expect(verifyHookSignature(body, sign(body), `v1,whsec_${Buffer.from("other").toString("base64")}`, now)).toBe(false);
    expect(verifyHookSignature(body, sign(body, "msg_1", String(now / 1000 - 600)), secret, now)).toBe(false);
    expect(verifyHookSignature(body, { id: null, timestamp: null, signature: null }, secret, now)).toBe(false);
    // Several signatures may be sent (during secret rotation); one valid one is enough.
    const good = sign(body);
    expect(verifyHookSignature(body, { ...good, signature: `v1,AAAA ${good.signature}` }, secret, now)).toBe(true);
  });

  it("builds sign-up and reset emails with links that work on any device", () => {
    const signup = emailForHook(payload("signup"), "https://raiseready.example/");
    expect(signup).toMatchObject({ to: [{ email: "ada@x.example", name: "Ada Obi" }], subject: "Confirm your RaiseReady account", category: "Auth: signup" });
    expect(signup?.text).toContain("https://raiseready.example/auth/callback?token_hash=HASH&type=email&next=%2Fapp%2Fonboarding");

    const reset = emailForHook(payload("recovery"), "https://raiseready.example");
    expect(reset?.subject).toBe("Reset your RaiseReady password");
    expect(reset?.text).toContain("type=recovery&next=%2Freset-password");

    const change = emailForHook(payload("email_change", { token_hash_new: "NEWHASH" }), "https://raiseready.example");
    expect(change?.text).toContain("token_hash=NEWHASH&type=email_change");

    expect(emailForHook(payload("reauthentication"), "https://raiseready.example")?.text).toContain("123456");
    expect(emailForHook(payload("something_new"), "https://raiseready.example")).toBeNull();
  });
});
