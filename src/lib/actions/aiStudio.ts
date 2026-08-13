"use server";

import { z } from "zod";
import { requireNtittAdmin } from "@/lib/auth/dal";
import { isAiConfigured } from "@/lib/ai/client";
import { suggestContentTags, type TagSuggestion } from "@/lib/ai/contentTags";

const InputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().max(1000).optional(),
});

export type SuggestTagsResult =
  | { status: "ok"; suggestion: TagSuggestion }
  | { status: "error"; message: string };

/**
 * Assistive tag suggestions for the Content Studio. Called from the Studio form
 * (a client component) via startTransition. Returns a suggestion for the admin
 * to confirm or edit -- it never writes anything and never publishes.
 *
 * requireNtittAdmin() is the real gate (redirects a non-admin), re-checked
 * server-side rather than trusting the caller -- the same posture as every other
 * Studio path. isAiConfigured() lets a deploy without the key degrade to a
 * friendly message instead of a crash.
 */
export async function suggestTagsAction(input: { title: string; summary?: string }): Promise<SuggestTagsResult> {
  await requireNtittAdmin();

  if (!isAiConfigured()) {
    return { status: "error", message: "AI suggestions aren’t configured in this environment yet." };
  }

  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "Add a title first, then ask for suggestions." };
  }

  try {
    const suggestion = await suggestContentTags(parsed.data.title, parsed.data.summary ?? "");
    return { status: "ok", suggestion };
  } catch {
    return { status: "error", message: "Couldn’t reach the AI just now — tag it manually and try again later." };
  }
}
