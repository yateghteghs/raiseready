import { describe, expect, it } from "vitest";

import { isAppLink, notificationSchema } from "@/lib/notifications/schema";

describe("notifications", () => {
  it("only allows links inside the app", () => {
    expect(isAppLink("/app/billing")).toBe(true);
    expect(isAppLink("/app")).toBe(true);
    expect(isAppLink("/app/investor-room?x=1")).toBe(true);
    expect(isAppLink("https://evil.example")).toBe(false);
    expect(isAppLink("//evil.example/app")).toBe(false);
    expect(isAppLink("/app//evil.example")).toBe(false);
    expect(isAppLink("/login")).toBe(false);
    expect(isAppLink("/app/<script>")).toBe(false);
  });

  it("needs an email when sending to one person", () => {
    const base = { title: "Hi", body: "Hello", link: "" };
    expect(notificationSchema.safeParse({ ...base, audience: "all", email: "" }).success).toBe(true);
    expect(notificationSchema.safeParse({ ...base, audience: "one", email: "" }).success).toBe(false);
    expect(notificationSchema.safeParse({ ...base, audience: "one", email: "ada@example.com" }).success).toBe(true);
  });
});
