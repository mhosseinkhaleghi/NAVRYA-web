import { APP_URL } from "@/config/site";
import { type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

import { LanguageMenu } from "./LanguageMenu";
import { BrandMark } from "./BrandMark";

import styles from "./SiteHeader.module.css";

type NavKey = keyof Dictionary["nav"];

/** Order is fixed by the design; labels come from the active dictionary. */
const NAV_KEYS: NavKey[] = ["home", "feature", "psychology", "pricing", "academy"];

/**
 * The nav sits inside the fixed frame rather than on top of a scrolling page.
 * Items are buttons because they will switch scenes within the frame, not
 * navigate to separate documents — the wiring lands with the later sections.
 */
export function SiteHeader({
  locale,
  dictionary,
  active = "home",
}: {
  locale: Locale;
  dictionary: Dictionary;
  active?: NavKey;
}) {
  const { nav, actions, a11y } = dictionary;

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <BrandMark className={styles.brandMark} />
        <span className={styles.wordmark}>Navrya</span>
        <span className={styles.brandNode} aria-hidden="true" />
      </div>

      <nav className={styles.nav} aria-label={a11y.primaryNav}>
        <ul className={styles.navList}>
          {NAV_KEYS.map((key) => (
            <li key={key} className={styles.navItem}>
              <button
                type="button"
                className={styles.navLink}
                {...(key === active ? { "aria-current": "page" as const } : {})}
              >
                {nav[key]}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className={styles.controls}>
        <span className={styles.divider} aria-hidden="true" />

        <LanguageMenu locale={locale} dictionary={dictionary} />

        {/* Login leaves this site for the product, so it is a link and not a
          * button: it should middle-click, ctrl-click and copy-link like every
          * other address on the web. */}
        <a className={styles.login} href={APP_URL} data-login="">
          {actions.login}
        </a>
      </div>

      <span className={styles.rule} aria-hidden="true" />
    </header>
  );
}
