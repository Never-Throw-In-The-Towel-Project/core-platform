// The bulk-import action's *state* shape and its initial value, kept in a
// module that imports NO zod. The parsing/validation logic (csvImport.ts) needs
// zod, but the "use client" bulk-import form (ContentImportForm) only needs the
// initial action state and these types -- importing them from here keeps zod and
// the CSV parser out of the browser bundle on every admin page that renders the
// form (/admin/content, /admin/brain, /admin/challenges). csvImport.ts re-exports
// these so existing server-side import sites are unaffected.

/** A per-row problem, anchored to the 1-based line in the uploaded file so the
 *  operator can jump straight to the offending spreadsheet row. */
export type ContentImportError = { line: number; message: string };

export type ContentImportState =
  | { status: "idle" }
  | { status: "error"; message: string; rowErrors?: ContentImportError[] }
  | { status: "success"; message: string; created: number; published: number; drafted: number };

export const initialContentImportState: ContentImportState = { status: "idle" };
