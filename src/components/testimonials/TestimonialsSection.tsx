import type { Dictionary } from "@/i18n/dictionaries";

import styles from "./TestimonialsSection.module.css";

type Quote = Dictionary["testimonials"]["quotes"][number];

/**
 * The monogram that stands in for a portrait.
 *
 * Nine photographs would be nine strangers' faces, and the site has none to
 * use honestly. Initials in a ringed disc say the same thing the comp's avatar
 * says — *a person said this* — in the site's own line-art, at any size, in
 * every locale, and with nothing to load. The names are Latin in all five
 * dictionaries, so the initials read the same everywhere.
 */
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("");
}

function Card({ quote }: { quote: Quote }) {
  return (
    <figure className={styles.card}>
      {/* The comp's opening mark, drawn rather than typed: a typographic quote
          glyph is a different shape in every font the five locales fall back
          to, and this one has to be the same shape in all of them. */}
      <svg className={styles.mark} viewBox="0 0 32 24" aria-hidden="true">
        <path d="M13 3.5C7.6 5.6 4.4 9.6 4.4 14.2c0 3.8 2.3 6.3 5.6 6.3 3 0 5.2-2.1 5.2-5 0-2.8-2-4.8-4.7-4.8-.5 0-1 .1-1.3.2.7-2.4 2.5-4.4 5.2-5.8L13 3.5Z" />
        <path d="M28.6 3.5C23.2 5.6 20 9.6 20 14.2c0 3.8 2.3 6.3 5.6 6.3 3 0 5.2-2.1 5.2-5 0-2.8-2-4.8-4.7-4.8-.5 0-1 .1-1.3.2.7-2.4 2.5-4.4 5.2-5.8l-1.4-1.6Z" />
      </svg>

      <blockquote className={styles.quote}>{quote.quote}</blockquote>

      <span className={styles.hair} aria-hidden="true" />

      <figcaption className={styles.who}>
        <span className={styles.avatar} aria-hidden="true">
          {initials(quote.name)}
        </span>
        <span className={styles.whoText}>
          <span className={styles.name}>{quote.name}</span>
          <span className={styles.role}>{quote.role}</span>
        </span>
      </figcaption>
    </figure>
  );
}

/**
 * Section 9 — what the traders say.
 *
 * The last of the three sections below the film, and built exactly like the two
 * above it: an ordinary section of a page, its own screen tall, sitting
 * directly under section 8 with nothing between them. Its heading rises on the
 * way in and its columns follow, both scrubbed by scroll and both kept at their
 * high-water mark, so once it has arrived scrolling back up is only scrolling.
 *
 * Three columns, travelling at three different speeds, the middle one against
 * the other two so the wall never reads as one block sliding. Each column is
 * its own seamless loop: its cards are rendered twice and the stream travels
 * exactly half its own height before repeating, which puts the echo precisely
 * where the run began. The drift is an animation rather than a reveal, and it
 * is held until the section has been seen — nothing ticks away nine screens
 * below the fold.
 *
 * Every column carries all nine quotes, each starting three further along than
 * the last. That is what makes the wall survive a narrow frame: three columns
 * become two and then one as the frame closes, and because no column holds a
 * quote the others do not, nothing is lost with them — a phone reads the same
 * nine people, one at a time, that a desktop reads three at a time.
 */
export function TestimonialsSection({
  testimonials,
}: {
  testimonials: Dictionary["testimonials"];
}) {
  // The same nine, each column starting a third of the way further round, so
  // the three windows are never on the same person at the same moment.
  const columns = [0, 1, 2].map((c) => [
    ...testimonials.quotes.slice(c * 3),
    ...testimonials.quotes.slice(0, c * 3),
  ]);

  return (
    <section className={styles.testimonials} data-testimonials="" data-reveal="">
      <div className={styles.head} data-rise="head">
        <p className={styles.pill}>{testimonials.eyebrow}</p>
        <h2 className={styles.headline}>{testimonials.headline}</h2>
        <p className={styles.subline}>{testimonials.subline}</p>
        <div className={styles.rule} />
      </div>

      <div className={styles.columns} data-rise="body">
        {columns.map((column, index) => (
          <div key={index} className={styles.column} data-column={index}>
            <div className={styles.stream}>
              <div className={styles.run}>
                {column.map((quote) => (
                  <Card key={quote.name} quote={quote} />
                ))}
              </div>
              {/* The echo is what makes the loop seamless; it is the same three
                  people, so it is hidden from anything that reads rather than
                  looks. */}
              <div className={styles.run} aria-hidden="true">
                {column.map((quote) => (
                  <Card key={quote.name} quote={quote} />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
