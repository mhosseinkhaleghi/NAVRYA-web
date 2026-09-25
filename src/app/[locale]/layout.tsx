import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";

import { stageScript } from "@/components/frame/stage-script";
import { orbScript } from "@/components/orb/orb-script";
import { getDirection, isLocale, locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

import "../globals.css";

/**
 * The page's own name, in the reader's own language.
 *
 * This was one hardcoded English pair for all five locales, so a Turkish reader
 * got a Turkish page in a browser tab that said "Become the Hunter." — and a
 * shared link, a bookmark and a search result said it too, which are the three
 * places the title is the *only* thing anyone sees.
 *
 * Built from the dictionary rather than written out again. The opening's
 * headline and sub-headline are already this page's title and description in
 * every language and are already translated; restating them here would be five
 * more strings to keep in step, and they would drift the first time the copy
 * changed. `alternates` names the other five addresses so a search engine
 * offers a reader the one in their language instead of guessing.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const { hero } = await getDictionary(locale);

  return {
    title: `Navrya — ${hero.headline}`,
    description: hero.subline.join(" "),
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}`])),
    },
    openGraph: {
      title: `Navrya — ${hero.headline}`,
      description: hero.subline.join(" "),
      locale,
      type: "website",
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#030303",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * The faces the first screen is set in, fetched with the document instead of
 * after the stylesheet has been parsed and the text laid out.
 *
 * The opening is held until these arrive (for at most half a second — see
 * `FONT_WAIT_MS`), so a font discovered late is a headline that arrives late.
 * Cinzel sets the wordmark in every language and the Latin headlines; the
 * sub-headline is Satoshi's light weight, or Peyda wherever the script is
 * Arabic, which also carries the headline there. Nothing else is preloaded:
 * every other face is below the opening or a weight of the bar's buttons,
 * which are fixed-height and do not move when their face lands.
 */
const OPENING_FACES = {
  ltr: ["/fonts/cinzel-latin.woff2", "/fonts/satoshi/satoshi-300.woff2"],
  rtl: ["/fonts/cinzel-latin.woff2", "/fonts/brand/PeydaFaNumWeb-Regular.woff2"],
} as const;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dir = getDirection(locale as Locale);

  return (
    <html lang={locale} dir={dir}>
      <body>
        {/* React hoists these into <head>. */}
        {OPENING_FACES[dir].map((href) => (
          <link
            key={href}
            rel="preload"
            href={href}
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
          />
        ))}
        {/* Runs before the composition is painted, so the opening beat can
         * hold it back without it flashing on screen first. */}
        <script dangerouslySetInnerHTML={{ __html: stageScript }} />
        {/* Section 7's backdrop. Inline for the same reason the controller
         * is: no client bundle on this site, and the preview build drops
         * every `<script src>`. It compiles nothing until the controller
         * marks its host live, a beat ahead of the section. */}
        <script dangerouslySetInnerHTML={{ __html: orbScript }} />
        {children}
      </body>
    </html>
  );
}
