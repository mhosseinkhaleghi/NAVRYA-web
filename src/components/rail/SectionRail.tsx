import { RAIL } from "@/components/frame/stage-script";
import type { Dictionary } from "@/i18n/dictionaries";

import styles from "./SectionRail.module.css";

/**
 * What each mark is called.
 *
 * A rail of unlabelled dashes is fine to look at and useless to listen to, so
 * every mark is named by its own section's headline — a name the viewer has
 * already read, in their own language, with no copy invented for the rail.
 *
 * The key is `RAIL`'s own `name`, and the record is exhaustive over it. That is
 * the point: **adding a section to `RAIL` fails the build here until it is
 * given a label**, so the rail can never quietly fall a section behind the
 * site.
 */
const LABEL: Record<(typeof RAIL)[number]["name"], (d: Dictionary) => string> = {
  hero: (d) => d.hero.headline,
  panel1: (d) => d.panels[0].headline,
  panel2: (d) => d.panels[1].headline,
  panel3: (d) => d.panels[2].headline,
  closing: (d) => d.closing.headline,
  miss: (d) => d.miss.headline.join(" "),
  dark: (d) => d.dark.headline.join(" "),
};

/**
 * The section rail — one mark per section, down the trailing edge of the frame.
 *
 * The sequence is thirty-nine screens of scroll end to end, which is right for
 * watching it and wrong for going back to something. The rail is the way back:
 * one mark per section, the current one drawn long, and a click travels to that
 * section *through* the footage rather than cutting to it.
 *
 * There is no state here and no client component. Which mark is lit and where
 * each one lands are both worked out by the stage controller from the same beat
 * table that drives every other thing on screen, so retiming a beat moves the
 * rail with it and nothing has to be kept in step by hand.
 */
export function SectionRail({ dictionary }: { dictionary: Dictionary }) {
  return (
    <nav className={styles.rail} aria-label={dictionary.a11y.sectionNav}>
      <ul className={styles.list}>
        {RAIL.map((section, index) => (
          <li key={section.name} className={styles.item}>
            <button
              type="button"
              className={styles.mark}
              data-rail-mark={index}
              aria-label={LABEL[section.name](dictionary)}
            >
              <span className={styles.dash} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
