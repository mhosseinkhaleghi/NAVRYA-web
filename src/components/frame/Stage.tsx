import type { CSSProperties, ReactNode } from "react";

import styles from "./Stage.module.css";

/**
 * The film, and the ordinary document that follows it.
 *
 * The film is a tall block with a sticky screen inside it. The screen pins
 * itself for exactly as long as the block lasts and then lets go, so the
 * sections after it are plain siblings in normal flow — no pinned layer for
 * them to be stacked over, no z-index deciding who is on top, nothing but a
 * page.
 *
 * It used to be a fixed full-screen stage, a tall empty spacer to scroll
 * through, and a separate layer above both holding everything after the film.
 * That works, and it is the arrangement four rounds of "the wheel does nothing
 * past section 7" were fought inside. A fixed element does not belong to the
 * scroll it is driven by; a sticky one does. Everything below the film is now
 * reached the way anything on any page is reached, which is what was asked for
 * and is one fewer thing that can behave differently inside an embed.
 */
export function Stage({
  children,
  after,
  chrome,
  character,
  sequence,
}: {
  children: ReactNode;
  after?: ReactNode;
  chrome?: ReactNode;
  /**
   * A character skin for the whole page, when the page belongs to one.
   *
   * The palette carries four and the marketing site runs none of them by
   * default — it is on the neutral gold skin, and every surface that paints a
   * ground reads `--char-atmosphere`, whose default *is* the page void. So
   * naming a skin here re-grounds the entire route and leaving it off changes
   * nothing anywhere.
   *
   * It goes on the three elements this renders rather than on one wrapper
   * around them: the film's block and everything after it are the whole of the
   * document flow, and the chrome is a fixed overlay beside them rather than
   * inside them — so it needs telling separately, or the bar would resolve the
   * token at `:root` and paint the page void over a page that is not it. A
   * wrapper would be a fourth element existing only to carry an attribute.
   */
  character?: string;
  /**
   * This page's film, when it is not the home page's.
   *
   * The controller carries the home sequence and sums its beats for the track's
   * height. A page with a film of its own hands the four tables over here and
   * the controller reads those instead — same mechanism, same rules, its own
   * shots. Omit on the home page.
   *
   *   beats        [name, vh][] — the order of the film and how much scroll
   *                each shot gets. Their sum is the track's height.
   *   beatSeconds  [name, seconds][] — real durations, so a magnetic step plays
   *                a shot at its own speed rather than at a scroll rate.
   *   plates       the plate ids, in the order they are composited.
   *   plateBeat    the beat each plate takes over on; null for the lead.
   *   scenes       which plate scrubs on which beat, and the panel it reveals.
   *   heroExit     when the opening copy leaves, as a fraction of the first
   *                beat. Optional: the home film's window is the default, and
   *                it suits a first beat that is a three-second shot. A film
   *                whose first beat is most of its length needs its own.
   */
  sequence?: {
    beats: readonly (readonly [string, number])[];
    beatSeconds: readonly (readonly [string, number])[];
    plates: readonly string[];
    plateBeat: readonly (string | null)[];
    heroExit?: readonly [number, number];
    scenes: readonly {
      plate: string;
      beat: string;
      panel: string | null;
      exit: readonly [string, number, number] | null;
      cues: readonly [number, number] | null;
      /**
       * Fraction of this scene's beat over which its plate fades up from the
       * one before, instead of cutting.
       *
       * An exception, and it has to be asked for. Plates cut because they are
       * pieces of one render and the two frames either side of a handover are
       * the same frame — dissolving there would show one figure twice. Set this
       * only where that is untrue and the cut is a real jump between different
       * pictures.
       */
      dissolve?: number;
    }[];
  };
}) {
  return (
    <>
      {/*
       * The block is the timeline's length; the screen inside it is what the
       * viewer looks at. `data-track` stays on the block, because the length of
       * the block is still exactly what the controller measures the scroll
       * against — the mechanism above it is unchanged.
       */}
      <div
        className={styles.film}
        data-track=""
        {...(character ? { "data-character": character } : {})}
        {...(sequence
          ? {
              /*
               * The height, in the served HTML.
               *
               * The controller resolves this too, but it cannot do it before
               * first paint: it is the first thing in the body precisely so it
               * can hold the interface back, which is before this element has
               * been parsed. Stating the total here means the track is the right
               * height in the markup and nothing shifts when the script catches
               * up — the two agree because both are this table.
               */
              style: {
                "--timeline-vh": sequence.beats.reduce((n, b) => n + b[1], 0),
              } as CSSProperties,
              "data-beats": JSON.stringify(sequence.beats),
              "data-beat-seconds": JSON.stringify(sequence.beatSeconds),
              "data-plates": JSON.stringify(sequence.plates),
              "data-plate-beat": JSON.stringify(sequence.plateBeat),
              "data-scenes": JSON.stringify(sequence.scenes),
              ...(sequence.heroExit
                ? { "data-hero-exit": JSON.stringify(sequence.heroExit) }
                : {}),
            }
          : {})}
      >
        <div className={styles.stage}>
          {/*
           * On compact frames the bar is a row of the stage rather than an
           * overlay, and the scenes below it are grid items that rely on row one
           * being the bar's height. The bar itself now lives in `chrome`, above
           * the document — so this holds its place. Desktop scenes are absolute
           * and reserve `--header-h` themselves, so it is not needed there.
           */}
          <div className={styles.band} aria-hidden="true" />
          {children}
        </div>
      </div>
      {after ? (
        <div
          className={styles.flow}
          {...(character ? { "data-character": character } : {})}
        >
          {after}
        </div>
      ) : null}
      {/*
       * The bar and the rail sit above everything, film and document alike.
       * They cannot stay inside the stage: it is a stacking context of its own,
       * so anything in it is trapped below the flow that scrolls over it.
       */}
      {chrome ? (
        <div
          className={styles.chrome}
          {...(character ? { "data-character": character } : {})}
        >
          {chrome}
        </div>
      ) : null}
    </>
  );
}
