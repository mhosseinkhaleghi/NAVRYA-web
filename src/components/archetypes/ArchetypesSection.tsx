import type { Dictionary } from "@/i18n/dictionaries";

import styles from "./ArchetypesSection.module.css";

/**
 * Each archetype's mark.
 *
 * The same line-art vocabulary as the partners' emblems and the rest of the
 * site's ornaments — a 24-unit square, one stroke weight, no fills — so four
 * characters drawn from four different worlds still read as one set.
 */
const SIGIL: Record<string, React.ReactNode> = {
  // The scholar: a four-pointed star, the site's own, ringed.
  master: (
    <>
      <path d="M12 3.2 13.9 10.1 20.8 12 13.9 13.9 12 20.8 10.1 13.9 3.2 12 10.1 10.1Z" />
      <circle cx="12" cy="12" r="9.1" opacity="0.5" />
    </>
  ),
  // The tracker: antlers over a level horizon.
  hunter: (
    <>
      <path d="M12 20.5v-7.2" />
      <path d="M12 13.3 7.4 8.6V4.2l3 3.2h1.6" />
      <path d="M12 13.3l4.6-4.7V4.2l-3 3.2H12" />
      <path d="M4.6 18.4h3.1M16.3 18.4h3.1" opacity="0.6" />
    </>
  ),
  // The architect: a cell of a lattice, with its centre held.
  engineer: (
    <>
      <path d="M12 3.6 19.3 7.8v8.4L12 20.4 4.7 16.2V7.8L12 3.6Z" />
      <path d="M12 8.6 15.9 10.9v4.2L12 17.4 8.1 15.1v-4.2L12 8.6Z" opacity="0.75" />
      <circle cx="12" cy="13" r="1.3" />
    </>
  ),
  // The strategist: a chevron of command over a held line.
  commander: (
    <>
      <path d="M4.4 9.6 12 3.6l7.6 6" />
      <path d="M6.9 12.6 12 8.6l5.1 4" />
      <path d="M5.6 16.4h12.8" />
      <path d="M12 16.4v4" opacity="0.7" />
    </>
  ),
};

/**
 * The compass in the corner of the comp.
 *
 * Purely ornamental, and drawn rather than placed: it is the same four-pointed
 * star as the wordmark's, held inside two rings and four bearing marks.
 */
function Compass() {
  return (
    <svg className={styles.compass} viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="100" r="86" />
      <circle cx="100" cy="100" r="62" opacity="0.55" />
      <circle cx="100" cy="100" r="38" opacity="0.3" />
      <path
        className={styles.compassStar}
        d="M100 60 106.5 93.5 140 100 106.5 106.5 100 140 93.5 106.5 60 100 93.5 93.5Z"
      />
      {[0, 90, 180, 270].map((deg) => (
        <path
          key={deg}
          d="M100 8 102.6 15 100 22 97.4 15Z"
          transform={`rotate(${deg} 100 100)`}
          className={styles.compassNode}
        />
      ))}
    </svg>
  );
}

/**
 * Section 10 — the four archetypes.
 *
 * An accordion of four plates: one open, three held narrow, and the open one
 * follows the pointer. Adapted from React Bits' `AccordionGallery` rather than
 * dropped in — that component is a client component driving GSAP timelines, and
 * this site has no client React at all and no bundle in the preview the work is
 * reviewed through. What it does, though, is a width and a colour per panel, so
 * here it is a CSS transition on `flex-grow` and the controller does nothing but
 * say which panel is open. Same accordion, none of the machinery.
 *
 * With no JavaScript the panel marked open in the markup stays open and the
 * other three stay legible, so the section is complete before a line of script
 * runs — which is also why `data-on` is rendered here rather than set on boot.
 *
 * The plates live in the stylesheet rather than on `<img>` tags on purpose: the
 * preview inlines every asset as base64 and repeats the markup once per locale,
 * so four pictures in the markup would travel five times over. In CSS they
 * travel once.
 */
export function ArchetypesSection({
  archetypes,
}: {
  archetypes: Dictionary["archetypes"];
}) {
  return (
    <section className={styles.archetypes} data-archetypes="" data-reveal="">
      <div className={styles.head}>
        <p className={styles.eyebrow}>
          <span className={styles.tick} aria-hidden="true" />
          {archetypes.eyebrow}
          <span className={styles.tick} aria-hidden="true" />
        </p>
        <h2 className={styles.headline}>
          {archetypes.headline.map((line, i) => (
            <span key={line} className={styles.headlineLine}>
              {line}
              {i === archetypes.headline.length - 1 ? (
                <span className={styles.stop} aria-hidden="true">
                  .
                </span>
              ) : null}
            </span>
          ))}
        </h2>
        <div className={styles.rule} />
        <p className={styles.subline}>
          {archetypes.subline.map((line) => (
            <span key={line} className={styles.sublineLine}>
              {line}
            </span>
          ))}
        </p>
        <Compass />
      </div>

      <div className={styles.frame}>
        <span className={styles.pin} aria-hidden="true" />
        <div
          className={styles.gallery}
          data-gallery=""
          data-open="0"
          role="group"
          aria-label={archetypes.explore}
        >
          {archetypes.cast.map((member, index) => (
            <button
              key={member.id}
              type="button"
              className={styles.panel}
              data-cast-panel={index}
              data-art={member.id}
              {...(index === 0 ? { "data-on": "" } : {})}
              aria-pressed={index === 0}
            >
              <span className={styles.art} aria-hidden="true" />
              <span className={styles.veil} aria-hidden="true" />
              <span className={styles.plate}>
                <span className={styles.sigil} aria-hidden="true">
                  <svg viewBox="0 0 24 24">{SIGIL[member.id] ?? SIGIL.master}</svg>
                </span>
                <span className={styles.name}>
                  {member.name}
                  <span className={styles.nameRule} aria-hidden="true" />
                </span>
                <span className={styles.role}>{member.role}</span>
                <span className={styles.lines}>
                  {member.lines.map((line) => (
                    <span key={line} className={styles.line}>
                      {line}
                    </span>
                  ))}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <p className={styles.foot}>
        <span className={styles.footRule} aria-hidden="true" />
        {archetypes.explore}
        <span className={styles.footRule} aria-hidden="true" />
      </p>
    </section>
  );
}
