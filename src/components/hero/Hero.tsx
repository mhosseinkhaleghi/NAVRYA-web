import type { Dictionary } from "@/i18n/dictionaries";
import { APP_URL } from "@/config/site";

import styles from "./Hero.module.css";

/** The copy an opening slide needs. The home page's `hero` block is one. */
export type HeroCopy = {
  headline: string;
  subline: readonly string[];
  scroll: string;
};

/**
 * The opening slide, on the home page and on the features page.
 *
 * One component rather than two, and that is the point. The composition is the
 * same on both — headline, ruled break, sub-headline, scroll cue, over a plate
 * that plays itself in — and so is every rule that makes it behave: the three
 * grid bands that keep the block clear of the bar and the cue, the reveal it is
 * gated behind, the mirroring, the type scale, the shadow that lifts the words
 * off the footage. A second page with its own markup would inherit none of that
 * and would drift the first time any of it changed.
 *
 * What varies is stated as parameters. The features page has its own copy, sits
 * on its own rail, and carries no buttons — its slide is the start of an
 * argument rather than a place to act on one.
 */
export function Hero({
  dictionary,
  copy,
  actions = true,
  className,
}: {
  dictionary: Dictionary;
  /** Defaults to the home page's opening. */
  copy?: HeroCopy;
  /** The two links into the product. The home page's opening carries them. */
  actions?: boolean;
  /** An extra class on the section, for a slide that sits on a different rail. */
  className?: string;
}) {
  const { headline, subline, scroll } = copy ?? dictionary.hero;
  const { cta, trial } = dictionary.hero;

  return (
    <section
      className={className ? `${styles.hero} ${className}` : styles.hero}
      data-hero=""
    >
      <div className={styles.content} data-hero-part="">
        <h1 className={styles.headline}>{headline}</h1>

        <div className={styles.rule} aria-hidden="true">
          <span className={styles.ruleNode} />
        </div>

        <p className={styles.subline}>
          {subline.map((line) => (
            <span key={line} className={styles.sublineLine}>
              {line}
            </span>
          ))}
        </p>

        {/*
         * Two ways into the product, ranked rather than paired.
         *
         * The design system allows one primary action per module, so the two
         * cannot both be filled. The trial is the primary: this is a marketing
         * page and the visitor it is written for does not have an account yet.
         * Opening the dashboard is for someone who already does, which is the
         * secondary case here even though it is the more important action to
         * the person doing it.
         *
         * Anchors, not buttons: both leave the site for the product, so they
         * have to work with JavaScript off, open in a new tab on a modified
         * click and be reachable by keyboard — all of which an anchor is.
         */}
        {actions ? (
          <div className={styles.actions}>
            <a className={styles.trial} href={APP_URL} data-hero-trial="">
              {trial}
            </a>
            <a className={styles.cta} href={APP_URL} data-hero-cta="">
              {cta}
              <svg className={styles.ctaIcon} viewBox="0 0 16 16" aria-hidden="true">
                <path d="M4 12L12 4M6 4h6v6" />
              </svg>
            </a>
          </div>
        ) : null}
      </div>

      {/*
       * Two elements, not one, and the inner one is the whole reason.
       *
       * The cue arrives on an animation and leaves on `--exit`, and both used
       * to be on this element — but a running animation outranks a normal
       * declaration, so for as long as the entrance was still playing the cue
       * was pinned visible no matter what the exit said. It is not a narrow
       * window either: the timeline unlocks when the opening plate ends, and
       * the cue is still arriving then — measured at opacity 0.752 with the
       * page already live and scrollable.
       *
       * So the part carries the exit and the inner span carries the entrance,
       * which is the arrangement every other block in this hero already has —
       * `.content` leaves, and the headline, rule and sub-headline inside it
       * arrive. The two transforms compose instead of fighting.
       */}
      <div className={styles.scroll} data-hero-part="">
        <span className={styles.scrollInner}>
          <span className={styles.scrollLabel}>{scroll}</span>
          <span className={styles.mouse} aria-hidden="true">
            <span className={styles.wheel} />
          </span>
        </span>
      </div>
    </section>
  );
}
