import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MAILTRAP_SEND_URL, sendEmail } from "@/lib/email/mailtrap";

const message = { to: [{ email: "kemi@x.example", name: "Kemi" }], subject: "Hi", text: "Hello", html: "<p>Hello</p>", category: "Test" };

function fakeFetch(status: number, body: unknown) {
  return vi.fn(async (..._args: Parameters<typeof fetch>) => new Response(JSON.stringify(body), { status }));
}

describe("Mailtrap sending", () => {
  beforeEach(() => {
    vi.stubEnv("MAILTRAP_API_TOKEN", "test-token");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("posts the message to the Email API with the token and the configured sender", async () => {
    const fetcher = fakeFetch(200, { success: true, message_ids: ["m1"] });
    expect(await sendEmail(message, fetcher as never)).toEqual({ ok: true, ids: ["m1"] });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(MAILTRAP_SEND_URL);
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer test-token");
    expect(JSON.parse(String(init?.body))).toEqual({
      from: { email: "hello@indexprima.com", name: "RaiseReady" },
      to: [{ email: "kemi@x.example", name: "Kemi" }],
      subject: "Hi",
      text: "Hello",
      html: "<p>Hello</p>",
      category: "Test",
    });
  });

  it("returns Mailtrap's reason instead of throwing", async () => {
    expect(await sendEmail(message, fakeFetch(401, { success: false, errors: ["Unauthorized"] }) as never)).toEqual({ ok: false, reason: "Unauthorized" });
    const failing = vi.fn(async () => {
      throw new Error("network down");
    });
    expect(await sendEmail(message, failing as never)).toEqual({ ok: false, reason: "network down" });
  });

  it("sends nothing without a token", async () => {
    vi.stubEnv("MAILTRAP_API_TOKEN", "");
    const fetcher = fakeFetch(200, { success: true });
    expect(await sendEmail(message, fetcher as never)).toEqual({ ok: false, reason: "not_configured" });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
