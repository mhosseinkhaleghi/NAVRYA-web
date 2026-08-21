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
 * The headline and its rule, and nothing else. There was a gold ornamental
 * frame drawn around the map here; it is gone, and the map is the whole
 * picture. `BattleFrame` went with it rather than being left behind unused —
 * `git show ec1bc11:src/components/feature/BattleFrame.tsx` has it if a later
 * slide wants one.
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
        <span className={styles.rule} aria-hidden="true" />
      </div>
    </section>
  );
}
