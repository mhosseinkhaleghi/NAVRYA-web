import type { Dictionary } from "@/i18n/dictionaries";

import styles from "./PartnersSection.module.css";

/**
 * The firms' emblems.
 *
 * Line art on the site's own hairline, each one a mark rather than a logo —
 * these are placeholder partners and the shapes are drawn to sit together as a
 * set. Every one is a 24-unit square so the ring around them never has to
 * account for a different box.
 */
const EMBLEM: Record<string, React.ReactNode> = {
  apex: (
    <>
      <path d="M12 5 4.5 19h15L12 5Z" />
      <path d="M12 11.5 8.6 19h6.8L12 11.5Z" />
    </>
  ),
  vee: (
    <>
      <path d="M4 5.5 12 19 20 5.5" />
      <path d="M9 5.5 12 11l3-5.5" />
    </>
  ),
  forge: (
    <>
      <path d="M12 3.4 20 8v8l-8 4.6L4 16V8l8-4.6Z" />
      <path d="M12 8.6 15.6 11v4L12 17l-3.6-2v-4L12 8.6Z" />
    </>
  ),
  bars: (
    <>
      <path d="M6.5 19v-5" />
      <path d="M10.2 19V9.5" />
      <path d="M13.8 19v-7" />
      <path d="M17.5 19V5.5" />
    </>
  ),
  arc: (
    <>
      <path d="M4.6 17.5 12 4.8l7.4 12.7" />
      <path d="M8.2 19 12 12.4 15.8 19" />
    </>
  ),
  star: (
    <>
      <path d="M12 3.5v17M3.5 12h17" />
      <path d="M6 6l12 12M18 6 6 18" />
    </>
  ),
};

/**
 * Section 8 — the prop firms.
 *
 * Not part of the film. This is ordinary document below the track: it reveals
 * once on the way in and keeps its reveal, so scrolling back up scrolls off it
 * rather than taking it apart. `data-reveal` is the latch the controller sets;
 * everything here reads `[data-in]` and `[data-on]` off the section.
 *
 * The firms sit on one continuous rail and drift along it — slowly, and without
 * a seam, because the run is rendered twice and the track travels exactly half
 * its own width before repeating. The drift is also what makes six firms work
 * on a frame that cannot hold six firms: nothing is cut off, it is simply not
 * on screen yet.
 */
export function PartnersSection({ partners }: { partners: Dictionary["partners"] }) {
  const run = (
    <ul className={styles.run}>
      {partners.firms.map((firm) => (
        <li key={firm.name} className={styles.firm}>
          <span className={styles.emblem}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {EMBLEM[firm.icon] ?? EMBLEM.star}
            </svg>
          </span>
          <span className={styles.stud} aria-hidden="true" />
          <span className={styles.name}>{firm.name}</span>
          <span className={styles.kind}>{firm.kind}</span>
          <span className={styles.dot} aria-hidden="true" />
          <span className={styles.tagline}>{firm.tagline}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <section className={styles.partners} data-partners="" data-reveal="">
      <div className={styles.head}>
        <p className={styles.eyebrow}>{partners.eyebrow}</p>
        <div className={styles.rule} />
        <h2 className={styles.headline}>{partners.headline}</h2>
        <p className={styles.subline}>{partners.subline}</p>
        <div className={styles.ruleWide} />
      </div>

      <div className={styles.rail}>
        <span className={styles.line} aria-hidden="true" />
        <div className={styles.marquee}>
          {run}
          {/* The second run is what makes the loop seamless; it is the same
              firms, so it is hidden from anything that reads rather than looks. */}
          <div aria-hidden="true" className={styles.echo}>
            {run}
          </div>
        </div>
      </div>
    </section>
  );
}
