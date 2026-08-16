/**
 * The footer's marks.
 *
 * Drawn to the site's own vocabulary rather than dropped in as brand assets: a
 * 24-unit square, one stroke weight, no fills — the same rules the partners'
 * emblems and the archetypes' sigils are drawn to. Official logos would be six
 * filled glyphs at six different optical weights sitting in a row of hairlines,
 * and they would read as stickers on the page.
 *
 * Recognisable at the size they are actually used, which is about 20px.
 */

/** The envelope on the newsletter field. */
export function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2.8" y="5.4" width="18.4" height="13.2" rx="2.2" />
      <path d="M3.4 7 12 13.2 20.6 7" />
    </svg>
  );
}

/** Back to top. */
export function ArrowUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 19.5V5.2" />
      <path d="M6.2 11 12 5.2 17.8 11" />
    </svg>
  );
}

/** The arrow on the subscribe button. Mirrors with the writing direction. */
export function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.5 12h14.2" />
      <path d="M13 6.3 18.7 12 13 17.7" />
    </svg>
  );
}

/** The two CTA glyphs: a loosed arrow, and a reticle over the cast. */
export function JourneyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.6 19.4 19 5" />
      <path d="M13.4 5h5.6v5.6" />
      <path d="M4.6 19.4l2.6-.7.7-2.6" />
    </svg>
  );
}

export function ArchetypeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="7.4" />
      <path d="M12 1.9v3.2M12 18.9v3.2M1.9 12h3.2M18.9 12h3.2" />
      <circle cx="12" cy="12" r="2.1" />
    </svg>
  );
}

export const SOCIAL_ICON: Record<string, React.ReactNode> = {
  // The crossbar and the two strokes, which is what the mark is.
  x: <path d="M5 5l14 14M19 5 5 19" />,
  // A frame with the play triangle inside it.
  youtube: (
    <>
      <rect x="2.6" y="5.6" width="18.8" height="12.8" rx="3.4" />
      <path d="M10.2 9.4 15.6 12l-5.4 2.6V9.4Z" />
    </>
  ),
  instagram: (
    <>
      <rect x="3.4" y="3.4" width="17.2" height="17.2" rx="4.8" />
      <circle cx="12" cy="12" r="4.1" />
      <circle cx="17.1" cy="6.9" r="0.9" />
    </>
  ),
  // One closed silhouette — the face, its two collar notches and the flares at
  // the bottom corners — with the eyes on top. Drawn as a single outline
  // because two overlapping strokes left a hook where they met.
  discord: (
    <>
      <path d="M5.6 8.3C7 7.4 8.9 6.9 10.9 6.8l.5 1.1a10 10 0 0 1 1.2 0l.5-1.1c2 .1 3.9.6 5.3 1.5 1.6 2.7 2.5 5.6 2.6 8.7-1.5 1.4-3.4 2.2-5.4 2.4l-.9-1.6a12 12 0 0 1-5.4 0l-.9 1.6c-2-.2-3.9-1-5.4-2.4.1-3.1 1-6 2.6-8.7Z" />
      <circle cx="9.6" cy="13.2" r="1.15" />
      <circle cx="14.4" cy="13.2" r="1.15" />
    </>
  ),
};
