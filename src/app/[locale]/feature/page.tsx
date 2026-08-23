import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FeaturePanel } from "@/components/feature/FeaturePanel";
import { MapNotes } from "@/components/feature/MapNotes";
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
       * identical one. It leaves on the fourth beat, because slide 4 is a
       * different subject in a different room and the battlefield's title has
       * no business over it.
       */
      exit: ["council", 0, 0.2],
      cues: [0.45, 0.85],
    },
    {
      plate: "scatter",
      beat: "scatter",
      panel: "f3",
      /*
       * Everything on this slide is one staggered arrival, so it is all in the
       * `rest` group and `cues[0]` drives nothing — there is no title here, the
       * headline above belongs to the scene before. The eight callouts arrive in
       * turn and then the sentence they add up to, the stagger completing at
       * `cues[1] + REST_SPAN`.
       *
       * That sum has to land *inside* this beat, not at the end of it. At 0.85
       * it came to exactly 1.0 — the boundary where the next plate takes the
       * frame — so the slide came to rest on the first frame of the dive with
       * its labels pinned over it, naming a map that was no longer there. It
       * was right while this was the last slide and the end of the beat was the
       * foot of the document; adding a fourth made the same number wrong.
       *
       * 0.72 rests at 0.87 of the beat: the shot is settled, the map is under
       * the words that name it, and the last eighth is a hold to read it in
       * before the camera leaves.
       */
      cues: [0.05, 0.72],
      /*
       * Slide 3 leaves inside its own beat, over the map it is naming.
       *
       * Every other handover on this site leaves *over* the following shot
       * rather than against a frozen frame, and that was tried here twice. Over
       * 22% of the next beat the eight labels sat sharp and still on top of a
       * picture in full motion. Cut to 10% they no longer sat there going
       * forward — but a window is a position, not a direction, and scrolling
       * back through it fades them *in* over that same moving picture. Caught on
       * the way back from slide 4: the headline arrived at full opacity with the
       * dive still blurring past underneath it, before the map had returned.
       *
       * So it belongs before the boundary, not after. The stagger completes at
       * `cues[1] + REST_SPAN` = 0.87 and the exit runs from there to the end of
       * the beat, which means the words only ever exist while the map is on
       * screen — leaving over it going forward, arriving over it coming back.
       * It costs the eighth of a beat that used to be a hold to read the
       * sentence in; the sentence is legible for the whole of the stagger before
       * it, and a hold that can only be spent going one direction was not worth
       * a handover that was wrong going the other.
       */
      exit: ["scatter", 0.87, 1],
    },
    {
      plate: "council",
      beat: "council",
      panel: "f4",
      exit: null,
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
      <MapNotes
        id="f3"
        notes={dictionary.feature.scatter.notes}
        closing={dictionary.feature.scatter.closing}
      />
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
