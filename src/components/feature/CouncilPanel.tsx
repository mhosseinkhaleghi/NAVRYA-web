import styles from "./CouncilPanel.module.css";

/**
 * The features page's fourth slide: the council table.
 *
 * A left-railed block over a shot that rushes in and settles — headline, ruled
 * break, sub-headline, a way onward, and the three words the argument resolves
 * into. It is the opening's composition again, one page later and one step
 * further on: the map established the ground, the callouts named what is on it,
 * and this is what follows from both.
 *
 * Driven like every other panel. `--r` arrives on the reveal groups as the shot
 * beneath scrubs and `--exit` takes the slide away; nothing here reads the
 * scroll. The head is the `title` group so it arrives on the first cue, and
 * everything under it is `rest`, staggered in the order it is read.
 */

/** The mark above each pillar. Drawn, not fetched — three small shapes. */
const PILLAR_ICON: Record<string, React.ReactNode> = {
  /* A shield: what is kept out. */
  noise: (
    <>
      <path d="M12 3l7 3v5.5c0 4.2-2.9 7.4-7 8.5-4.1-1.1-7-4.3-7-8.5V6l7-3z" />
      <path d="M9 11.5l2 2 4-4" opacity="0.7" />
    </>
  ),
  /* A compass rose: what is found. */
  clarity: (
    <>
      <path d="M12 2.5l1.6 6.9 6.9 1.6-6.9 1.6L12 19.5l-1.6-6.9L3.5 11l6.9-1.6L12 2.5z" />
      <path d="M12 6.6l.8 3.6 3.6.8-3.6.8-.8 3.6-.8-3.6L7.6 11l3.6-.8L12 6.6z" opacity="0.55" />
    </>
  ),
  /* A crown: what it is all for. */
  decisions: (
    <>
      <path d="M3.5 8l3.2 3.4L12 5l5.3 6.4L20.5 8v9.5h-17V8z" />
      <path d="M3.5 20.5h17" opacity="0.7" />
    </>
  ),

  /* ── the fifth slide's three ──────────────────────────────────────────── */

  /* A spoken line, and the spark that files it. */
  aifill: (
    <>
      <path d="M4 5.5h13.5v9H10l-4 3.5v-3.5H4v-9z" />
      <path d="M19.4 3l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9L16.8 5.6l1.9-.7L19.4 3z" opacity="0.75" />
      <path d="M7.5 9h6.5" opacity="0.55" />
    </>
  ),
  /* A clock: the session is the unit. */
  session: (
    <>
      <path d="M12 3.5a8.5 8.5 0 110 17 8.5 8.5 0 010-17z" />
      <path d="M12 7.4V12l3.2 1.9" opacity="0.75" />
    </>
  ),
  /* A line that ends higher than it started. */
  review: (
    <>
      <path d="M3.5 19.5h17" opacity="0.7" />
      <path d="M5 15.6l4.2-4.4 3.1 2.6L19 6.5" />
      <path d="M15.4 6.5H19v3.6" opacity="0.75" />
    </>
  ),
};

export function CouncilPanel({
  id,
  headline,
  subline,
  cta,
  pillars,
}: {
  id: string;
  headline: string;
  subline: readonly string[];
  cta: string;
  pillars: readonly { key: string; label: string; body: string }[];
}) {
  return (
    /*
     * The commander's skin, which the design system already carries: this whole
     * page is his, and `--char-accent` under it is the ember red the footage is
     * lit by. The marks below take it rather than a colour invented for them.
     */
    <section className={styles.panel} data-panel={id} data-character="commander">
      <div className={styles.block}>
        <div className={styles.head} data-reveal-group="title">
          <h2 className={styles.headline}>{headline}</h2>
        </div>

        <div className={styles.rule} data-reveal-group="rest" data-reveal-step="0" aria-hidden="true">
          <span className={styles.ruleLine} />
          <span className={styles.ruleNode} />
          <span className={styles.ruleLineFaint} />
        </div>

        <p className={styles.subline} data-reveal-group="rest" data-reveal-step="1">
          {subline.map((line) => (
            <span key={line} className={styles.sublineLine}>
              {line}
            </span>
          ))}
        </p>

        {/*
         * A button, not a link.
         *
         * There is nowhere for it to go yet — the approach it promises is a page
         * that does not exist — and the site's rule for that is settled: a
         * control that is visibly inert beats an `<a href="#">` that silently
         * does nothing. The header's unbuilt nav items and the footer's columns
         * are buttons for the same reason. It becomes an anchor the day the
         * page lands, and nothing else about it changes.
         */}
        <button
          type="button"
          className={styles.cta}
          data-council-cta=""
          data-reveal-group="rest"
          data-reveal-step="2"
        >
          <span className={styles.ctaLabel}>{cta}</span>
          <span className={styles.ctaNode} aria-hidden="true" />
          <span className={styles.ctaRule} aria-hidden="true" />
        </button>

        <ul className={styles.pillars}>
          {pillars.map((p, i) => (
            <li
              key={p.key}
              className={styles.pillar}
              data-reveal-group="rest"
              data-reveal-step={3 + i}
            >
              <svg className={styles.pillarIcon} viewBox="0 0 24 24" aria-hidden="true">
                {PILLAR_ICON[p.key]}
              </svg>
              <span className={styles.pillarLabel}>{p.label}</span>
              <span className={styles.pillarBody}>{p.body}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
