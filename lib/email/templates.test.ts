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
