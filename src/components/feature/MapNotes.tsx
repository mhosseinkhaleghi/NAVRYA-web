import styles from "./MapNotes.module.css";

/**
 * The features page's third slide: the map, named.
 *
 * The shot is a continuation of slide 2's — measured, the map's closing frame
 * and this plate's opening frame differ on 0.04% of pixels by more than 12/255,
 * so the handover is a cut nobody can see. What changes is not the picture but
 * what is written on it: eight things a trader already has, each pinned to the
 * place on the map that stands for it, and then the sentence those eight are an
 * argument for.
 *
 * Everything here is real text and real vector, not pixels baked into the
 * plate, and that is the whole reason it is a component instead of a second
 * render of the video. Five languages, two of them right-to-left, would be five
 * renders otherwise — and Cinzel at this size is exactly the kind of thin serif
 * a video codec turns to mush. It is also selectable, readable by a screen
 * reader, and indexed.
 *
 * Driven by the controller like every other panel: `--r` arrives on the reveal
 * groups as the shot beneath scrubs, `--exit` takes the slide away. Nothing in
 * here listens to the scroll.
 */

/**
 * Where each note points, and where its label sits, as percentages of the
 * plate's own 16:9 frame.
 *
 * Measured off the footage rather than placed by eye: the settled frame was
 * sampled for ember clusters — the lit fortresses and the marching columns are
 * the only bright warm things on a black map — and each label is anchored to
 * the one it names. `x`/`y` is the point on the map; `lx`/`ly` is where the
 * words sit. The elbow between them is derived, not authored.
 *
 * Because these are percentages of the *plate* and not of the viewport, they
 * hold wherever the plate is letterboxed — which is what `.stage` below exists
 * to reproduce.
 */
type Note = {
  key: "price" | "sessions" | "timeframes" | "setups" | "emotions" | "execution" | "risk" | "history";
  /** The point on the map, in percent. */
  x: number;
  y: number;
  /** The label's anchor, in percent. */
  lx: number;
  ly: number;
  /** Which side of its anchor the label reads from. */
  side: "start" | "end";
};

const NOTES: readonly Note[] = [
  { key: "price", x: 19.9, y: 38.9, lx: 25.5, ly: 28.0, side: "start" },
  { key: "sessions", x: 43.0, y: 33.5, lx: 40.5, ly: 22.5, side: "start" },
  { key: "timeframes", x: 30.5, y: 49.8, lx: 23.5, ly: 40.5, side: "start" },
  { key: "setups", x: 83.9, y: 33.8, lx: 66.0, ly: 26.5, side: "start" },
  { key: "risk", x: 73.6, y: 47.7, lx: 81.5, ly: 40.0, side: "start" },
  { key: "emotions", x: 21.2, y: 66.8, lx: 17.5, ly: 56.5, side: "start" },
  { key: "execution", x: 49.0, y: 66.5, lx: 43.5, ly: 58.5, side: "start" },
  { key: "history", x: 81.2, y: 69.7, lx: 68.5, ly: 62.0, side: "start" },
];

/** The plate's own frame, so the drawing and the labels share one coordinate. */
const VB_W = 1920;
const VB_H = 1080;

const pt = (px: number, py: number) => [(px / 100) * VB_W, (py / 100) * VB_H] as const;

/**
 * The leader from a label to the thing it names.
 *
 * Two segments, not one: a short run along the baseline of the words, then the
 * turn to the target. A single diagonal from text to map reads as a scratch
 * across the picture; the elbow is what makes it read as a callout.
 */
function leader(n: Note) {
  const [tx, ty] = pt(n.x, n.y);
  const [lx, ly] = pt(n.lx, n.ly);
  const run = (tx > lx ? 1 : -1) * Math.min(Math.abs(tx - lx) * 0.45, VB_W * 0.045);
  const ex = lx + run;
  return `M${lx.toFixed(1)} ${ly.toFixed(1)}H${ex.toFixed(1)}L${tx.toFixed(1)} ${ty.toFixed(1)}`;
}

export function MapNotes({
  id,
  notes,
  closing,
}: {
  id: string;
  notes: Record<string, string>;
  closing: readonly string[];
}) {
  return (
    <section className={styles.panel} data-panel={id}>
      {/*
       * The box the plate is actually painted into.
       *
       * The scene video is `object-fit: contain`, so on any frame wider than
       * 16:9 the picture is letterboxed and its edges are nowhere near the
       * viewport's. A label placed at "20% of the screen" would drift off the
       * fortress it names on every viewport but the one it was set on. This
       * element reproduces `contain` exactly — 16:9, capped by both axes,
       * centred — so a percentage here is a percentage of the *picture*.
       */}
      <div className={styles.stage}>
        <svg
          className={styles.leaders}
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          fill="none"
          aria-hidden="true"
        >
          {NOTES.map((n, i) => {
            const [tx, ty] = pt(n.x, n.y);
            return (
              <g
                key={n.key}
                className={styles.leaderGroup}
                data-reveal-group="rest"
                data-reveal-step={i}
              >
                <path className={styles.leaderLine} d={leader(n)} pathLength={1} />
                {/* The node on the target — the site's diamond, at the place
                    the words are about. */}
                <rect
                  className={styles.leaderNode}
                  x={tx - 9}
                  y={ty - 9}
                  width={18}
                  height={18}
                  transform={`rotate(45 ${tx} ${ty})`}
                />
              </g>
            );
          })}
        </svg>

        {NOTES.map((n, i) => (
          <span
            key={n.key}
            className={styles.note}
            data-side={n.side}
            data-reveal-group="rest"
            data-reveal-step={i}
            style={{ "--nx": `${n.lx}%`, "--ny": `${n.ly}%` } as React.CSSProperties}
          >
            {notes[n.key]}
          </span>
        ))}

      </div>

      {/*
       * The sentence the eight labels are an argument for, and the last thing
       * to arrive — so it lands on a map the reader has just finished reading.
       * Its second line is gold, which is the one emphasis this slide makes.
       *
       * Panel space, like the frame: it is set inside the border, above the
       * foot medallion, and it belongs to the page rather than to a point on
       * the map.
       */}
      <p
        className={styles.closing}
        data-reveal-group="rest"
        data-reveal-step={NOTES.length}
      >
        {closing.map((line, i) => (
          <span key={line} className={i === closing.length - 1 ? styles.closingLead : undefined}>
            {line}
          </span>
        ))}
      </p>
    </section>
  );
}
