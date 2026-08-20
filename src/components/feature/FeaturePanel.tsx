import { BattleFrame } from "./BattleFrame";

import styles from "./FeaturePanel.module.css";

/**
 * The features page's second slide.
 *
 * Constructed exactly as the film's panels are on the home page, because it is
 * driven by exactly the same code: the controller writes `--r` onto anything
 * carrying `data-reveal-group` as the shot beneath scrubs, and `--exit` onto
 * the panel as the slide leaves over the shot that follows. Nothing in here
 * listens to the scroll; every value is a function of those two properties.
 *
 * `data-reveal-group="title"` arrives on the first cue and `"rest"` on the
 * second, staggered — the head, then the frame drawing itself around a shot
 * that is already running.
 */
export function FeaturePanel({
  id,
  headline,
}: {
  id: string;
  headline: string;
}) {
  return (
    <section className={styles.panel} data-panel={id}>
      <div className={styles.head} data-reveal-group="title">
        <h2 className={styles.headline}>{headline}</h2>
      </div>

      <div className={styles.frameRow} data-reveal-group="rest" data-reveal-step="0">
        <BattleFrame styles={styles} />
      </div>
    </section>
  );
}
