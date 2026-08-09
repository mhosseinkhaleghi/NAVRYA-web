import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";

import { stageScript } from "@/components/frame/stage-script";
import { orbScript } from "@/components/orb/orb-script";
import { getDirection, isLocale, locales, type Locale } from "@/i18n/config";

import "../globals.css";

export const metadata: Metadata = {
  title: "Navrya — Become the Hunter.",
  description:
    "The market doesn’t pay those who chase every move. It rewards those who wait for the perfect prey.",
};

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
      <head>
        {/*
         * The first thing on screen is the opening plate's first frame, and it
         * cannot start downloading until the stylesheet that references it has
         * parsed. Naming it here starts the fetch with the document instead.
         */}
        <link
          rel="preload"
          as="image"
          href="/scene/hunter-dawn-first.jpg"
          fetchPriority="high"
        />
        {/* The plate itself is not preloaded here. A media element fetches with
         * range requests and will not always reuse a `rel=preload` entry, so
         * the hint can cost a second full download of the one file the opening
         * beat is waiting on. `preload="auto"` on the element itself starts the
         * fetch a few milliseconds later and only once, and nothing competes
         * with it: every other plate is `preload="none"` until the controller
         * asks for it. */}
      </head>
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
