import { describe, expect, it } from "vitest";

import { authRedirectFor } from "@/lib/auth/routes";

describe("authRedirectFor", () => {
  it("sends signed-out visitors of /app to login, remembering where they were going", () => {
    expect(authRedirectFor("/app/startup", "?x=1", false)).toBe(
      "/login?next=%2Fapp%2Fstartup%3Fx%3D1",
    );
  });

  it("protects /admin", () => {
    expect(authRedirectFor("/admin", "", false)).toBe("/login?next=%2Fadmin");
  });

  it("does not treat look-alike paths as protected", () => {
    expect(authRedirectFor("/apply", "", false)).toBeNull();
    expect(authRedirectFor("/administrator-info", "", false)).toBeNull();
  });

  it("leaves public pages alone", () => {
    expect(authRedirectFor("/", "", false)).toBeNull();
    expect(authRedirectFor("/pricing", "", true)).toBeNull();
  });

  it("sends signed-in users away from login and sign-up", () => {
    expect(authRedirectFor("/login", "", true)).toBe("/app");
    expect(authRedirectFor("/register", "", true)).toBe("/app");
  });

  it("lets signed-in users reach reset-password and /app", () => {
    expect(authRedirectFor("/reset-password", "", true)).toBeNull();
    expect(authRedirectFor("/app", "", true)).toBeNull();
  });
});
