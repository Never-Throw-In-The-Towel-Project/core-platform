// Pure channel-visibility rule for the distribution calendar's per-channel view.
// Mirrors the content_items read RLS (the spine migration): an item with NO
// channel placements is NTITT-wide (global) and shows on every channel; an item
// with placements shows only on the companies it's targeted to.

/**
 * Whether an item is visible under a calendar channel filter.
 * `placedCompanyIds` = the companies the item is targeted to
 * (content_channel_placements); empty/undefined = NTITT-wide.
 *   - "all"    → every item.
 *   - "global" → only NTITT-wide items (no placements).
 *   - <uuid>   → NTITT-wide items PLUS items targeted to that company — what
 *                that company's members actually see.
 */
export function isVisibleOnChannel(placedCompanyIds: Set<string> | undefined, channel: string): boolean {
  if (channel === "all") return true;
  const isGlobal = !placedCompanyIds || placedCompanyIds.size === 0;
  if (channel === "global") return isGlobal;
  return isGlobal || placedCompanyIds.has(channel);
}
