import { describe, expect, it } from "vitest";

import { contentSecurityPolicy, securityHeaders } from "@/lib/security/headers";

describe("security headers", () => {
  it("only lets the browser connect to the app and the Supabase project", () => {
    const csp = contentSecurityPolicy({ supabaseUrl: "https://abcd.supabase.co/", dev: false });
    expect(csp).toContain("connect-src 'self' https://abcd.supabase.co wss://abcd.supabase.co;");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("ignores a malformed Supabase URL rather than emitting a broken policy", () => {
    expect(contentSecurityPolicy({ supabaseUrl: "not a url", dev: false })).toContain("connect-src 'self';");
  });

  it("allows eval and hot reload only in development", () => {
    const csp = contentSecurityPolicy({ dev: true });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("includes the baseline headers", () => {
    const keys = securityHeaders({ dev: false }).map((h) => h.key);
    expect(keys).toEqual(expect.arrayContaining(["X-Frame-Options", "X-Content-Type-Options", "Strict-Transport-Security", "Referrer-Policy"]));
  });
});
