import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

import { getAnthropic, getModel } from "@/lib/ai/client";
import { capabilitiesFor } from "@/lib/ai/models";
import { logAiCall } from "@/lib/ai/usage";

/** A model call that didn't produce usable output. `userMessage` is safe to show. */
export class AiCallError extends Error {
  constructor(
    message: string,
    readonly userMessage: string,
  ) {
    super(message);
    this.name = "AiCallError";
  }
}

type Content = Anthropic.Beta.BetaContentBlockParam[];

export type StructuredCallOptions<T> = {
  userId: string;
  purpose: string;
  system: string | Anthropic.Beta.BetaTextBlockParam[];
  /** Builds the user content; receives the previous attempt's problems on the retry. */
  buildContent: (retryNote?: string) => Content;
  schema: z.ZodType<T>;
  /** Extra checks the schema can't express. Return problems; empty means valid. */
  check?: (value: T) => string[];
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  maxTokens?: number;
  /** Receives the raw JSON text as it streams (for showing output live). */
  onTextDelta?: (delta: string) => void;
  /** Called before a retry, so live output from the failed attempt can be discarded. */
  onRetry?: () => void;
};

function describeIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 20)
    .map((i) => `- ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
}

/**
 * Calls the model for JSON matching `schema` (spec 6: every structured output
 * is validated). On invalid output it retries once, telling the model what was
 * wrong, then fails with AiCallError. Every attempt is logged to ai_calls.
 */
export async function callStructured<T>(options: StructuredCallOptions<T>): Promise<T> {
  const model = getModel();
  const caps = capabilitiesFor(model);
  let retryNote: string | undefined;

  for (let attempt = 1; attempt <= 2; attempt++) {
    if (attempt > 1) options.onRetry?.();
    const started = Date.now();
    let message: Anthropic.Beta.BetaMessage;
    try {
      const stream = getAnthropic().beta.messages.stream({
        model,
        max_tokens: options.maxTokens ?? 32000,
        system: options.system,
        messages: [{ role: "user", content: options.buildContent(retryNote) }],
        ...(caps.adaptiveThinking ? { thinking: { type: "adaptive" as const } } : {}),
        output_config: {
          format: betaZodOutputFormat(options.schema),
          ...(caps.effort ? { effort: options.effort ?? "high" } : {}),
        },
        // Re-run on another model if this one declines (refusal fallback).
        ...(caps.refusalFallback
          ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
          : {}),
      });
      if (options.onTextDelta) stream.on("text", (delta) => options.onTextDelta?.(delta));
      message = await stream.finalMessage();
    } catch (error) {
      await logAiCall({
        userId: options.userId,
        purpose: options.purpose,
        model,
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: Date.now() - started,
        success: false,
        error: error instanceof Error ? `${error.name}: ${error.message}` : "unknown error",
      });
      if (error instanceof Anthropic.RateLimitError) {
        throw new AiCallError("rate limited", "Our AI service is busy right now. Please try again in a few minutes.");
      }
      if (error instanceof Anthropic.BadRequestError) {
        throw new AiCallError(`bad request: ${error.message}`, "The AI service couldn't process these documents.");
      }
      if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
        throw new AiCallError(`auth: ${error.message}`, "The AI service isn't configured correctly.");
      }
      if (error instanceof Anthropic.APIError) {
        throw new AiCallError(`api: ${error.message}`, "The AI service had a problem. Please try again.");
      }
      throw error;
    }

    const usage = {
      inputTokens:
        message.usage.input_tokens +
        (message.usage.cache_creation_input_tokens ?? 0) +
        (message.usage.cache_read_input_tokens ?? 0),
      outputTokens: message.usage.output_tokens,
    };
    const log = (success: boolean, error?: string) =>
      logAiCall({
        userId: options.userId,
        purpose: options.purpose,
        model: message.model,
        ...usage,
        latencyMs: Date.now() - started,
        success,
        error,
      });

    if (message.stop_reason === "refusal") {
      await log(false, `refusal: ${message.stop_details?.category ?? "unknown"}`);
      throw new AiCallError("refusal", "The AI declined to analyse these documents.");
    }
    if (message.stop_reason === "max_tokens") {
      await log(false, "max_tokens");
      throw new AiCallError("max_tokens", "The documents produced more output than we can handle. Try fewer or shorter documents.");
    }

    const text = message.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    let problems: string;
    try {
      const parsed = options.schema.safeParse(JSON.parse(text));
      if (parsed.success) {
        const extra = options.check?.(parsed.data) ?? [];
        if (extra.length === 0) {
          await log(true);
          return parsed.data;
        }
        problems = extra.slice(0, 20).map((p) => `- ${p}`).join("\n");
      } else {
        problems = describeIssues(parsed.error);
      }
    } catch {
      problems = "- The answer was not valid JSON.";
    }

    await log(false, `validation (attempt ${attempt}): ${problems}`);
    retryNote = problems;
  }

  throw new AiCallError("validation failed twice", "The AI's answer didn't pass our checks. Please try again.");
}
