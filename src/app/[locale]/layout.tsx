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

  return (
    <html lang={locale} dir={getDirection(locale as Locale)}>
      <body>
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
