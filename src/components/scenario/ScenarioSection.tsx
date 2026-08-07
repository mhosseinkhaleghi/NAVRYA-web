import { CompassIcon } from "@/components/icons/CompassIcon";
import type { Dictionary } from "@/i18n/dictionaries";

import styles from "./ScenarioSection.module.css";

/**
 * Section 2 — the scenario panel.
 *
 * It arrives in two beats, both driven by scroll position rather than time:
 * the headline lands as the deer walks into frame, and everything else
 * assembles around it once the deer settles to graze. `data-reveal-group` marks
 * which beat an element belongs to and `--r` is the 0–1 progress the controller
 * writes onto it, so the whole reveal runs backwards just as readily as
 * forwards.
 */
export function ScenarioSection({ dictionary }: { dictionary: Dictionary }) {
  const { eyebrow, headline, subline, featuresLabel, features } = dictionary.scenario;
  const { scroll } = dictionary.hero;

  return (
    <section className={styles.scenario} data-scenario="" aria-hidden="true">
      <div className={styles.content}>
        <p className={styles.eyebrow} data-reveal-group="rest" data-reveal-step="0">
          {eyebrow}
        </p>

        <div
          className={styles.rule}
          data-rule="eyebrow"
          data-reveal-group="rest"
          data-reveal-step="1"
        >
          <span className={styles.ruleNode} />
        </div>

        {/* The one thing that lands on the deer's entrance. */}
        <h2 className={styles.headline} data-reveal-group="title">
          {headline}
        </h2>

        <div
          className={styles.rule}
          data-rule="headline"
          data-reveal-group="rest"
          data-reveal-step="2"
        >
          <span className={styles.ruleNode} />
        </div>

        <p className={styles.subline} data-reveal-group="rest" data-reveal-step="3">
          {subline.map((line) => (
            <span key={line} className={styles.sublineLine}>
              {line}
            </span>
          ))}
        </p>

        <p className={styles.featuresLabel} data-reveal-group="rest" data-reveal-step="4">
          {featuresLabel}
        </p>

        <ul className={styles.features}>
          {features.map((feature, index) => (
            <li
              key={feature.index}
              className={styles.feature}
              data-reveal-group="rest"
              data-reveal-step={5 + index}
            >
              <span className={styles.featureIndex}>{feature.index}</span>
              <span className={styles.featureDivider} />
              <CompassIcon className={styles.featureIcon} />
              <span className={styles.featureLabel}>{feature.label}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* The comp gives this section its own cue: the same mouse as the hero's,
       * carried on down to a node — a thread to whatever comes next. */}
      <div className={styles.cue} data-reveal-group="rest" data-reveal-step="6">
        <span className={styles.cueLabel}>{scroll}</span>
        <span className={styles.mouse}>
          <span className={styles.wheel} />
        </span>
        <span className={styles.cueLine} />
        <span className={styles.cueNode} />
      </div>
    </section>
  );
}
