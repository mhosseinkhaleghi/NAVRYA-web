import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";

import { introScript } from "@/components/frame/intro-script";
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
        {/* Runs before the composition is painted, so the intro can hold it
         * back without it flashing on screen first. */}
        <script dangerouslySetInnerHTML={{ __html: introScript }} />
        {children}
      </body>
    </html>
  );
}
