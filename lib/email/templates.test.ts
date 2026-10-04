import { describe, expect, it } from "vitest";

import { staffInviteEmail } from "@/lib/email/templates";

describe("email templates", () => {
  it("includes the link in both versions and escapes names in the HTML", () => {
    const email = staffInviteEmail({ name: "<b>Kemi</b>", role: "Support", link: "https://rr.example/auth/callback?token_hash=A&type=invite" });
    expect(email.subject).toBe("You've been invited to RaiseReady admin");
    expect(email.text).toContain("https://rr.example/auth/callback?token_hash=A&type=invite");
    expect(email.html).toContain("token_hash=A&amp;type=invite");
    expect(email.html).toContain("&lt;b&gt;Kemi&lt;/b&gt;");
    expect(email.html).not.toContain("<b>Kemi</b>");
  });
});

describe("email logo", () => {
  it("shows the logo from the website, with the name as fallback text", async () => {
    const { vi } = await import("vitest");
    vi.stubEnv("APP_URL", "https://raiseready.example/");
    const { testEmail } = await import("@/lib/email/templates");
    expect(testEmail({ sentBy: "a@b.c" }).html).toContain('<img src="https://raiseready.example/brand/raiseready-logo.png" width="180" height="34" alt="RaiseReady"');
    vi.stubEnv("APP_URL", "");
    expect(testEmail({ sentBy: "a@b.c" }).html).not.toContain("<img");
    vi.unstubAllEnvs();
  });
});
