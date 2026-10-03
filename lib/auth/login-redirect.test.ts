import { beforeEach, describe, expect, it, vi } from "vitest";

let profile: { role: string; status: string } | null = null;
let signUpError: { status: number; name: string } | null = null;
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error("redirect"), { to });
  },
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined }) }));
vi.mock("next/server", () => ({ after: () => {} }));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/activity/service", () => ({ recordSignIn: async () => {} }));
vi.mock("@/lib/site-url", () => ({ getSiteUrl: async () => "https://rr.example" }));
vi.mock("@/lib/referrals/service", () => ({ linkReferral: async () => {} }));
vi.mock("@/lib/i18n/server", () => ({ localiseState: async (s: unknown) => s }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      signInWithPassword: async () => ({ data: { user: { id: "u1" } }, error: null }),
      signUp: async () => ({ data: { user: null, session: null }, error: signUpError }),
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile }) }) }) }),
  }),
}));

const { login, register } = await import("@/lib/auth/actions");

async function landing(next?: string) {
  const form = new FormData();
  form.set("email", "ada@example.com");
  form.set("password", "secret-password");
  if (next) form.set("next", next);
  try {
    await login({ status: "idle" } as never, form);
  } catch (error) {
    return (error as { to?: string }).to;
  }
  return null;
}

describe("where people land after logging in", () => {
  beforeEach(() => {
    profile = null;
  });

  it("sends staff straight to the admin area, never to onboarding", async () => {
    profile = { role: "super_admin", status: "active" };
    expect(await landing()).toBe("/admin");
    expect(await landing("/app/onboarding")).toBe("/admin");
    // A link to a specific page is still honoured.
    expect(await landing("/app/reports")).toBe("/app/reports");
  });

  it("sends founders, and suspended staff, to the app", async () => {
    profile = { role: "founder", status: "active" };
    expect(await landing()).toBe("/app");
    profile = { role: "admin", status: "suspended" };
    expect(await landing()).toBe("/app");
  });
});

describe("sign-up errors", () => {
  it("says the confirmation email couldn't be sent when the mail step times out", async () => {
    signUpError = { status: 504, name: "AuthRetryableFetchError" };
    const form = new FormData();
    form.set("full_name", "Ada Obi");
    form.set("email", "ada@example.com");
    form.set("password", "a-long-password-1");
    form.set("confirm_password", "a-long-password-1");
    form.set("terms", "on");
    const state = await register({ status: "idle" } as never, form);
    expect(state).toMatchObject({ status: "error", message: expect.stringMatching(/couldn't send your confirmation email/) });
    signUpError = null;
  });
});
