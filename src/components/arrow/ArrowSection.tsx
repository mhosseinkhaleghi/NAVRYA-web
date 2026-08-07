import type { Dictionary } from "@/i18n/dictionaries";

import styles from "./ArrowSection.module.css";

/**
 * Section 5 — the closing scene, composed around the loosed arrow.
 *
 * The plate underneath plays rather than scrubs, and this section takes its
 * cues from the footage's own clock: the headline arrives at two seconds, when
 * the arrow is crisp and dead centre, and the paragraph fades up as the world
 * behind it falls away to black.
 *
 * Then scroll takes over. The paragraph starts barely legible and lights up a
 * word at a time as the viewer scrolls — one custom property, `--lit`, carries
 * the whole reveal: each word knows its own index and works out its own
 * brightness, so the controller writes a single number per frame rather than
 * touching thirty elements. The edge light comes up on the same beat.
 *
 * The band the arrow occupies is reserved rather than guessed. The plate is
 * letterboxed to 16:9, so its rendered height is known in CSS, and the arrow
 * sits at a fixed fraction of it — which is what keeps the headline off the
 * fletching at every aspect ratio from ultrawide to portrait.
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
      <div className={styles.glow} />

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
