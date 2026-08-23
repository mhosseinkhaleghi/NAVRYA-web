import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FeaturePanel } from "@/components/feature/FeaturePanel";
import { CouncilPanel } from "@/components/feature/CouncilPanel";
import { Hero } from "@/components/hero/Hero";
import { Scene } from "@/components/frame/Scene";
import { Stage } from "@/components/frame/Stage";
import { SiteHeader } from "@/components/site/SiteHeader";
import { isLocale, locales } from "@/i18n/config";
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
 * Two slides. The sequence below is this page's film, handed to the controller
 * the same way the home page's is built into it — same beats, same scrubbing,
 * same reveal, its own shots.
 *
 * 380vh per five-second plate is the allowance the home sequence gives one, so
 * both films scroll at the same rate and neither changes pace at a seam.
 */

/** This page's name, in the reader's own language — see the note in `layout`. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const { feature } = await getDictionary(locale);
  const title = `Navrya — ${feature.headline}`;
  const description = feature.subline.join(" ");

  return {
    title,
    description,
    alternates: {
      canonical: `/${locale}/feature`,
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}/feature`])),
    },
    openGraph: { title, description, locale, type: "website" },
  };
}

/**
 * The plates, on the same terms as the home page's.
 *
 * `scatter` is a continuation of `battlemap`, not a new shot: measured on the
 * encoded files, the map's closing frame and this one's opening frame differ by
 * more than 12/255 on 0.04% of pixels. So the handover is a cut on the same
 * frame, which is the rule every plate change on this site already follows —
 * exactly one plate is composited at a time and at the instant of the cut the
 * two frames are the same picture, so nothing moves.
 */
const PLATES = [
  { id: "commander", slug: "commander-clarity", lead: true, codecs: ["webm", "mp4"] },
  { id: "battlemap", slug: "commander-map", lead: false, codecs: ["webm", "mp4"] },
  { id: "scatter", slug: "commander-scatter", lead: false, codecs: ["webm", "mp4"] },
  /*
   * `council` is not a continuation but a journey: the camera leaves the map
   * from above, dives through it, and arrives in the room. The whole of that
   * move is the slide, which is why the plate is 2.21s of a three-second source
   * rather than the tail of it.
   *
   * It starts two frames later than the dive does, because the dive's own first
   * frame still carries one readable English callout: "Execution." sits nearest
   * the zoom axis, so it blurs least and outlives the other seven. Checked frame
   * by frame — legible at the first, gone by the third. Two frames is 0.08s of a
   * 2.2s move and takes nothing from it. The
   * magnetic step takes its length from the shot's own seconds, so restoring
   * the full dive is also what makes it play at the speed it was cut at.
   */
  { id: "council", slug: "commander-council", lead: false, codecs: ["webm", "mp4"] },
] as const;

/*
 * The film.
 *
 * The lead plate has no beat. It plays before the timeline unlocks and the
 * film starts on the shot after it, exactly as the home sequence does — its
 * table also begins on the second shot, not the first.
 *
 * Every number below is a fraction of the one shot this film currently is, and
 * they are read off the footage rather than chosen: the camera holds on the
 * commander for the first fifth, pushes down through the fifth and the third,
 * and the map is open from about half way.
 *
 *   heroExit  0.20 → 0.36  the opening leaves on the push, while the frame is
 *                          moving. It cannot use the home film's window: that
 *                          one is measured on a three-second first beat with
 *                          five more behind it, and here the first beat is the
 *                          whole film, so the same fractions would hold the
 *                          opening on screen past the point where this slide's
 *                          own headline has arrived underneath it.
 *   cues[0]   0.45         the head, over a map that has just opened out.
 *   cues[1]   0.85         the rule under it.
 *
 * The second cue is 0.85 and not a rounder number because `REST_SPAN` is 0.15:
 * the film rests where a panel has finished arriving, so a scene completing at
 * 0.85 + 0.15 rests exactly at the end of its own shot. On the *last* scene
 * that is also the foot of the page — any earlier and the wheel would stop at a
 * magnetic point with document still below it and no way to reach it.
 *
 * Slide 3 gets 230vh against slide 2's 380 because its shot is 3.04s against
 * 5.04s, and this page's rule is 380vh per five seconds — so both slides scroll
 * at the same rate and the film does not change pace at the cut.
 */
