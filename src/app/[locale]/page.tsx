import { notFound } from "next/navigation";

import { ArrowSection } from "@/components/arrow/ArrowSection";
import { Hero } from "@/components/hero/Hero";
import { MissSection } from "@/components/miss/MissSection";
import { Scene } from "@/components/frame/Scene";
import { Stage } from "@/components/frame/Stage";
import { PanelSection } from "@/components/panel/PanelSection";
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
      <Scene />
      <SiteHeader locale={locale} dictionary={dictionary} active="home" />
      <Hero dictionary={dictionary} />
      {dictionary.panels.map((panel, index) => (
        <PanelSection
          key={panel.eyebrow}
          id={`p${index + 1}`}
          panel={panel}
          scrollLabel={dictionary.hero.scroll}
        />
      ))}
      <ArrowSection closing={dictionary.closing} />
      <MissSection miss={dictionary.miss} />
    </Stage>
  );
}
