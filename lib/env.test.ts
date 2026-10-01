import { afterEach, describe, expect, it, vi } from "vitest";

import { parsePublicEnv, parseServerEnv, serverEnv } from "@/lib/env";

const validServer = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  ANTHROPIC_API_KEY: "sk-ant",
  ANTHROPIC_MODEL: "model-id",
  PAYSTACK_SECRET_KEY: "sk_test",
  NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY: "pk_test",
  APP_URL: "http://localhost:3000",
};

describe("env", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("accepts a complete server environment", () => {
    expect(parseServerEnv(validServer)).toEqual(validServer);
  });

  it("names every missing variable in the error", () => {
    expect(() => parsePublicEnv({})).toThrowError(
      /NEXT_PUBLIC_SUPABASE_URL[\s\S]*NEXT_PUBLIC_SUPABASE_ANON_KEY/,
    );
  });

  it("rejects a malformed Supabase URL", () => {
    expect(() =>
      parsePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: "not a url", NEXT_PUBLIC_SUPABASE_ANON_KEY: "x" }),
    ).toThrowError(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("serverEnv validates only the requested keys", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
    vi.stubEnv("PAYSTACK_SECRET_KEY", "");

    expect(serverEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service",
    });
    expect(() => serverEnv("PAYSTACK_SECRET_KEY")).toThrowError(/PAYSTACK_SECRET_KEY/);
  });

  it("serverEnv refuses to run in the browser", () => {
    vi.stubGlobal("window", {});
    expect(() => serverEnv("SUPABASE_SERVICE_ROLE_KEY")).toThrowError(/browser/);
  });
});
