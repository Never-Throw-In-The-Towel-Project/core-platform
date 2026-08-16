import Image from "next/image";
import Link from "next/link";

// Real copy from neverthrowinthetowel.com's One-to-One Coaching page,
// ported over verbatim -- see the conversation this shipped from for source
// screenshots. Two sentences had obvious typos in the source ("get your off
// were", "been part of the community is") -- lightly cleaned up for
// grammar/clarity only, no change in meaning or claims.
const CONTACT_MAILTO = "mailto:a.hutton@ntitt.co.uk";

export default function CoachingPage() {
  return (
    <main>
      <section className="bg-brand-background px-6 py-16 text-center text-brand-foreground">
        <h1 className="text-3xl font-extrabold sm:text-4xl">One-to-One Coaching</h1>
        <p className="mt-3 text-lg tracking-wide text-brand-foreground/90">&quot;You make the change&quot;</p>
      </section>

      <section className="bg-background px-6 py-16 text-foreground">
        <div className="mx-auto grid max-w-4xl grid-cols-1 items-center gap-10 md:grid-cols-2">
          <div className="space-y-4 text-sm leading-relaxed text-foreground/80">
            <p>
              Anthony has worked with thousands of men specifically from a 1-to-1 setting — from his work with the
              Never Throw in the Towel Project and his work in the hair industry from 1-to-1 in the barber&apos;s
              chair.
            </p>
            <p>
              The strapline of the Thrive Project is &quot;you make the change.&quot; Anthony is passionate about
              this being the strapline as he believes the change has come from YOU. Some people get lost or just
              need that nudge, that accountability, and that support to help make those changes and improvements.
              It&apos;s NEVER too late to make those changes and improvements, and that&apos;s why Anthony created
              the 1-to-1 coaching platform.
            </p>
            <p>
              There&apos;s no silver bullet or one-size-fits-all, so this will always be tailored to individuals. But
              getting the key fundamentals consistently will always be in play in the 1-to-1 coaching platform.
            </p>
            <p>
              The aim of the 1-2-1 is to get you to a point where you don&apos;t actually need the coaching anymore —
              you&apos;ve learnt the mindset and tools to carry on by yourself.
            </p>
            <p>
              Once you&apos;ve found that being part of the community is something you enjoy and get value from, the
              community group is still there for you to be involved in.
            </p>
          </div>
          <div className="overflow-hidden">
            <Image
              src="/site/founder-speaking.jpg"
              alt="Anthony Hutton"
              width={1200}
              height={1486}
              className="h-full w-full object-cover object-top"
            />
          </div>
        </div>
      </section>

      <section className="bg-brand-background px-6 py-16 text-center text-brand-foreground">
        <h2 className="text-3xl font-bold">Ready to make the change?</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-brand-foreground/70">
          Book your first 1-to-1 session with Anthony today and take the first step towards lasting growth, clarity,
          and confidence.
        </p>
        <a
          href={CONTACT_MAILTO}
          className="mt-6 inline-block bg-background px-6 py-3 font-extrabold uppercase tracking-wide text-foreground"
        >
          Contact Anthony Now
        </a>
      </section>

      <section className="bg-background px-6 py-16 text-foreground">
        <div className="mx-auto grid max-w-4xl grid-cols-1 items-center gap-10 md:grid-cols-2">
          <div className="overflow-hidden">
            <Image
              src="/site/community-group.jpg"
              alt="Never Throw In The Towel community"
              width={1200}
              height={690}
              className="h-full w-full object-cover"
            />
          </div>
          <div>
            <h2 className="text-xl font-bold">How it works</h2>
            <div className="mt-4 space-y-4 text-sm leading-relaxed text-foreground/80">
              <p>
                The first step will be a meet-up in nature, in person with Anthony from 9am – 2pm, to establish
                where we are and what we are wanting out of the coaching — to understand what changes are needed,
                and what the issues are. This will be done as a walk and talk in nature — the reason for this is
                that walking side by side in nature really lends itself to opening up more with conversation.
              </p>
              <p>
                Then there will be some exercising with Anthony, followed by some breathwork and mindfulness
                tactics, preparing us for the cold water immerse. Finally, we&apos;ll all sit down with a hot tea or
                coffee and a bite to eat in the forest with Anthony to finalise the plan and approach going forward
                for the 1-to-1 sessions.
              </p>
              <p>
                Then, month by month, there will be weekly check-ins and 1-hour / 90-minute Zoom calls carrying out
                the plans and goals put in place to make the change!
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-background px-6 pb-16 text-center">
        <Link href="/#testimonials" className="text-sm font-medium text-brand-accent underline">
          Read what people are saying
        </Link>
      </section>
    </main>
  );
}
