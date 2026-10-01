import Anthropic from "@anthropic-ai/sdk";

import { serverEnv } from "@/lib/env";

let client: Anthropic | null = null;

/** Server-only Anthropic client. */
export function getAnthropic(): Anthropic {
  if (!client) {
    const env = serverEnv("ANTHROPIC_API_KEY");
    client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 10 * 60 * 1000 });
  }
  return client;
}

/** Used when ANTHROPIC_MODEL isn't set. */
export const DEFAULT_MODEL = "claude-opus-5-5";

export function getModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
}
