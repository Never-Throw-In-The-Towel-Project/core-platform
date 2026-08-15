import Image from "next/image";
import Link from "next/link";

const OFFERINGS = [
  {
    title: "Pop-Up Barbershop",
    blurb: "A keynote followed by free haircuts on-site -- a stigma-free way for men to open up.",
    image: "/site/community-brotherhood.jpg",
    href: "/what-i-do/pop-up-barbershop",
  },
  {
    title: "One-to-One Coaching",
    blurb: "You make the change -- structured, personal coaching starting with a day in nature.",
    image: "/site/founder-speaking.jpg",
    href: "/what-i-do/coaching",
  },
];

export default function WhatIDoPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold">What I Do</h1>
      <p className="mt-2 text-sm text-foreground/70">
        Different ways Anthony works with organisations and individuals to open up honest conversations about
        men&apos;s mental health.
      </p>
      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
        {OFFERINGS.map((offering) => (
          <Link
            key={offering.title}
            href={offering.href}
            className="flex flex-col overflow-hidden border-2 border-foreground text-left"
          >
            <div className="aspect-video w-full overflow-hidden">
              <Image
                src={offering.image}
                alt={offering.title}
                width={800}
                height={450}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="flex flex-1 flex-col gap-2 p-5">
              <p className="font-semibold">{offering.title}</p>
              <p className="text-sm text-foreground/70">{offering.blurb}</p>
              <span className="mt-auto text-sm font-medium text-brand-accent underline">Learn More</span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
