// The challenge bulk-import action's *state* shape and its initial value, kept
// in a module that imports NO zod. The parsing/validation logic
// (challengeImport.ts → csvImport.ts) needs zod, but the "use client"
// bulk-import form (ChallengeDayImportForm, rendered on /admin/challenges/[id])
// only needs the initial action state and these types -- importing them from
// here keeps zod and the CSV parser out of the browser bundle on that page.
// This is the twin of content/importState.ts (which already does the same for
// the content importer); challengeImport.ts re-exports these so existing
// server-side import sites are unaffected.

/** A per-row problem, anchored to the 1-based line in the uploaded file so the
 *  operator can jump straight to the offending spreadsheet row. */
export type ChallengeImportError = { line: number; message: string };

export type ChallengeImportState =
  | { status: "idle" }
  | { status: "error"; message: string; rowErrors?: ChallengeImportError[] }
  | { status: "success"; message: string; created: number; withContent: number; promptOnly: number };

export const initialChallengeImportState: ChallengeImportState = { status: "idle" };
