import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// The assistive AI layer (docs/CONTENT_PLATFORM_STRATEGY.md "Pillar 5: an AI
// brain"). It ONLY ever assists the Super Admin -- suggestions the admin
// confirms -- and only ever reads content metadata, never a member's private
// journals (the privacy invariant). The Anthropic client reads ANTHROPIC_API_KEY
// from the environment (set in the hosting platform), never a hardcoded key.
//
// The model is overridable via ANTHROPIC_MODEL so cost/latency can be dialed
// without a code change; it defaults to the current Opus.
export const AI_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5";

/**
 * True only when an API key is configured. Callers guard with this so a
 * preview/local deploy that doesn't carry the key degrades to a friendly "AI
 * isn't configured here" message instead of throwing.
 */
export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** A fresh Anthropic client. Throws if no key is configured -- always guard with
 *  isAiConfigured() first. */
export function createAiClient(): Anthropic {
  return new Anthropic();
}
