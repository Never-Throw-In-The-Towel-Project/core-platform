import Link from "next/link";
import { YouTubeEmbed } from "@/components/YouTubeEmbed";
import { WELCOME_VIDEO_ID, WELCOME_VIDEO_TITLE } from "@/lib/welcome/video";

export const metadata = { title: "Why NTITT" };

/**
 * The revisit home for the welcome "why" video (linked from Settings): the same
 * video a new member sees once as a modal on their first Today screen, available
 * to watch again any time. Reuses the shared YouTubeEmbed (lazy thumbnail → player)
 * and the CSP already allowlists YouTube (E15).
 */
export default function WelcomePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/home" className="text-sm text-muted hover:text-foreground">
        ← Today
      </Link>

      <header className="mt-6">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-brand-accent-deep">Welcome</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">{WELCOME_VIDEO_TITLE}</h1>
        <p className="mt-2 text-muted">
          The reason this platform exists — and why it&rsquo;s worth showing up for. A word from Anthony.
        </p>
      </header>

      <div className="mt-6">
        <YouTubeEmbed youtubeId={WELCOME_VIDEO_ID} title={WELCOME_VIDEO_TITLE} />
      </div>
    </main>
  );
}
