import Image from "next/image";

/**
 * The story rail on the Today progress band: circular grayscale portraits of
 * Anthony's content -- an unseen story gets a 3px accent ring, a seen one a
 * muted ring. The full-screen story viewer is not yet designed (an open
 * decision in the handoff), so these are intentionally rendered as static
 * figures, NOT buttons/links: they show what's coming without implying a tap
 * target that would currently do nothing.
 *
 * Reuses the photography already committed under public/site (the same shots
 * the handoff renamed into designs/assets); every image is grayscale via the
 * shared .grayscale-photo treatment.
 */
export interface Story {
  key: string;
  label: string;
  image: string;
  seen: boolean;
}

export function StoryRail({ stories }: { stories: Story[] }) {
  return (
    <ul className="flex items-start gap-4" aria-label="Anthony's latest">
      {stories.map((story) => (
        <li key={story.key} className="flex w-14 flex-col items-center gap-1.5 text-center">
          <span
            className="block rounded-full p-[3px]"
            style={{
              background: story.seen ? "var(--muted-on-ink)" : "var(--brand-accent-vivid)",
            }}
          >
            <span className="block overflow-hidden rounded-full bg-brand-background" style={{ padding: 2 }}>
              <span className="relative block h-12 w-12 overflow-hidden rounded-full">
                <Image
                  src={story.image}
                  alt=""
                  fill
                  sizes="48px"
                  className="grayscale-photo object-cover"
                />
              </span>
            </span>
          </span>
          <span className="text-[10px] font-semibold tracking-wide text-brand-foreground/80">
            {story.label}
          </span>
        </li>
      ))}
    </ul>
  );
}
