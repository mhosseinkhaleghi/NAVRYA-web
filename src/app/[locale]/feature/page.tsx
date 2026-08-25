import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FeaturePanel } from "@/components/feature/FeaturePanel";
import { MapNotes } from "@/components/feature/MapNotes";
import { CouncilPanel } from "@/components/feature/CouncilPanel";
import { ScenarioSection } from "@/components/feature/ScenarioSection";
import { SessionSection } from "@/components/feature/SessionSection";
import { SiteFooter } from "@/components/footer/SiteFooter";
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
  /*
   * `desk` is a continuation, and measurably so: slide 4's closing frame and
   * this one's opening frame come out at SSIM 0.968 against each other. The
   * camera has arrived and simply keeps drifting, so the handover is a cut on
   * the same picture — the rule every plate change here follows, and the reason
   * this one needs no dissolve where the map-to-dive jump did.
   */
  { id: "desk", slug: "commander-desk", lead: false, codecs: ["webm", "mp4"] },
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
    /*
     * 3.04s at this page's rate of 380vh per five seconds is 231, rounded to
     * 230 — the same arithmetic slide 3 gets, so the film does not change pace
     * at the seam.
     */
    ["desk", 230],
  ],
  beatSeconds: [
    ["battlemap", 5.041667],
    ["scatter", 0.875],
    ["council", 2.1256],
    ["desk", 3.042],
  ],
  plates: ["commander", "battlemap", "scatter", "council", "desk"],
  plateBeat: [null, "battlemap", "scatter", "council", "desk"],
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
      /*
       * It leaves over the shot that follows, which is the arrangement every
       * handover on this site prefers and which slide 3 could not have: the
       * desk plate is this room still drifting, not a different picture, so
       * text over its opening is text over the same place. That is what makes a
       * long window safe here — 18% of the next beat is about half a second,
       * and the same half second reads correctly scrolling back through it.
       */
      exit: ["desk", 0, 0.18],
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
       * about two thirds — and the rest of the block follows it.
       *
       * `cues[1]` is 0.80 and not 0.85 because a fifth slide arrived. At 0.85
       * the stop came to `cues[1] + REST_SPAN` = 1.0 exactly, which was right
       * while this was the last scene and the end of its beat was the foot of
       * the page — and becomes a stop sitting on a beat boundary the moment
       * anything follows it, which is the fault slide 3 had and the same
       * arithmetic. 0.80 rests at 0.95, inside its own shot.
       */
      cues: [0.62, 0.8],
    },
    {
      plate: "desk",
      beat: "desk",
      panel: "f5",
      exit: null,
      /*
       * The last scene, so `cues[1] + REST_SPAN` has to come to exactly 1.0:
       * the film's final magnetic stop is the foot of the document, and
       * anything short of it is scroll the wheel refuses to travel while the
       * scrollbar still says there is more.
       *
       * The head at 0.35 rather than the council's 0.62 because this shot has
       * nowhere to arrive — the camera is already in the room and only drifts,
       * so there is no settling to wait for. It reads as the words appearing
       * over a scene that was already there.
       */
      cues: [0.35, 0.85],
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
      /*
       * The whole page is the commander's.
       *
       * This is the one place the route's ground is named. `Stage` puts it on
       * the film's block and on the document after it — which between them are
       * the entire page — so the film's screen, both sections below it and the
       * footer all paint `--char-atmosphere`, and it is the commander's red
       * rather than the page void. Nothing else had to change: every one of
       * those surfaces already read that token, whose default is the void.
       */
      character="commander"
      sequence={SEQUENCE}
      chrome={<SiteHeader locale={locale} dictionary={dictionary} active="feature" />}
      /*
       * Below the film, and so not part of it.
       *
       * The sequence ends on the desk, and everything here is ordinary document
       * — no beat, no scrubbing, no magnetic stop. The last slide hands over to
       * plain scroll, which is the same arrangement the home page has had since
       * its own film stopped carrying the whole page.
       */
      after={
        <>
          <SessionSection session={dictionary.feature.session} />
          <ScenarioSection scenario={dictionary.feature.scenario} />
          <SiteFooter locale={locale} dictionary={dictionary} route="feature" />
        </>
      }
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
      {/*
       * The fifth slide is the fourth's composition again, over the same room a
       * few seconds later — so it is the same component with its own copy and
       * its own three marks, not a second implementation of one layout. If the
       * block ever needs to change, it changes once.
       */}
      <CouncilPanel
        id="f5"
        headline={dictionary.feature.desk.headline}
        subline={dictionary.feature.desk.subline}
        cta={dictionary.feature.desk.cta}
        pillars={dictionary.feature.desk.pillars}
      />
    </Stage>
  );
}
