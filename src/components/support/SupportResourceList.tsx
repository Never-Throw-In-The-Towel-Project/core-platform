"use client";

import Link from "next/link";
import {
  supportActionHref,
  type SupportAction,
  type SupportResource,
} from "@/lib/support/resources";

/**
 * Renders one tier of external-support resources (see lib/support/resources.ts)
 * as a list of cards, each with its contact actions. Token-based styling only
 * (bg-brand-accent / border-rule-border / text-muted) so it reads correctly on
 * both the "Check in with me" paper modal and the pre-auth screens without a
 * variant prop.
 *
 * `onNavigate` is called just before an in-app ("internal") link navigates, so
 * the caller can close the modal it lives in — otherwise the persistent (app)
 * shell would keep the dialog open over the destination page. External call /
 * text / link actions don't fire it (they open a dialler or a new tab).
 */
export function SupportResourceList({
  resources,
  onNavigate,
}: {
  resources: readonly SupportResource[];
  onNavigate?: () => void;
}) {
  return (
    <ul className="space-y-3">
      {resources.map((resource) => (
        <li key={resource.id} className="border border-rule-border p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="font-extrabold tracking-tight">{resource.name}</p>
            {resource.availability && (
              <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted">
                {resource.availability}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">{resource.blurb}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {resource.actions.map((action, i) => (
              <SupportActionButton
                key={`${resource.id}-${i}`}
                action={action}
                primary={i === 0}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

const PRIMARY =
  "inline-flex min-h-[44px] items-center justify-center gap-2 bg-brand-accent px-4 py-2 text-sm font-extrabold uppercase tracking-wide text-brand-accent-foreground hover:brightness-110";
const SECONDARY =
  "inline-flex min-h-[44px] items-center justify-center gap-2 border border-rule-border px-4 py-2 text-sm font-semibold hover:border-foreground";

function SupportActionButton({
  action,
  primary,
  onNavigate,
}: {
  action: SupportAction;
  primary: boolean;
  onNavigate?: () => void;
}) {
  const className = primary ? PRIMARY : SECONDARY;
  const href = supportActionHref(action);

  // In-app route: Next Link + close the host modal on click so the dialog
  // doesn't linger over the destination in the persistent app shell.
  if (action.type === "internal") {
    return (
      <Link href={href} onClick={onNavigate} className={className}>
        {action.label}
      </Link>
    );
  }

  // External website: new tab, noopener. Phone/text (tel:/sms:) open the
  // dialler/messages in place, so no target.
  const external = action.type === "link";
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={className}
    >
      {action.label}
    </a>
  );
}
