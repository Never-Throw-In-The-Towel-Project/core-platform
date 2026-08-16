import Image from "next/image";
import Link from "next/link";

// Real copy from neverthrowinthetowel.com/pop-up-barbershop-in-the-workplace/,
// ported over verbatim -- see the conversation this shipped from for source
// screenshots. Client logos: only reusing image files we actually have
// (L'Oréal, KP Snacks already in public/partners/); the other named
// organisations (Newcastle United, Bradford City, Serco, Muckle) are real
// but we don't have their logo files, so they're listed as text instead of
// guessing at a logo image.
const TEXT_ONLY_CLIENTS = ["Newcastle United", "Bradford City", "Serco", "Muckle"];

const CONTACT_MAILTO = "mailto:a.hutton@ntitt.co.uk";

export default function PopUpBarbershopPage() {
  return (
    <main>
      <section className="bg-brand-background px-6 py-16 text-center text-brand-foreground">
        <h1 className="text-3xl font-extrabold sm:text-4xl">Pop-Up Barbershop in the Workplace</h1>
      </section>

      <section className="bg-background px-6 py-16 text-foreground">
        <div className="mx-auto grid max-w-4xl grid-cols-1 items-center gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold">Storytelling &amp; Safe Space</h2>
            <div className="mt-6 space-y-4 text-sm leading-relaxed text-foreground/80">
              <p>
                Storytelling through lived experience — followed by creating a safe space to talk — might just be
                the most effective way to nudge important conversations.
              </p>
              <p>
                Anthony&apos;s keynote presentation, where he shares his personal journey, is followed by a pop-up
                barbershop offering free haircuts to staff. This simple concept has proven to be a game changer for
                companies looking to shift culture — especially within male-dominated industries like construction,
                offshore, and logistics.
              </p>
              <p>
                The haircut afterwards becomes a subtle, stigma-free way to connect. It&apos;s &quot;just a
                haircut&quot; — but in that moment, powerful conversations can happen. No pressure. No formal
                setting. Just trust and space.
              </p>
              <p>
                This approach has built an amazing reputation and led to Anthony working with major organisations
                like Amazon, Aldi, prisons, and professional football clubs.
              </p>
            </div>
          </div>
          <div className="overflow-hidden">
            <Image
              src="/site/community-brotherhood.jpg"
              alt="Pop-up barbershop in the workplace"
              width={1200}
              height={900}
              className="h-full w-full object-cover"
            />
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-4xl">
          <h2 className="text-2xl font-bold">🧠 Why It Works</h2>
          <div className="mt-4 space-y-4 text-sm leading-relaxed text-foreground/80">
            <p>
              Anthony believes mental health support for men has to be tailored — because posters on walls and
              asking men to talk simply isn&apos;t enough.
            </p>
            <p>
              Men need familiar, safe environments to open up. That&apos;s why the barbershop concept is so
              effective — and why Anthony offers this experience immediately following his keynote sessions.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-brand-background px-6 py-16 text-center text-brand-foreground">
        <h2 className="text-3xl font-bold">Bring real change to your workplace</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-brand-foreground/70">
          Book Anthony&apos;s keynote and pop-up barbershop experience to spark conversations that truly matter.
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
              src="/site/founder-speaking.jpg"
              alt="Anthony Hutton delivering a keynote"
              width={1200}
              height={1486}
              className="h-full w-full object-cover object-top"
            />
          </div>
          <div>
            <h2 className="text-xl font-bold">🎤 Keynotes for Events</h2>
            <p className="mt-4 text-sm leading-relaxed text-foreground/80">
              If the barbershop setup isn&apos;t a fit for your workplace or event, Anthony also delivers standalone
              keynotes, fully tailored to suit your timescale and audience.
            </p>
            <h2 className="mt-8 text-xl font-bold">✅ Check the Impact</h2>
            <p className="mt-4 text-sm leading-relaxed text-foreground/80">
              Don&apos;t just take our word for it — check out the testimonials from the organisations and events
              where Anthony has spoken.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-foreground/80">
              He&apos;s not just talking about culture change — he&apos;s helping make it happen.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Image
                src="/partners/loreal.png"
                alt="L'Oréal"
                width={90}
                height={36}
                style={{ width: "auto", height: "auto", maxWidth: "90px", maxHeight: "36px" }}
              />
              <Image
                src="/partners/kp-snacks.png"
                alt="KP Snacks"
                width={90}
                height={36}
                style={{ width: "auto", height: "auto", maxWidth: "90px", maxHeight: "36px" }}
              />
              {TEXT_ONLY_CLIENTS.map((name) => (
                <span key={name} className="text-sm font-semibold text-muted">
                  {name}
                </span>
              ))}
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
