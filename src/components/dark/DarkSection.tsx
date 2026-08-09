import type { Dictionary } from "@/i18n/dictionaries";

import styles from "./DarkSection.module.css";

/**
 * Section 7 — the sequence ends on the page's own ground.
 *
 * Every other section is composed over a plate. This one is composed over
 * nothing: the forest goes down through the `fall` beat and what is left is the
 * near-black the document has underneath the whole film. The orb is the only
 * light in it.
 *
 * Two reveals, both driven by scroll like everything else. The headline rises
 * on `--head`, and the orb rides the *same* property, so the backdrop comes up
 * with the words rather than announcing them. The paragraph follows on its own
 * beat, `--body`.
 *
 * The orb's host is markup, not a component: an empty div the inline orb script
 * boots a WebGL canvas into once the controller marks it live. See
 * `orb-script.ts` for why it is not a React client component.
 *
 * NOTE: the copy here is provisional. Section 7's comp had not landed when this
 * was built, so the mechanics are finished and the words are not — replacing
 * the `dark` block in the dictionaries is all that is outstanding.
 */
export function DarkSection({ dark }: { dark: Dictionary["dark"] }) {
  return (
    <section className={styles.dark} data-dark="" aria-hidden="true">
      {/* Behind everything, and behind the words in particular. */}
      <div className={styles.orb} data-orb="" />

      <div className={styles.frame}>
        <div className={styles.block}>
          <p className={styles.eyebrow}>{dark.eyebrow}</p>

          <h2 className={styles.headline}>
            {dark.headline.map((line) => (
              <span key={line} className={styles.headlineLine}>
                {line}
              </span>
            ))}
          </h2>

          <p className={styles.body}>
            {dark.body.map((line) => (
              <span key={line} className={styles.bodyLine}>
                {line}
              </span>
            ))}
          </p>
        </div>
      </div>
    </section>
  );
}
