import "server-only";

// The zero-dependency half of the AI layer: the model id and the "is a key
// configured?" check. Split out of client.ts (which imports @anthropic-ai/sdk)
// so a server component that only needs the env check -- /admin/brain and
// /admin/calendar gate UI on it -- doesn't drag the whole Anthropic SDK into its
// serverless function's init graph just to read one env var. The SDK now loads
// only where an AI call is actually made (createAiClient in client.ts).

// Overridable via ANTHROPIC_MODEL so cost/latency can be dialed without a code
// change; defaults to the current Opus.
export const AI_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5";

/**
 * True only when an API key is configured. Callers guard with this so a
 * preview/local deploy that doesn't carry the key degrades to a friendly "AI
 * isn't configured here" message instead of throwing.
 */
export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
