/**
 * Approximate USD prices per million tokens, for the admin cost estimate only.
 * Update when Anthropic's pricing or the configured model changes.
 */
export const MODEL_PRICES: Record<string, { input: number; output: number }> = {
  "claude-fable-5-1": { input: 10, output: 50 },
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-opus-4-7": { input: 5, output: 25 },
  "claude-opus-4-6": { input: 5, output: 25 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

/** Estimated cost in USD, or null when the model's price isn't known. */
export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number | null {
  const price = MODEL_PRICES[model] ?? MODEL_PRICES[model.replace(/-\d{8}$/, "")];
  if (!price) return null;
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}
