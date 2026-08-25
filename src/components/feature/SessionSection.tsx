import styles from "./SessionSection.module.css";

/**
 * The session workspace — the first section below the film.
 *
 * The film ends on the desk and hands over to ordinary document scroll here.
 * Nothing on this section is driven by the stage controller: no beat, no
 * scrubbing, no magnetic stop. It is reached the way anything on any page is
 * reached, which is what was asked for and one fewer thing that can behave
 * differently inside an embed.
 *
 * ── The card stack ──────────────────────────────────────────────────────────
 *
 * The design is React Bits' `CardSwap`, and this is that animation rather than
 * that component. `CardSwap` is a client component driving GSAP from
 * `useEffect`, and this project has no client React at all — every behaviour on
 * the site is one inline controller, and GSAP is on the list of things
 * `VERIFY_PLAN.md` says the site does not carry. Adding both would mean React
 * hydration on a page that currently ships none, plus a 70KB animation library,
 * on the page whose weight was a complaint two commits ago.
 *
 * So the geometry is `CardSwap`'s, exactly: slot `i` sits at `x = i·60px`,
 * `y = -i·70px`, `z = -i·90px` with `zIndex = total - i`, every card skewed 6°
 * on a container with 900px of perspective. The motion is `CardSwap`'s too —
 * the front card drops away, the rest promote one slot forward, and the dropped
 * card returns to the back.
 *
 * What differs is what runs it. Every card follows the *same* path, so one
 * keyframe sequence covers all five and each card is offset by a negative
 * `animation-delay` of its own index. That is the whole implementation: no
 * script, no timers, no hydration, and the browser runs it on the compositor.
 *
 * ── The pictures ────────────────────────────────────────────────────────────
 *
 * Each card is a frame with its number, its name, its mark, and a well where
 * the screenshot goes. The wells are deliberately empty: the images are coming
 * separately, and a card is the right size and in the right place without one.
 * `--shot` on `.well` is the only thing that has to change when they land.
 */

/** The mark on each card's header, and on each feature below. Drawn, not fetched. */
const MARK: Record<string, React.ReactNode> = {
  /* Four panes: the workspace is everything at once. */
  workspace: (
    <>
      <path d="M3.5 4.5h7v6h-7zM13.5 4.5h7v6h-7zM3.5 13.5h7v6h-7zM13.5 13.5h7v6h-7z" />
    </>
  ),
  /* A clock: the timeline is the session's own hours. */
  timeline: (
    <>
      <path d="M12 3.5a8.5 8.5 0 110 17 8.5 8.5 0 010-17z" />
      <path d="M12 7.4V12l3.2 1.9" opacity="0.75" />
    </>
  ),
  /* A line that ends higher than it started. */
  charts: (
    <>
      <path d="M3.5 19.5h17" opacity="0.7" />
      <path d="M5 15.6l4.2-4.4 3.1 2.6L19 6.5" />
      <path d="M15.4 6.5H19v3.6" opacity="0.75" />
    </>
  ),
  /* One node branching into three: a plan and its outcomes. */
  scenarios: (
    <>
      <path d="M5 12h4M13 6.5h2.5M13 12h2.5M13 17.5h2.5" opacity="0.75" />
      <path d="M9 12V6.5h4M9 12v5.5h4M9 12h4" />
      <path d="M3 10.2h2.4v3.6H3zM17.6 4.7H21v3.6h-3.4zM17.6 10.2H21v3.6h-3.4zM17.6 15.7H21v3.6h-3.4z" />
    </>
  ),
  /* A dial turned back: what already happened. */
  history: (
    <>
      <path d="M12 3.5a8.5 8.5 0 110 17 8.5 8.5 0 010-17z" />
      <path d="M12 7.6V12l3 1.8" opacity="0.75" />
      <path d="M3.6 8.4l2.6 1.1 1.1-2.6" opacity="0.6" />
    </>
  ),
};

export function SessionSection({
  session,
}: {
  session: {
    eyebrow: string;
    headline: readonly string[];
    body: string;
    cards: readonly { key: string; index: string; title: string }[];
    features: readonly { key: string; label: string; body: string }[];
  };
}) {
  return (
    <section className={styles.section} data-session="">
      <div className={styles.top}>
        <div className={styles.words}>
          <p className={styles.eyebrow}>
            <span className={styles.eyebrowNode} aria-hidden="true" />
            {session.eyebrow}
          </p>

          <h2 className={styles.headline}>
            {session.headline.map((line) => (
              <span key={line} className={styles.headlineLine}>
                {line}
              </span>
            ))}
          </h2>

          <div className={styles.rule} aria-hidden="true">
            <span className={styles.ruleLine} />
            <span className={styles.ruleNode} />
            <span className={styles.ruleLineFaint} />
          </div>

          <p className={styles.body}>{session.body}</p>

          {/* The five cards, named. It is the stack's contents as a sentence,
              so the list and the animation cannot drift apart — both map the
              same array. */}
          <ul className={styles.names}>
            {session.cards.map((card) => (
              <li key={card.key} className={styles.name}>
                {card.title}
              </li>
            ))}
          </ul>
        </div>

        {/*
         * `aria-hidden`, and not carelessly: every card's title is already in
         * the list above, in the reader's own language and in the same order.
         * A screen reader that walked the stack as well would hear the same
         * five names twice, and the second time from a rotating carousel it
         * cannot control.
         */}
        <div className={styles.stack} aria-hidden="true">
          <div className={styles.stackInner}>
            {session.cards.map((card, i) => (
              <article
                key={card.key}
                className={styles.card}
                /* Its place in the cycle. One keyframe sequence runs all five;
                   this is what offsets each card into its own slot. */
                style={{ "--i": i } as React.CSSProperties}
              >
                <header className={styles.cardHead}>
                  <span className={styles.cardIndex}>{card.index}</span>
                  <h3 className={styles.cardTitle}>{card.title}</h3>
                  <svg className={styles.cardMark} viewBox="0 0 24 24" aria-hidden="true">
                    {MARK[card.key]}
                  </svg>
                </header>
                {/* The screenshot goes here. Empty until it does. */}
                <div className={styles.well} data-shot={card.key} />
              </article>
            ))}
          </div>
        </div>
      </div>

      <ul className={styles.features}>
        {session.features.map((f) => (
          <li key={f.key} className={styles.feature}>
            <svg className={styles.featureMark} viewBox="0 0 24 24" aria-hidden="true">
              {MARK[f.key]}
            </svg>
            <div className={styles.featureWords}>
              <h3 className={styles.featureLabel}>{f.label}</h3>
              <p className={styles.featureBody}>{f.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
