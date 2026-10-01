import { describe, expect, it } from "vitest";

import { checkAppUrl, checkPublicKey, checkServiceKey, checkSupabaseUrl, supabaseKeyKind } from "@/lib/health";

const jwt = (role: string) =>
  ["e30", Buffer.from(JSON.stringify({ role })).toString("base64url"), "sig"].join(".");

describe("health checks", () => {
  it("identifies key types", () => {
    expect(supabaseKeyKind("sb_publishable_abc")).toBe("publishable");
    expect(supabaseKeyKind("sb_secret_abc")).toBe("secret");
    expect(supabaseKeyKind(jwt("anon"))).toBe("anon-jwt");
    expect(supabaseKeyKind(jwt("service_role"))).toBe("service-jwt");
    expect(supabaseKeyKind("hello")).toBe("unknown");
  });

  it("flags a secret key used as the public key", () => {
    expect(checkPublicKey("sb_secret_abc").ok).toBe(false);
    expect(checkPublicKey(jwt("service_role")).detail).toMatch(/SECRET/);
    expect(checkPublicKey("sb_publishable_abc").ok).toBe(true);
  });

  it("flags a public key used as the service key", () => {
    expect(checkServiceKey("sb_publishable_abc").ok).toBe(false);
    expect(checkServiceKey(jwt("service_role")).ok).toBe(true);
  });

  it.each([
    ["missing", undefined],
    ["dashboard link", "https://supabase.com/dashboard/project/abcd"],
    ["no https", "http://abcd.supabase.co"],
    ["extra path", "https://abcd.supabase.co/rest/v1"],
    ["not a URL", "abcd.supabase.co"],
    ["surrounding spaces", " https://abcd.supabase.co"],
  ])("rejects a Supabase URL that is %s", (_label, url) => {
    expect(checkSupabaseUrl(url).ok).toBe(false);
  });

  it("accepts a project URL", () => {
    expect(checkSupabaseUrl("https://abcd.supabase.co").ok).toBe(true);
  });

  it("wants APP_URL without a trailing slash", () => {
    expect(checkAppUrl("https://raiseready-one.vercel.app").ok).toBe(true);
    expect(checkAppUrl("https://raiseready-one.vercel.app/").ok).toBe(false);
  });
});
