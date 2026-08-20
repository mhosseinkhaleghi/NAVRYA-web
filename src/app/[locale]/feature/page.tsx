import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Hero } from "@/components/hero/Hero";
import { Scene } from "@/components/frame/Scene";
import { Stage } from "@/components/frame/Stage";
import { SiteHeader } from "@/components/site/SiteHeader";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

import slide from "@/components/feature/FeatureSlide.module.css";

/**
 * The features page.
 *
 * It opens exactly as the home page opens, and that is not a resemblance — it
 * is the same components and the same controller. The plate is fetched outright
 * and nothing competes with it, the interface is held back until the shot has
 * run its course, the words arrive on the frame the shot settles on, and the
 * scroll unlocks when it ends. None of that is written here; it is what `Stage`,
 * `Scene` and `Hero` already do, and this page is the second caller of each.
 *
 * One slide so far. `trackVh` is the length of the film that exists — the
 * controller's beat table is the home page's sequence, and without this the
 * page would hang four thousand vh of empty track under a single shot. 380vh
 * is the same allowance the sequence gives a five-second plate, so the opening
 * scrolls at the pace every other five-second shot on the site scrolls at.
 */

export const metadata: Metadata = {
  title: "Navrya — A Commander Starts With Clarity.",
  description:
    "Just like a commander on the battlefield, a trader begins the day with data, probabilities, threats, and decisions.",
};

/** The one plate, on the same terms as the home page's opening. */
const PLATES = [
  { id: "commander", slug: "commander-clarity", lead: true, codecs: ["webm", "mp4"] },
] as const;

export default async function FeaturePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = await getDictionary(locale);

  return (
    <Stage
      trackVh={380}
      chrome={<SiteHeader locale={locale} dictionary={dictionary} active="feature" />}
    >
      <Scene plates={PLATES} />
      <Hero
        dictionary={dictionary}
        copy={{ ...dictionary.feature, scroll: dictionary.hero.scroll }}
        actions={false}
        className={slide.slide}
      />
    </Stage>
  );
}
