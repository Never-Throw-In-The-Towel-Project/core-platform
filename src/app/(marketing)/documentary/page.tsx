import Image from "next/image";
import { YouTubeEmbed } from "@/components/YouTubeEmbed";

// Real copy from neverthrowinthetowel.com's Documentary page, ported over
// verbatim -- see the conversation this shipped from for source screenshots.
const DOCUMENTARY_LEADS_TO = [
  {
    title: "Keynote Speaking",
    body: "Anthony delivers powerful talks tailored to organisations, schools, teams, and audiences that need honest conversations about mental health and resilience.",
  },
  {
    title: "Men's Mental Health Retreats",
    body: "Structured experiences designed to help people reset, connect, and share in supportive environments.",
  },
  {
    title: "Community Engagement Initiatives",
    body: "From pop-up barbershops to outdoor meet-ups, these spaces encourage connection and reduce isolation.",
  },
  {
    title: "Podcast Conversations",
    body: "The Never Throw in the Towel podcast features guests who share their own challenges and victories, expanding the conversation around mental health and resilience.",
  },
];

// This trailer's YouTube ID is the one shared directly in the conversation
// this shipped from (https://www.youtube.com/watch?v=WW8_z7rW4-w) -- a real
// URL already public on Anthony's own channel, not invented.
const DOCUMENTARY_TRAILER_ID = "WW8_z7rW4-w";

export default function DocumentaryPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold">Documentary</h1>

      <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-xl font-bold">After the Cameras Stopped</h2>
          <p className="text-sm font-semibold text-brand-accent">The Documentary That Changed the Conversation</p>
          <p className="text-sm leading-relaxed text-foreground/80">
            Few people understand the rise and fall that can come with fame quite like Anthony Hutton. In 2005, at
            just 23 years old, Anthony won Big Brother, catapulting him into the public eye almost overnight. Within
            months he secured a quarter of a million pounds in magazine deals and extended income from TV
            appearances. But the spotlight faded, the work dried up, and the money disappeared. Anthony&apos;s
            journey from fame to recovery, and eventually to a real headspace, is the heart of this powerful
            documentary.
          </p>
          <p className="text-sm leading-relaxed text-foreground/80">
            This film explores what happened after Anthony&apos;s time in the limelight. It traces the extreme highs
            of addiction, the lows of depression, and loss of identity, and ultimately his recovery to rebuild life
            from the ground up. Alongside Anthony&apos;s lived experience, the documentary features insights from
            other reality TV personalities who reflect on the lasting impact of sudden public exposure.
          </p>
          <p className="text-sm leading-relaxed text-foreground/80">
            More than a personal story, this film lays the foundation for Anthony&apos;s life-changing work around
            men&apos;s mental health, and by the legacy of his grandmother, Anthony founded Never Throw In The Towel
            Project
            with the simple message to &quot;keep on living&quot; — a message that now reaches far beyond his own
            life.
          </p>
        </div>
        <div className="space-y-3">
          <YouTubeEmbed youtubeId={DOCUMENTARY_TRAILER_ID} title="Reality TV Broke Us -- Never Throw In The Towel" />
          <p className="text-center text-xs text-foreground/60">Available to rent or buy on Amazon</p>
        </div>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="overflow-hidden">
          <Image
            src="/site/founder-speaking.jpg"
            alt="Anthony Hutton speaking on Never Throw In The Towel"
            width={1200}
            height={1486}
            className="h-full w-full object-cover object-top"
          />
        </div>
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Never Throw In The Towel</h2>
          <p className="text-sm font-semibold text-brand-accent">Turning Hardship Into Impact</p>
          <p className="text-sm leading-relaxed text-foreground/80">
            &quot;Never Throw in The Towel&quot; is a movement built on resilience, lived experience, and the power
            of community. From barber chairs to cold water therapy, the project helps people keep going no matter
            what life throws their way.
          </p>
          <p className="text-sm leading-relaxed text-foreground/80">
            After his time in the public eye, Anthony trained as a barber and discovered that the barber chair could
            be a powerful space for men to open up naturally, offering a comfortable and natural environment to talk
            without pressure.
          </p>
          <p className="text-sm leading-relaxed text-foreground/80">
            Today Anthony is a mental health advocate and keynote speaker. His work spans retreats that tackle
            stigma, open honest conversation, all with the central theme that talking is a strength, not a weakness.
          </p>
        </div>
      </div>

      <div className="mt-16">
        <h2 className="text-xl font-bold">What the Documentary Leads To</h2>
        <p className="mt-2 text-sm leading-relaxed text-foreground/80">
          The documentary doesn&apos;t just recount a personal journey. It provides context for why Anthony&apos;s
          message matters now, and how it has translated into real-world impact through:
        </p>
        <ul className="mt-6 space-y-4">
          {DOCUMENTARY_LEADS_TO.map((item) => (
            <li key={item.title}>
              <p className="font-semibold">{item.title}</p>
              <p className="text-sm text-foreground/70">{item.body}</p>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-sm leading-relaxed text-foreground/80">
          This film isn&apos;t just about celebrity or fame. It&apos;s about identity, purpose, community, and the
          courage it takes to keep going when life feels overwhelming. It&apos;s an invitation to watch, reflect, and
          engage with a message that&apos;s helping people across the UK and beyond.
        </p>
      </div>
    </main>
  );
}
