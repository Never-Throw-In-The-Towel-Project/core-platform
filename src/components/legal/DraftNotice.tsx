/**
 * A prominent, unmissable banner marking a legal page as a non-final draft.
 * These pages are a STARTING POINT for NTITT's solicitor to review and replace
 * before launch -- they are not legal advice and must not be relied on as final.
 * Kept as one component so the wording is consistent across Privacy and Terms.
 */
export function DraftNotice() {
  return (
    <div
      role="note"
      className="mb-8 border-l-4 border-brand-accent bg-brand-accent/10 px-4 py-3 text-sm"
    >
      <p className="font-bold uppercase tracking-wide text-brand-accent-deep">Draft — pending legal review</p>
      <p className="mt-1 text-foreground/80">
        This is starter wording for NTITT&apos;s solicitor to review, adapt and approve before launch. It is
        not legal advice and should not be treated as final.
      </p>
    </div>
  );
}
