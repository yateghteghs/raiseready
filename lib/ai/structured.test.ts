import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const finalMessage = vi.fn();
const logAiCall = vi.fn();

vi.mock("@/lib/ai/client", () => ({
  getModel: () => "claude-opus-5-5",
  getAnthropic: () => ({ beta: { messages: { stream: () => ({ finalMessage }) } } }),
}));
vi.mock("@/lib/ai/usage", () => ({ logAiCall: (r: unknown) => logAiCall(r) }));

const { callStructured, AiCallError } = await import("@/lib/ai/structured");

const reply = (text: string, stop_reason = "end_turn") => ({
  model: "claude-opus-5-5",
  stop_reason,
  stop_details: null,
  content: [{ type: "text", text }],
  usage: { input_tokens: 1000, output_tokens: 200, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
});

const schema = z.object({ score: z.number() });
const buildContent = vi.fn((note?: string) => [{ type: "text" as const, text: note ?? "go" }]);
const base = { userId: "u1", purpose: "test", system: "sys", buildContent, schema };

describe("callStructured", () => {
  beforeEach(() => {
    finalMessage.mockReset();
    logAiCall.mockReset();
    buildContent.mockClear();
  });

  it("returns validated output and logs one successful call", async () => {
    finalMessage.mockResolvedValueOnce(reply('{"score": 7}'));
    await expect(callStructured(base)).resolves.toEqual({ score: 7 });
    expect(logAiCall).toHaveBeenCalledTimes(1);
    expect(logAiCall.mock.calls[0][0]).toMatchObject({ success: true, inputTokens: 1000, outputTokens: 200 });
  });

  it("retries once with the validation problems, then succeeds", async () => {
    finalMessage.mockResolvedValueOnce(reply('{"score": "high"}')).mockResolvedValueOnce(reply('{"score": 3}'));
    await expect(callStructured(base)).resolves.toEqual({ score: 3 });
    expect(buildContent).toHaveBeenLastCalledWith(expect.stringMatching(/score/));
    expect(logAiCall.mock.calls.map((c) => c[0].success)).toEqual([false, true]);
  });

  it("applies extra checks and fails gracefully after the second bad answer", async () => {
    finalMessage.mockResolvedValue(reply('{"score": 99}'));
    const check = (v: { score: number }) => (v.score > 10 ? ["score: must be 10 or less"] : []);
    await expect(callStructured({ ...base, check })).rejects.toBeInstanceOf(AiCallError);
    expect(finalMessage).toHaveBeenCalledTimes(2);
    expect(buildContent).toHaveBeenLastCalledWith("- score: must be 10 or less");
  });

  it("does not retry refusals and logs them", async () => {
    finalMessage.mockResolvedValueOnce(reply("", "refusal"));
    await expect(callStructured(base)).rejects.toMatchObject({ userMessage: expect.stringMatching(/declined/) });
    expect(finalMessage).toHaveBeenCalledTimes(1);
    expect(logAiCall.mock.calls[0][0]).toMatchObject({ success: false, error: expect.stringMatching(/refusal/) });
  });

  it("treats invalid JSON as a validation failure", async () => {
    finalMessage.mockResolvedValueOnce(reply("not json")).mockResolvedValueOnce(reply('{"score": 1}'));
    await expect(callStructured(base)).resolves.toEqual({ score: 1 });
  });
});
