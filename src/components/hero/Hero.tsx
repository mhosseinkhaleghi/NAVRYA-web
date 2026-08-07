import type { Dictionary } from "@/i18n/dictionaries";

import styles from "./Hero.module.css";

export function Hero({ dictionary }: { dictionary: Dictionary }) {
  const { headline, subline, scroll } = dictionary.hero;

  return (
    <section className={styles.hero}>
      <div className={styles.content}>
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
      </div>

      <div className={styles.scroll}>
        <span className={styles.scrollLabel}>{scroll}</span>
        <span className={styles.mouse} aria-hidden="true">
          <span className={styles.wheel} />
        </span>
      </div>
    </section>
  );
}
