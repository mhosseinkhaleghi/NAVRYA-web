import { notFound } from "next/navigation";

import { Hero } from "@/components/hero/Hero";
import { Stage } from "@/components/frame/Stage";
import { SiteHeader } from "@/components/site/SiteHeader";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = await getDictionary(locale);

  return (
    <Stage>
      <SiteHeader locale={locale} dictionary={dictionary} active="home" />
      <Hero dictionary={dictionary} />
    </Stage>
  );
}
