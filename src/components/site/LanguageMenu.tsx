import Link from "next/link";

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

      <div className={styles.panel}>
        {locales.map((option) => (
          <Link
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
          </Link>
        ))}
      </div>
    </details>
  );
}
