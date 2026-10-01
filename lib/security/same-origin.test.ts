import { describe, expect, it } from "vitest";

import { isSameOrigin } from "@/lib/security/same-origin";

const req = (headers: Record<string, string>) => new Request("https://app.example/api/x", { method: "POST", headers });

describe("isSameOrigin", () => {
  it("accepts requests from the same host", () => {
    expect(isSameOrigin(req({ origin: "https://raiseready-one.vercel.app", host: "raiseready-one.vercel.app" }))).toBe(true);
    expect(isSameOrigin(req({ origin: "https://a.app", host: "internal", "x-forwarded-host": "a.app" }))).toBe(true);
  });

  it("rejects other sites and missing origins", () => {
    expect(isSameOrigin(req({ origin: "https://evil.example", host: "raiseready-one.vercel.app" }))).toBe(false);
    expect(isSameOrigin(req({ host: "raiseready-one.vercel.app" }))).toBe(false);
    expect(isSameOrigin(req({ origin: "null", host: "raiseready-one.vercel.app" }))).toBe(false);
  });
});
