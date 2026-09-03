import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// The assistive AI layer (docs/CONTENT_PLATFORM_STRATEGY.md "Pillar 5: an AI
// brain"). It ONLY ever assists the Super Admin -- suggestions the admin
// confirms -- and only ever reads content metadata, never a member's private
// journals (the privacy invariant). The Anthropic client reads ANTHROPIC_API_KEY
// from the environment (set in the hosting platform), never a hardcoded key.

// AI_MODEL + isAiConfigured live in the zero-dependency ./config module so a
// caller that only needs the env check doesn't pull @anthropic-ai/sdk in with
// it. Re-exported here so existing `@/lib/ai/client` importers are unchanged;
// import them from ./config directly wherever the SDK itself isn't needed.
export { AI_MODEL, isAiConfigured } from "./config";

/** A fresh Anthropic client. Throws if no key is configured -- always guard with
 *  isAiConfigured() first. */
export function createAiClient(): Anthropic {
  return new Anthropic();
}
