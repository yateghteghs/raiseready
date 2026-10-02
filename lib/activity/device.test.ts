import { describe, expect, it } from "vitest";

import { deviceLabel } from "@/lib/activity/device";
import { hashEmail, isControlFlowError, lagosDay } from "@/lib/activity/service";

describe("activity helpers", () => {
  it("labels common browsers and platforms coarsely", () => {
    expect(deviceLabel("Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36")).toBe("Chrome on Android");
    expect(deviceLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1")).toBe("Safari on iOS");
    expect(deviceLabel("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0")).toBe("Edge on Windows");
    expect(deviceLabel("curl/8.0")).toBe("Other");
    expect(deviceLabel(null)).toBeNull();
  });

  it("hashes emails case-insensitively without keeping them", () => {
    expect(hashEmail(" Ada@Example.com ")).toBe(hashEmail("ada@example.com"));
    expect(hashEmail("ada@example.com")).not.toContain("ada");
  });

  it("counts days in Lagos time", () => {
    // 23:30 UTC is already the next day in Lagos (UTC+1).
    expect(lagosDay(Date.parse("2026-10-01T23:30:00Z"))).toBe("2026-10-02");
  });

  it("ignores redirects and 404s", () => {
    expect(isControlFlowError("NEXT_REDIRECT;replace;/login;307;", "")).toBe(true);
    expect(isControlFlowError("NEXT_HTTP_ERROR_FALLBACK;404", "")).toBe(true);
    expect(isControlFlowError("1037695728", "Cannot read properties of undefined")).toBe(false);
  });
});
