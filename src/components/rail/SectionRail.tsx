import type { Dictionary } from "@/i18n/dictionaries";

import styles from "./SectionRail.module.css";

/**
 * The section rail — one mark per section, down the leading edge of the frame.
 *
 * The sequence is nine thousand pixels of scroll end to end, which is right for
 * watching it and wrong for going back to something. The rail is the way back:
 * six marks, the current one drawn long, and a click travels to that section
 * *through* the footage rather than cutting to it.
 *
 * There is no state here and no client component. The marks are plain buttons;
 * which one is lit and where each one lands are both worked out by the stage
 * controller from the same beat table that drives every other thing on screen,
 * so retiming a beat moves the rail with it and nothing has to be kept in step
 * by hand.
 *
 * Each mark is named by its own section's headline. A rail of unlabelled dashes
 * is fine to look at and useless to listen to, and the headline is a name the
 * viewer has already read.
 */
export function SectionRail({ dictionary }: { dictionary: Dictionary }) {
  const { hero, panels, closing, miss, a11y } = dictionary;

  const marks = [
    hero.headline,
    ...panels.map((panel) => panel.headline),
    closing.headline,
    miss.headline.join(" "),
  ];

  return (
    <nav className={styles.rail} aria-label={a11y.sectionNav}>
      <ul className={styles.list}>
        {marks.map((label, index) => (
          <li key={index} className={styles.item}>
            <button
              type="button"
              className={styles.mark}
              data-rail-mark={index}
              aria-label={label}
            >
              <span className={styles.dash} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
