/**
 * What request options each model accepts. The model itself comes from the
 * ANTHROPIC_MODEL environment variable; unknown models get the most
 * conservative settings.
 */
export type ModelCapabilities = {
  /** Accepts output_config.effort. */
  effort: boolean;
  /** Accepts thinking: { type: "adaptive" }. */
  adaptiveThinking: boolean;
  /** Accepts the server-side refusal fallback (fallbacks: "default"). */
  refusalFallback: boolean;
};

const CURRENT_GEN: ModelCapabilities = { effort: true, adaptiveThinking: true, refusalFallback: true };
const ADAPTIVE_ONLY: ModelCapabilities = { effort: true, adaptiveThinking: true, refusalFallback: false };
const CONSERVATIVE: ModelCapabilities = { effort: false, adaptiveThinking: false, refusalFallback: false };

const KNOWN: Record<string, ModelCapabilities> = {
  "claude-fable-5-1": CURRENT_GEN,
  "claude-opus-5-5": CURRENT_GEN,
  "claude-opus-5": CURRENT_GEN,
  "claude-sonnet-5-5": CURRENT_GEN,
  "claude-sonnet-5": ADAPTIVE_ONLY,
  "claude-opus-4-8": ADAPTIVE_ONLY,
  "claude-opus-4-7": ADAPTIVE_ONLY,
  "claude-opus-4-6": ADAPTIVE_ONLY,
  "claude-sonnet-4-6": ADAPTIVE_ONLY,
};

export function capabilitiesFor(model: string): ModelCapabilities {
  return KNOWN[model] ?? CONSERVATIVE;
}
