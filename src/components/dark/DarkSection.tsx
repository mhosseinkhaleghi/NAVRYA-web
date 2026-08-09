import type { Dictionary } from "@/i18n/dictionaries";

import styles from "./DarkSection.module.css";

/**
 * The comp's ornament for this section: a hairline carrying a pair of facing
 * scrolls around a centred diamond.
 *
 * Heavier than the rule the panels use and heavier than section 6's star,
 * which is the point — this block is the only thing on a black frame, so it
 * carries the ornament the rest of the site spends more sparingly. Drawn as
 * paths on a fixed viewBox, centred over a hairline that fades at both ends,
 * so the curls keep their shape at any width.
 */
function Flourish({ wide = false }: { wide?: boolean }) {
  return (
    <div className={wide ? styles.flourishWide : styles.flourish}>
      <svg className={styles.flourishMark} viewBox="0 0 72 18" aria-hidden="true">
        {[false, true].map((mirror) => (
          <g
            key={String(mirror)}
            transform={mirror ? "scale(-1,1) translate(-72,0)" : undefined}
          >
            <path d="M4 9C10 9 14 4.2 20 5.7c4.5 1.1 5 6 1 7.1-3.2.9-5.2-2-3-3.4" />
            <path d="M25.4 9h5.2" />
          </g>
        ))}
        <path className={styles.flourishNode} d="M36 5.2 39.8 9 36 12.8 32.2 9Z" />
      </svg>
    </div>
  );
}

/**
 * Section 7 — the sequence ends on the page's own ground.
 *
 * Every other section is composed over a plate. This one is composed over
 * nothing: the forest goes down through the `fall` beat and what is left is the
 * near-black the document has underneath the whole film. The orb is the only
 * light in it.
 *
 * It is not part of the film. Below the track the site is an ordinary page —
 * vertical sections one after another — and this is the first of them.
 *
 * The reveal is still scrubbed by scroll, which is what makes it feel like the
 * film it follows: `--head` and `--body` are written from each block's own
 * position in the frame. The headline rises and the orb rides the *same*
 * property, so the backdrop comes up with the words rather than announcing
 * them; the paragraph follows because it is lower down and reaches the mark
 * later. Neither ever runs backwards — once a section has arrived, scrolling
 * back up is just scrolling.
 *
 * The orb's host is markup, not a component: an empty div the inline orb script
 * boots a WebGL canvas into once the controller marks it live. See
 * `orb-script.ts` for why it is not a React client component.
 */
export function DarkSection({ dark }: { dark: Dictionary["dark"] }) {
  return (
    <section className={styles.dark} data-dark="">
      {/* Behind everything, and behind the words in particular. */}
      <div className={styles.orb} data-orb="" />

      <div className={styles.frame}>
        <div className={styles.block}>
          <p className={styles.eyebrow}>{dark.eyebrow}</p>
          <Flourish />

          <h2 className={styles.headline} data-rise="head">
            {dark.headline.map((line) => (
              <span key={line} className={styles.headlineLine}>
                {line}
              </span>
            ))}
          </h2>

          <Flourish wide />

          <p className={styles.body} data-rise="body">
            {dark.body.map((line) => (
              <span key={line} className={styles.bodyLine}>
                {line}
              </span>
            ))}
          </p>
        </div>
      </div>
    </section>
  );
}
