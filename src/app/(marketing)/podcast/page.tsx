import Image from "next/image";

// Real copy from neverthrowinthetowel.com's Podcast page, ported over
// verbatim -- see the conversation this shipped from for source
// screenshots. No individual episode video IDs were given, so episodes link
// out to the real channel (https://www.youtube.com/@NeverThrowintheTowel)
// rather than embedding guessed video IDs.
const GUESTS = [
  {
    name: "Johnny Nelson",
    blurb: "Former WBO World Cruiserweight Champion, who opened up about life beyond the ring and the battles no one sees.",
  },
  {
    name: "The Stoltman Brothers",
    blurb:
      "Tom and Luke, World's Strongest Man and Europe's Strongest Man, who've shared their powerful stories of mental strength, brotherhood, and what it really means to keep going.",
  },
];

const YOUTUBE_CHANNEL_URL = "https://www.youtube.com/@NeverThrowintheTowel";

export default function PodcastPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold">The Never Throw in the Towel Podcast</h1>
      <p className="mt-2 text-lg font-semibold text-brand-accent">
        Real Stories. Raw Truths. Relentless Resilience.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="space-y-4 text-sm leading-relaxed text-brand-foreground/80">
          <p>The Never Throw in the Towel Podcast is all about hope through honesty.</p>
          <p>
            Each episode, we sit down with guests who&apos;ve faced real challenges — whether that&apos;s mental
            health struggles, adversity, grief, loss, pressure, or rock-bottom moments — and found a way to come
            through the other side.
          </p>
          <p>These are unfiltered conversations with people who&apos;ve refused to give up.</p>
          <p>People who&apos;ve shown true resilience when it mattered most.</p>
          <p>
            The aim is simple: to inspire, to uplift, and to show that even in your darkest moments, you&apos;re not
            alone — and there is a way forward.
          </p>
        </div>
        <div className="overflow-hidden rounded-xl">
          <Image
            src="/site/podcast-recording.jpg"
            alt="Recording the Never Throw In The Towel podcast"
            width={1024}
            height={1536}
            className="h-full w-full object-cover"
          />
        </div>
      </div>

      <div className="mt-16">
        <h2 className="text-xl font-bold">Guests so far</h2>
        <p className="mt-2 text-sm text-brand-foreground/70">
          But it&apos;s not just about big names — it&apos;s about real people with real stories that will hit home
          and light a fire in anyone who listens.
        </p>
        <ul className="mt-6 space-y-4">
          {GUESTS.map((guest) => (
            <li key={guest.name}>
              <p className="font-semibold">{guest.name}</p>
              <p className="text-sm text-brand-foreground/70">{guest.blurb}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-16 flex flex-col items-center gap-4 rounded-xl border border-white/10 p-8 text-center">
        <p className="text-sm leading-relaxed text-brand-foreground/80">
          Whether you&apos;re struggling, searching for purpose, or simply need a reminder of your own strength —
          this podcast is for you. Because no matter what life throws at you… never throw in the towel.
        </p>
        <a
          href={YOUTUBE_CHANNEL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md bg-brand-accent px-6 py-3 font-semibold text-brand-accent-foreground"
        >
          See More On YouTube
        </a>
      </div>
    </main>
  );
}
