/**
 * The company slot on Today: an ink card with a left bar in the company's skin
 * colour and a message from Anthony to that workforce. This is the ONLY place a
 * company's identity colours the member experience beyond the top skin strip
 * and header chip -- the brief's rule that a skin touches "band and chip only,
 * never the accent". Renders nothing when the company has no message set, so we
 * never invent copy on Anthony's behalf.
 */
export function CompanySlot({
  companyName,
  message,
  skinColor,
}: {
  companyName: string;
  message: string | null;
  skinColor: string;
}) {
  if (!message) return null;

  return (
    <div className="flex bg-brand-background text-brand-foreground">
      <div className="w-1 shrink-0" style={{ background: skinColor }} aria-hidden />
      <div className="px-5 py-4">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-on-ink">
          From {companyName}
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-brand-foreground/90">{message}</p>
      </div>
    </div>
  );
}
