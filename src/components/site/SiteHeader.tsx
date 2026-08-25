import { APP_URL } from "@/config/site";
import { ROUTE_HREF, type RouteKey } from "@/config/routes";
import { type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

import { LanguageMenu } from "./LanguageMenu";
import { BrandMark } from "./BrandMark";

import styles from "./SiteHeader.module.css";

type NavKey = keyof Dictionary["nav"] & RouteKey;

/** Order is fixed by the design; labels come from the active dictionary. */
const NAV_KEYS: NavKey[] = ["home", "feature", "psychology", "pricing", "academy"];

/*
 * Which nav items have somewhere to go is `ROUTE_HREF`, shared with the
 * language menu — see the note there. The rest stay buttons: those pages do not
 * exist yet, and a control that is visibly inert is better than an
 * `<a href="#">` that silently does nothing.
 *
 * Plain anchors, not next/link: a client-side navigation swaps the markup
 * without reloading the document, and the stage controller is an inline script
 * that would never run again — the incoming page's plate would be a new element
 * nobody had started, and its opening would simply not play. Changing page here
 * is a change of document, exactly as changing language is.
 */

/**
 * The nav sits inside the fixed frame rather than on top of a scrolling page.
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
    <header className={styles.header} data-site-bar="">
      <div className={styles.brand}>
        <BrandMark className={styles.brandMark} />
        <span className={styles.wordmark}>Navrya</span>
        <span className={styles.brandNode} aria-hidden="true" />
      </div>

      <nav className={styles.nav} aria-label={a11y.primaryNav}>
        <ul className={styles.navList}>
          {NAV_KEYS.map((key) => (
            <li key={key} className={styles.navItem}>
              {ROUTE_HREF[key] ? (
                <a
                  href={ROUTE_HREF[key]!(locale)}
                  className={styles.navLink}
                  {...(key === active ? { "aria-current": "page" as const } : {})}
                >
                  {nav[key]}
                </a>
              ) : (
                <button
                  type="button"
                  className={styles.navLink}
                  {...(key === active ? { "aria-current": "page" as const } : {})}
                >
                  {nav[key]}
                </button>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <div className={styles.controls}>
        <span className={styles.divider} aria-hidden="true" />

        <LanguageMenu locale={locale} dictionary={dictionary} route={active} />

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
