import { describe, expect, it } from "vitest";

import { friendlyAuthError } from "@/lib/auth/errors";
import { loginSchema, registerSchema, resetPasswordSchema } from "@/lib/auth/schemas";

describe("auth schemas", () => {
  it("normalises email addresses", () => {
    const r = loginSchema.parse({ email: "  Ada@Example.COM ", password: "x" });
    expect(r.email).toBe("ada@example.com");
  });

  it("rejects short passwords on sign-up", () => {
    const r = registerSchema.safeParse({ full_name: "Ada", email: "a@b.co", password: "short" });
    expect(r.success).toBe(false);
  });

  it("requires matching passwords on reset", () => {
    const r = resetPasswordSchema.safeParse({ password: "longenough1", confirm_password: "different1" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["confirm_password"]);
  });
});

describe("friendlyAuthError", () => {
  it("explains known errors", () => {
    expect(friendlyAuthError({ code: "invalid_credentials" })).toMatch(/don't match/);
  });

  it("never leaks unknown error details", () => {
    const message = friendlyAuthError({ code: "x", message: "db exploded at host 10.0.0.1" });
    expect(message).toBe("Something went wrong. Please try again. (Error code: x)");
  });

  it("recognises network failures", () => {
    expect(friendlyAuthError({ name: "AuthRetryableFetchError", status: 0 })).toMatch(/couldn't reach/);
  });
});
