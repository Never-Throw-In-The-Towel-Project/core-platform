import Link from "next/link";
import { DisplayNameForm } from "./DisplayNameForm";

/**
 * The "your account" block shared by all three settings pages (member, HR,
 * super admin): the editable display name, the read-only sign-in email, and --
 * for the role pages, which don't carry the reminder controls themselves -- a
 * pointer to member settings for personal reminders. One component so the copy
 * and styling can't drift between the three surfaces.
 */
export function AccountSettingsCard({
  displayName,
  email,
  heading = "Your account",
  showReminderLink = false,
}: {
  displayName: string;
  email?: string | null;
  heading?: string;
  /** Show the "manage your reminders in member settings" pointer. On for the HR
   *  and super admin pages; off for the member page, which has those controls. */
  showReminderLink?: boolean;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">{heading}</h2>
      <DisplayNameForm currentName={displayName} />
      {email && (
        <div className="border border-rule-hairline p-4">
          <p className="text-sm font-medium">Email</p>
          <p className="mt-1 text-sm text-muted">{email}</p>
          <p className="mt-2 text-xs text-muted">Your sign-in email. To change it, contact NTITT support.</p>
        </div>
      )}
      {showReminderLink && (
        <p className="text-xs text-muted">
          Manage your personal Today-screen reminders and timezone in your{" "}
          <Link href="/settings" className="font-semibold underline underline-offset-2 hover:text-foreground">
            member settings
          </Link>
          .
        </p>
      )}
    </section>
  );
}
