import Image from "next/image";
import Link from "next/link";

/**
 * The focal hero card on Today. A 2px ink border, a red header strip (using the
 * AA-safe --brand-accent so its small uppercase label clears 4.5:1 on the
 * red), the big day title, a one-line description, the ink CTA that inverts to
 * red on hover, an optional "N of 6 answered" progress line, and -- on desktop
 * only -- a grayscale photograph.
 *
 * Reused for the morning/night/weekend phases too (different header, CTA and
 * image, no answered-count), so the whole Today screen speaks one visual
 * language regardless of the time of day.
 */
export function CheckinCard({
  headerLabel,
  title,
  description,
  ctaLabel,
  ctaHref,
  answered,
  total,
  image,
}: {
  headerLabel: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  answered?: number;
  total?: number;
  image?: string;
}) {
  const showProgress = typeof answered === "number" && typeof total === "number";

  return (
    <article className="border-2 border-foreground bg-background">
      <div className="bg-brand-accent px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-accent-foreground">
        {headerLabel}
      </div>
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-stretch">
        <div className="flex flex-1 flex-col">
          <h1 className="text-[38px] font-extrabold leading-[0.95] tracking-tight sm:text-5xl">
            {title}
          </h1>
          {description && <p className="mt-3 max-w-md text-foreground/80">{description}</p>}
          <div className="mt-auto flex flex-wrap items-center gap-4 pt-6">
            <Link
              href={ctaHref}
              className="bg-brand-background px-6 py-3 text-sm font-extrabold uppercase tracking-wide text-brand-foreground transition-colors hover:bg-brand-accent hover:text-brand-accent-foreground"
            >
              {ctaLabel}
            </Link>
            {showProgress && (
              <span className="text-sm text-muted">
                {answered} of {total} answered
              </span>
            )}
          </div>
        </div>
        {image && (
          <div className="relative hidden w-56 shrink-0 self-stretch sm:block">
            <Image
              src={image}
              alt=""
              fill
              sizes="224px"
              className="grayscale-photo object-cover"
            />
          </div>
        )}
      </div>
    </article>
  );
}