const SEQUENCE = {
  beats: [
    ["battlemap", 380],
    ["scatter", 230],
    ["council", 300],
  ],
  beatSeconds: [
    ["battlemap", 5.041667],
    ["scatter", 0.875],
    ["council", 2.1256],
  ],
  plates: ["commander", "battlemap", "scatter", "council"],
  plateBeat: [null, "battlemap", "scatter", "council"],
  heroExit: [0.2, 0.36],
  scenes: [
    {
      plate: "battlemap",
      beat: "battlemap",
      panel: "f2",
      /*
       * Slide 2's headline is slide 3's headline too — the map is named *under*
       * the sentence that introduced it, which is what the composition is — so
       * it stays up across that cut instead of leaving and being replaced by an
       * identical one. It leaves at the end of the map, because slide 4 is a
       * different subject in a different room and the battlefield's title has
       * no business over it.
       *
       * It left over the first fifth of the *next* beat until the dissolve made
       * that visible: at the film's own speed the title sat at half opacity over
       * the dive for a fifth of a second, and coming back it faded in there. The
       * same fault, and the same fix, as the callouts below it — the window
       * belongs before the boundary, not after, so both leave together over the
       * map they name and the camera dives on a clean frame.
       */
      exit: ["scatter", 0.87, 1],
      cues: [0.45, 0.85],
    },
    {
      plate: "scatter",
      beat: "scatter",
      /*
       * The map carries no words of its own any more.
       *
       * Eight callouts and a closing sentence used to be pinned over it in
       * HTML, translated per locale, because the footage has none burned in.
       * They are gone at the client's direction: what matters here is that the
       * camera leaves the map and arrives in the room as one movement, and text
       * anchored to points on a map is the thing that cannot survive the camera
       * moving. Their strings are still in the dictionaries under
       * `feature.scatter`, which is where they would be restored from.
       *
       * With no panel this scene contributes no magnetic stop — `filmStates`
       * takes stops from scenes that carry one — so the film no longer pauses
       * on a map with nothing to read. Slide 2 rests, and the next gesture
       * carries the whole descent through to the council table in one travel,
       * which is the smoothness that was asked for. The plate still scrubs on
       * its own beat: the map is passed through, not skipped.
       */
      panel: null,
      cues: null,
      exit: null,
    },
    {
      plate: "council",
      beat: "council",
      panel: "f4",
      exit: null,
      /*
       * The one handover on this film that is not a cut.
       *
       * Slide 3 rests on the wide, still map and this shot opens already deep
       * in the plunge — SSIM 0.194 between the two frames, which is not a
       * handover, it is a jump. The frames that would join them are the first
       * 22 of this plate's source, the camera gathering speed over the map, and
       * they carry burned-in English lettering that cannot ship in five
       * languages.
       *
       * A tenth of the beat, which at the film's own rate is about 210ms and
       * renders over a dozen frames — measured, because the number that matters
       * is not the fraction but how many frames the travel actually paints
       * inside it, and at six percent that was six. Long enough to read as the
       * camera taking off, short enough that the dive is still accelerating
       * when it lands: the incoming frames are heavily motion-blurred right
       * there, which is what lets a dissolve stand in for the movement that is
       * missing. Replace it with the real frames the moment a source without
       * the lettering exists; this is a repair, not a design.
       */
      dissolve: 0.1,
      /*
       * The head lands once the camera has stopped moving — the shot settles by
       * about two thirds — and the rest of the block follows it. The last stop
       * is `cues[1] + REST_SPAN`, which at 0.85 is the end of the shot and the
       * foot of the document.
       */
      cues: [0.62, 0.85],
    },
  ],
} as const;

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
      sequence={SEQUENCE}
      chrome={<SiteHeader locale={locale} dictionary={dictionary} active="feature" />}
    >
      <Scene plates={PLATES} />
      <Hero
        dictionary={dictionary}
        copy={{
          headline: dictionary.feature.headline,
          subline: dictionary.feature.subline,
          scroll: dictionary.hero.scroll,
        }}
        actions={false}
        className={slide.slide}
      />
      <FeaturePanel id="f2" headline={dictionary.feature.battlemap.headline} />
      <CouncilPanel
        id="f4"
        headline={dictionary.feature.council.headline}
        subline={dictionary.feature.council.subline}
        cta={dictionary.feature.council.cta}
        pillars={dictionary.feature.council.pillars}
      />
    </Stage>
  );
}
