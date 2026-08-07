import type { Dictionary } from "@/i18n/dictionaries";

import styles from "./ArrowSection.module.css";

/**
 * Section 5 — the closing scene, composed around the loosed arrow.
 *
 * Everything here is driven by scroll position, like the rest of the sequence.
 * The plate underneath scrubs: the release, the arrow's flight and the fall to
 * black all run at the speed of the wheel. The headline arrives as the arrow
 * reaches the middle of the frame, and the paragraph fades up as the valley
 * disappears behind it.
 *
 * Then the paragraph lights up a word at a time. One custom property, `--lit`,
 * carries the whole reveal — each word knows its own index and works out its
 * own brightness, so the controller writes a single number per frame rather
 * than touching thirty elements.
 *
 * The band the arrow occupies is reserved rather than guessed. The plate's
 * rendered height is known in CSS, and the arrow sits at a fixed fraction of
 * it, which is what keeps the headline off the fletching at every aspect ratio.
 */
export function ArrowSection({ closing }: { closing: Dictionary["closing"] }) {
  const words = closing.body.split(/\s+/).filter(Boolean);

  return (
    <section
      className={styles.arrow}
      data-arrow=""
      data-words={words.length}
      aria-hidden="true"
    >
      <div className={styles.halo} />

      {/*
       * The edge light, drawn rather than faded.
       *
       * `pathLength` renormalises the rectangle's perimeter to 100 whatever the
       * viewport, so `--glow` — the fraction of the beat scrolled — is also
       * exactly the fraction of the ring that has been drawn. The line advances
       * at a constant rate around the frame and retreats if the wheel does.
       *
       * `vector-effect` keeps the stroke an even weight in screen pixels even
       * though the square viewBox is being stretched to the frame's aspect,
       * which is what lets one rectangle serve every viewport.
       */}
      <svg
        className={styles.ring}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="nv-ring-hues" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3b6dff" />
            <stop offset="18%" stopColor="#8b5cf6" />
            <stop offset="36%" stopColor="#e0489f" />
            <stop offset="54%" stopColor="#f0913a" />
            <stop offset="72%" stopColor="#f5d67b" />
            <stop offset="88%" stopColor="#35d6c4" />
            <stop offset="100%" stopColor="#2ea8f5" />
          </linearGradient>
        </defs>
        {/* Starts at top centre and runs clockwise, so the light opens away
         * from the middle of the frame and closes on itself at the end. A
         * `rect` would start in a corner. */}
        <path className={styles.ringBloom} d="M50 0H100V100H0V0Z" pathLength="100" />
        <path className={styles.ringLine} d="M50 0H100V100H0V0Z" pathLength="100" />
      </svg>

      <div className={styles.frame}>
        <h2 className={styles.headline} data-arrow-head="">
          {closing.headline}
        </h2>

        <p className={styles.body}>
          {/* The space belongs inside the span. Two adjacent spans with nothing
           * between them are not a line-break opportunity, and the paragraph
           * runs off the edge of the frame as one unbreakable word. */}
          {words.map((word, index) => (
            <span
              key={`${index}-${word}`}
              className={styles.word}
              style={{ "--i": index } as React.CSSProperties}
            >
              {word}{" "}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}
