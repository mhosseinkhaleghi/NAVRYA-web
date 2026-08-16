import type { Dictionary } from "@/i18n/dictionaries";
import { APP_URL } from "@/config/site";

import styles from "./Hero.module.css";

export function Hero({ dictionary }: { dictionary: Dictionary }) {
  const { headline, subline, scroll, cta } = dictionary.hero;

  return (
    <section className={styles.hero} data-hero="">
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

        {/* The hero's one primary action, and the only one above the film.
         *  An <a>, not a button: it leaves the site for the product, so it has
         *  to work with JavaScript off, open in a new tab on a modified click
         *  and be reachable by keyboard — all of which an anchor gives free. */}
        <a className={styles.cta} href={APP_URL} data-hero-cta="">
          {cta}
          <svg className={styles.ctaIcon} viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 12L12 4M6 4h6v6" />
          </svg>
        </a>
      </div>

      <div className={styles.scroll} data-hero-part="">
        <span className={styles.scrollLabel}>{scroll}</span>
        <span className={styles.mouse} aria-hidden="true">
          <span className={styles.wheel} />
        </span>
      </div>
    </section>
  );
}
