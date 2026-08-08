import type { Dictionary } from "@/i18n/dictionaries";

import styles from "./MissSection.module.css";

/**
 * Section 6 — the miss, and what it teaches.
 *
 * Two states over one plate, both driven by scroll. First the statement: the
 * headline lands on the frame the arrow buries itself in the tree, and the
 * block lifts as the stag turns and runs, so the words travel with the animal
 * rather than watching it go. Then, once the frame is empty, the statement
 * gives way to the features and the picture holds still behind them.
 *
 * The features are a carousel the wheel drives: one slide per stretch of the
 * beat, each sliding in, holding, and sliding out. `--in` and `--out` are the
 * two progresses the controller writes onto each slide, so the whole carousel
 * runs backwards as readily as forwards — there is no index and no state.
 */
/**
 * The comp's ornament: a hairline with a four-pointed star at its centre,
 * rather than the rotated square the panels carry. Drawn as a path so the
 * concave sides hold their shape at any size.
 */
function Ornament() {
  return (
    <div className={styles.ornament}>
      <svg className={styles.ornamentStar} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 0 L13.4 10.6 L24 12 L13.4 13.4 L12 24 L10.6 13.4 L0 12 L10.6 10.6 Z" />
      </svg>
    </div>
  );
}

export function MissSection({ miss }: { miss: Dictionary["miss"] }) {
  return (
    <section className={styles.miss} data-miss="" aria-hidden="true">
      {/* The statement. */}
      <div className={styles.told}>
        <div className={styles.statement}>
          <p className={styles.eyebrow}>{miss.eyebrow}</p>
          <Ornament />
          <h2 className={styles.headline}>
            {miss.headline.map((line) => (
              <span key={line} className={styles.headlineLine}>
                {line}
              </span>
            ))}
          </h2>
          <p className={styles.subline}>{miss.subline}</p>
        </div>
      </div>

      {/* The features, over the held frame. */}
      <div className={styles.traits}>
        <div className={styles.bezel}>
          <span className={styles.bezelNotch} />
        </div>

        <div className={styles.rail}>
          <p className={styles.eyebrow}>{miss.eyebrow}</p>
          <Ornament />

          <div className={styles.deck}>
            {miss.traits.map((trait, index) => (
              <article key={trait.index} className={styles.trait} data-trait={index}>
                <p className={styles.traitIndex}>
                  {miss.traitsLabel} {trait.index}
                </p>
                <h3 className={styles.traitTitle}>{trait.title}</h3>
                <p className={styles.traitBody}>
                  {trait.body.map((line) => (
                    <span key={line} className={styles.traitLine}>
                      {line}
                    </span>
                  ))}
                </p>
              </article>
            ))}
          </div>

          <ul className={styles.dots}>
            {miss.traits.map((trait, index) => (
              <li key={trait.index} className={styles.dot} data-dot={index} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
