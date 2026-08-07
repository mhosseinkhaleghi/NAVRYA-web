/**
 * The five languages Navrya ships in.
 *
 * `dir` drives the `dir` attribute on <html>, which in turn flips every
 * logical CSS property in the layout. Nothing in the UI hard-codes left/right.
 */
export const locales = ["en", "tr", "fa", "ar", "es"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeDirection: Record<Locale, "ltr" | "rtl"> = {
  en: "ltr",
  tr: "ltr",
  fa: "rtl",
  ar: "rtl",
  es: "ltr",
};

/** Shown in the header language control. */
export const localeShortLabel: Record<Locale, string> = {
  en: "EN",
  tr: "TR",
  fa: "FA",
  ar: "AR",
  es: "ES",
};

/** Endonyms — used for `hreflang`/`lang` metadata and future language UI. */
export const localeName: Record<Locale, string> = {
  en: "English",
  tr: "Türkçe",
  fa: "فارسی",
  ar: "العربية",
  es: "Español",
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export function getDirection(locale: Locale) {
  return localeDirection[locale];
}
