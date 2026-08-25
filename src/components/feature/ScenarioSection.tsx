import styles from "./ScenarioSection.module.css";

/**
 * Scenarios — the second section below the film.
 *
 * Reached by ordinary document scroll, like the session workspace above it. No
 * beat, no scrub, no magnetic stop: the film handed over one section ago and
 * nothing here is driven by the stage controller.
 *
 * ── The gallery, and why it is not `CircularGallery` ─────────────────────────
 *
 * The design is React Bits' `CircularGallery`, and this is that design rather
 * than that component. Three things stood in the way of dropping it in, and
 * none of them is a matter of taste:
 *
 *   1. It renders through `ogl` — a WebGL context, a `Renderer`, shaders, and a
 *      `requestAnimationFrame` loop that never stops. `VERIFY_PLAN.md` states
 *      that this site carries no Three.js, no canvas and no WebGL, and that is
 *      not an incidental fact about the build: it is why the page runs the way
 *      it does on a phone.
 *   2. It is a client component with `useEffect`/`useRef`. This site ships zero
 *      `"use client"`, so adding it would turn React hydration on for a page
 *      that currently sends none of it.
 *   3. Its `App` binds `wheel`, `mousewheel`, `mousedown/move/up` and
 *      `touchstart/move/end` on **`window`**, and converts vertical wheel delta
 *      into horizontal travel. On this page the vertical wheel belongs to the
 *      film's controller, which owns the magnetic stops between shots. Two
 *      things reading the same gesture is not a layout problem, it is a fight.
 *
 * So the composition and the motion are `CircularGallery`'s, and the mechanism
 * is this project's. The row is a native horizontal scroller — real momentum on
 * a touchscreen, real trackpad support, real keyboard support, no listeners at
 * all — and the arc is done with a scroll-driven CSS animation.
 *
 * The arc is the interesting part. `CircularGallery` computes, per frame and
 * per card, how far the card is from the middle and bends it onto a circle:
 * `y = R - sqrt(R² - x²)`, with a matching rotation of `asin(x / R)`, so the
 * middle card sits highest and square and the ones either side drop away and
 * tilt. `animation-timeline: view(x)` gives a card exactly that quantity — its
 * own progress across the scrollport — as the driver of a keyframe list, so the
 * same curve comes out of the compositor with no script running. The keyframes
 * are the parabola through nine samples; over the top of a circle the two are
 * indistinguishable at this radius.
 *
 * The row is mirrored, rather than laid out, for Persian and Arabic: the
 * timeline does not survive a scroll container whose content overflows leftward.
 * That is measured and written up on `[dir="rtl"] .gallery` in the stylesheet.
 *
 * Where scroll-driven animations are not supported, the `@supports` block is
 * skipped and the row is flat: still a gallery, still scrollable, still all four
 * screens, just without the bend. That is the whole fallback.
 *
 * ── The pictures ────────────────────────────────────────────────────────────
 *
 * Empty, deliberately — the app screenshots are coming separately. Each frame
 * is the right size and in the right place without one, and `--shot` on `.well`
 * is the single property that has to change when they land.
 */

/** The mark on each note below the gallery. Drawn, not fetched. */
const MARK: Record<string, React.ReactNode> = {
  /* A window with a plan laid out in it. */
  planning: (
    <>
      <path d="M3.5 5.5h17v13h-17z" />
      <path d="M3.5 9h17" opacity="0.75" />
      <path d="M6.5 12h4.5v4H6.5z" opacity="0.75" />
      <path d="M13.5 12h4M13.5 15h4" opacity="0.6" />
    </>
  ),
  /* A tracked line with its readings marked on it. */
  probability: (
    <>
      <path d="M3.5 19.5h17" opacity="0.7" />
      <path d="M5 16l4-5 3.5 2.5L19 6" />
      <circle cx="5" cy="16" r="1.3" />
      <circle cx="9" cy="11" r="1.3" />
      <circle cx="12.5" cy="13.5" r="1.3" />
      <circle cx="19" cy="6" r="1.3" />
    </>
  ),
  /* A hub, and what it is tied to. */
  patterns: (
    <>
      <path d="M12 8.6V6M12 15.4V18M9.2 12H6.4M14.8 12h2.8" opacity="0.7" />
      <circle cx="12" cy="12" r="2.4" />
      <circle cx="12" cy="4.6" r="1.5" />
      <circle cx="12" cy="19.4" r="1.5" />
      <circle cx="4.9" cy="12" r="1.5" />
      <circle cx="19.1" cy="12" r="1.5" />
    </>
  ),
  /* A board with the plan's lines ticked off. */
  execution: (
    <>
      <path d="M5.5 4.5h13v15h-13z" />
      <path d="M9 3h6v3H9z" opacity="0.75" />
      <path d="M8.2 11.2l1.2 1.2 2.2-2.4M8.2 15.6l1.2 1.2 2.2-2.4" />
      <path d="M14 11.4h2.6M14 15.8h2.6" opacity="0.6" />
    </>
  ),
};

export function ScenarioSection({
  scenario,
  galleryLabel,
}: {
  scenario: {
    headline: readonly string[];
    body: string;
    cta: string;
    shots: readonly { key: string; title: string }[];
    features: readonly { key: string; label: string; body: string }[];
  };
  galleryLabel: string;
}) {
  return (
    <section className={styles.section} data-scenario="">
      <div className={styles.top}>
        <div className={styles.words}>
          <h2 className={styles.headline}>
            {scenario.headline.map((line) => (
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

          <p className={styles.body}>{scenario.body}</p>

          {/* The same control the council and desk panels carry, so the page has
              one call to action and not three that look alike. */}
          <button type="button" className={styles.cta}>
            <span className={styles.ctaLabel}>{scenario.cta}</span>
            <span className={styles.ctaNode} aria-hidden="true" />
            <span className={styles.ctaRule} aria-hidden="true" />
          </button>
        </div>

        {/*
         * A scroll container, and therefore already operable: it is focusable in
         * its own right, arrow keys move it, a touchscreen flicks it, and a
         * trackpad swipe works because the browser is doing the scrolling rather
         * than a listener imitating it. The `region` and the label are what make
         * it findable — the same pair `CircularGallery` puts on its own root.
         */}
        <div
          className={styles.gallery}
          role="region"
          aria-label={galleryLabel}
          tabIndex={0}
        >
          <ul className={styles.rail}>
            {scenario.shots.map((shot) => (
              <li key={shot.key} className={styles.slide}>
                <figure className={styles.frame}>
                  {/* The screenshot goes here. Empty until it does. */}
                  <div className={styles.well} data-shot={shot.key} />
                  <figcaption className={styles.label}>{shot.title}</figcaption>
                </figure>

                {/*
                 * The reflection under the frame.
                 *
                 * A copy, flipped and faded, because a reflection has to show
                 * the thing it is under and no pseudo-element can. It is
                 * `aria-hidden` and carries no picture of its own: when the
                 * screenshots land they come in through `--shot` on both, and
                 * the browser downloads the file once.
                 */}
                <div className={styles.echo} aria-hidden="true">
                  <div className={styles.frame}>
                    <div className={styles.well} data-shot={shot.key} />
                    <div className={styles.label}>{shot.title}</div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ul className={styles.features}>
        {scenario.features.map((f) => (
          <li key={f.key} className={styles.feature}>
            <svg className={styles.featureMark} viewBox="0 0 24 24" aria-hidden="true">
              {MARK[f.key]}
            </svg>
            <h3 className={styles.featureLabel}>{f.label}</h3>
            <p className={styles.featureBody}>{f.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
