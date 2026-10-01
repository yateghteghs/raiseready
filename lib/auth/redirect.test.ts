import { describe, expect, it } from "vitest";

import { safeNextPath } from "@/lib/auth/redirect";

describe("safeNextPath", () => {
  it("keeps same-site paths with query and hash", () => {
    expect(safeNextPath("/app/startup?tab=1#x")).toBe("/app/startup?tab=1#x");
  });

  it.each([
    ["absolute URL", "https://evil.example/app"],
    ["protocol-relative URL", "//evil.example"],
    ["backslash trick", "/\\evil.example"],
    ["javascript URL", "javascript:alert(1)"],
    ["relative path", "app"],
    ["control characters", "/app\n//evil"],
    ["empty", ""],
    ["non-string", 42],
  ])("rejects %s", (_label, input) => {
    expect(safeNextPath(input)).toBe("/app");
  });

  it("uses the supplied fallback", () => {
    expect(safeNextPath(null, "/app/onboarding")).toBe("/app/onboarding");
  });
});
