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
