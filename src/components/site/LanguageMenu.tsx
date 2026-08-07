import { ChevronDownIcon } from "@/components/icons/ChevronDownIcon";
import { GlobeIcon } from "@/components/icons/GlobeIcon";
import {
  locales,
  localeName,
  localeShortLabel,
  type Locale,
} from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

import styles from "./LanguageMenu.module.css";

export function LanguageMenu({
  locale,
  dictionary,
}: {
  locale: Locale;
  dictionary: Dictionary;
}) {
  return (
    <details className={styles.menu} data-language-menu="">
      <summary className={styles.trigger} aria-label={dictionary.actions.language}>
        <GlobeIcon className={styles.globe} />
        <span className={styles.code}>{localeShortLabel[locale]}</span>
        <ChevronDownIcon className={styles.chevron} />
      </summary>

      {/*
       * Plain anchors, deliberately — not next/link.
       *
       * A client-side navigation swaps the markup without reloading the
       * document, so the stage controller, which is an inline script, never
       * runs again. The <html> attributes it owns get dropped by the re-render,
       * the incoming locale's plates are brand new elements nobody has started,
       * and the previous page's controller is left holding references to a DOM
       * that no longer exists — the sequence simply stops.
       *
       * Changing language is a change of document here, and the whole film
       * plays again from its first frame. That is the behaviour, so this has to
       * be a real navigation.
       */}
      <div className={styles.panel}>
        {locales.map((option) => (
          <a
            key={option}
            href={`/${option}`}
            hrefLang={option}
            className={styles.option}
            {...(option === locale ? { "aria-current": "true" as const } : {})}
          >
            {/* Each language is named in its own language, in its own script. */}
            <span className={styles.name} lang={option}>
              {localeName[option]}
            </span>
            <span className={styles.optionCode}>{localeShortLabel[option]}</span>
          </a>
        ))}
      </div>
    </details>
  );
}
