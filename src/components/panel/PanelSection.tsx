import { PANEL_ICONS, type PanelIconName } from "@/components/icons/PanelIcons";
import type { Dictionary } from "@/i18n/dictionaries";

import styles from "./PanelSection.module.css";

export type Panel = Dictionary["panels"][number];

/**
 * A content panel — sections 2, 3 and 4 are the same composition with different
 * copy, so they are one component rendered three times.
 *
 * Each arrives on cues taken from its own plate: `data-reveal-group` marks
 * which beat an element belongs to and `--r` is the 0–1 progress the controller
 * writes onto it, so the whole reveal runs backwards as readily as forwards.
 * The headline is its own group because in section 2 it lands early, on the
 * deer's entrance, with everything else following once the deer settles.
 */
export function PanelSection({
  id,
  panel,
  scrollLabel,
}: {
  id: string;
  panel: Panel;
  scrollLabel: string;
}) {
  const { eyebrow, headline, subline, featuresLabel, features, icon } = panel;
  const Icon = PANEL_ICONS[icon as PanelIconName] ?? PANEL_ICONS.compass;

  return (
    <section className={styles.panel} data-panel={id} aria-hidden="true">
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
              <Icon className={styles.featureIcon} />
              <span className={styles.featureLabel}>{feature.label}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* The comp gives each panel its own cue: the same mouse as the hero's,
       * carried on down to a node — a thread to whatever comes next. */}
      <div className={styles.cue} data-reveal-group="rest" data-reveal-step="6">
        <span className={styles.cueLabel}>{scrollLabel}</span>
        <span className={styles.mouse}>
          <span className={styles.wheel} />
        </span>
        <span className={styles.cueLine} />
        <span className={styles.cueNode} />
      </div>
    </section>
  );
}
