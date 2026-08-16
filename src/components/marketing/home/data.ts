// Content for the marketing home page (default + tailored partner variants).
//
// Everything here is either a value-prop framing of a REAL platform feature or
// verbatim copy already published on the site -- no invented stats, outcomes,
// pricing, or testimonials. Member-benefit blurbs describe the actual screens
// (Today, Community/Feed, Wins Board, Library, Challenges, Journey); client
// names and testimonials are reused from the existing pages.

export const CONTACT_MAILTO = "mailto:a.hutton@ntitt.co.uk";

// Real partner/client logos supplied by Anthony (public/partners/*.png). Same
// list the old home used; now shown only in the employer "For workplaces" band
// (default site) -- never on the tailored partner subdomains.
export const PARTNER_LOGOS = [
  { src: "/partners/aldi.png", name: "ALDI Australia" },
  { src: "/partners/amazon.png", name: "Amazon" },
  { src: "/partners/barbour.png", name: "Barbour" },
  { src: "/partners/kp-snacks.png", name: "KP Snacks" },
  { src: "/partners/loreal.png", name: "L'Oréal" },
  { src: "/partners/lighthouse-charity.png", name: "Lighthouse Charity" },
  { src: "/partners/the-hill-group.png", name: "The Hill Group" },
  { src: "/partners/vanlove.png", name: "Vanlove" },
] as const;

// Real organisations named in the existing pop-up-barbershop copy but with no
// logo file -- listed as text so we don't invent a logo image.
export const TEXT_ONLY_CLIENTS = ["Newcastle United", "Bradford City", "Serco", "Muckle"] as const;

export type Benefit = { name: string; blurb: string };

// The login-gated member features, each a one-line description of the real
// screen (labels/routes: /home "Today", /community "Community/Feed",
// /community/wins "Wins Board", /content "Library", /challenges + /step-challenge
// "Challenges", /journey "Journey").
export const MEMBER_BENEFITS: Benefit[] = [
  {
    name: "Today",
    blurb:
      "Win the morning, close the night. A short morning intention and an end-of-day reflection that build the habit of keeping going.",
  },
  {
    name: "Community",
    blurb: "Everyone on NTITT — post a message, a win or a reflection, and back others doing the same.",
  },
  {
    name: "Wins Board",
    blurb:
      "Celebrate the wins, big and small. Nothing from your private check-ins appears here — you choose what to share.",
  },
  {
    name: "Library",
    blurb:
      "Search a topic — grief, divorce, sleep, redundancy — and go straight to the talk or tool you need right now.",
  },
  {
    name: "Challenges",
    blurb:
      "Guided, day-by-day programmes and company step challenges. Every day you finish counts; nothing is ever marked late.",
  },
  {
    name: "Journey",
    blurb: "Your private progress — streaks, steps, badges and 30/90-day reviews. Only you can ever see it.",
  },
];

export type WorkplaceService = { title: string; blurb: string };

// The B2B offering, framed from the real /what-i-do pages.
export const WORKPLACE_SERVICES: WorkplaceService[] = [
  {
    title: "Pop-Up Barbershop",
    blurb:
      "A keynote followed by free haircuts on-site — a stigma-free way for men to open up. Proven in male-dominated industries like construction, offshore and logistics.",
  },
  {
    title: "Keynote Speaking",
    blurb:
      "Anthony shares his lived experience, fully tailored to your timescale and audience — with or without the barbershop.",
  },
  {
    title: "Staff Wellbeing Platform",
    blurb:
      "Your own company-skinned space: the daily tools, a private community, company step challenges and an HR dashboard.",
  },
];

export type Testimonial = { quote: string; name: string };

// Verbatim from the previous home page (real testimonials Anthony supplied).
export const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "As a parent and mental health advocate, nothing could have prepared me for the heart-wrenching moment when I learned my child was experiencing thoughts of self-harm. Being neurodiverse, my quiet, sensitive child…",
    name: "A Mother's Testimonial",
  },
  {
    quote:
      "I engaged Anthony Hutton to deliver a motivational speech to an English Football League club. It was remarkable. To fully engage a squad of professional athletes, fresh off the training ground…",
    name: "UK Independent Medical and Optus Law",
  },
  {
    quote:
      "The Never Throw in the Towel Project focuses on an incredibly important topic that we all need to think more about, and Anthony is a brilliant advocate for improving men's mental health. The talk…",
    name: "Newcastle United — Conference",
  },
];

// Condensed from the existing About copy -- the same facts (Big Brother 2005,
// the dark period + recovery, the barber chair, the "keep on living" strapline
// from his grandmother's eulogy), trimmed to a supporting two-paragraph story.
export const STORY_PARAGRAPHS = [
  "In 2005 Anthony won Big Brother at 23 — and learned first-hand how fast the highs of sudden fame turn into a very dark place. Out of that came resilience, recovery, and a refusal to give up.",
  "He trained as a barber and found the chair was where men actually opened up. Never Throw In The Towel grew from there — carrying the words he used at his grandmother's eulogy: keep on living.",
];
