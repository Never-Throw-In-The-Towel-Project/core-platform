import type { ContentStage } from "@/types/database";

/**
 * The Library's "Where you are" stages — a FIXED, closed three-phase journey
 * model (unlike the open, admin-editable topic taxonomy). The stage keys are the
 * values stored in content_item_stages.stage (and the CHECK constraint) AND the
 * `/content?stage=<key>` filter values; the labels/blurbs live here, in code,
 * because the set never changes without a migration.
 *
 * Order matters: STAGE_KEYS is the display order of the filter pills
 * (Start here → In it → Rebuilding), matching the designers' mockup.
 *
 * Plain module (not server-only): imported by the AI tagging on the server and
 * the "Where you are" filter row on the client alike.
 */
export const STAGE_KEYS = ["start_here", "in_it", "rebuilding"] as const;

export const STAGE_META: Record<ContentStage, { label: string; blurb: string }> = {
  start_here: { label: "Start here", blurb: "Where to begin when it's all new." },
  in_it: { label: "In it", blurb: "For when you're in the thick of it." },
  rebuilding: { label: "Rebuilding", blurb: "Finding your feet again." },
};

/** True when a value is one of the three known stages (guards a URL param). */
export function isContentStage(value: unknown): value is ContentStage {
  return typeof value === "string" && (STAGE_KEYS as readonly string[]).includes(value);
}
