import type { Locale } from "@/i18n/config";

/**
 * The pages this site has, and where each one lives in a given locale.
 *
 * One table, because two things need the same answer and they used to disagree.
 * The bar asks "where does the features page live?" to build its nav; the
 * language menu asks "where does *this* page live in Turkish?" to switch
 * language. The menu had no table of its own and answered with `/tr` every
 * time, which is why changing language on the features page dropped the reader
 * back onto the home page — the route was simply thrown away.
 *
 * A key that is absent has no page yet. Those nav items render as inert buttons
 * rather than links, and the language menu falls back to the locale's home
 * page, because that is the only address it can honestly offer. As each page
 * lands it joins this table and both behaviours follow from the same line.
 */
export type RouteKey = "home" | "feature" | "psychology" | "pricing" | "academy";

export const ROUTE_HREF: Partial<Record<RouteKey, (locale: Locale) => string>> = {
  home: (locale) => `/${locale}`,
  feature: (locale) => `/${locale}/feature`,
};

/**
 * The same page in another locale, for the language menu.
 *
 * Falls back to that locale's home page for a route with no entry above — a
 * language the reader picked must always go somewhere real.
 */
export function localeHref(route: RouteKey, locale: Locale): string {
  const href = ROUTE_HREF[route];
  return href ? href(locale) : `/${locale}`;
}
