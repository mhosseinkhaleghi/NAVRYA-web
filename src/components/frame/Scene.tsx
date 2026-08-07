import styles from "./Scene.module.css";

/**
 * The backdrop of the frame: six plates that chain into one continuous shot.
 *
 *   dawn    the hunter turns to face the viewer. Plays on load — this is the
 *           opening beat, and the only plate the viewer does not drive.
 *   turn    he turns back to the valley.
 *   prey    the deer walks in and settles to graze.
 *   draw    he raises the bow and draws.
 *   strike  the camera pushes in to the draw, held at full tension.
 *   arrow   the release. The arrow flies, the world falls away behind it, and
 *           the frame comes to rest on black. Plays rather than scrubs.
 *
 * The clips were rendered as one continuous shot and cut into pieces, so each
 * plate's closing frame *is* the next plate's opening frame. Handovers are
 * therefore cuts, and exactly one plate is composited at a time — see the note
 * on `PLATES` in `stage-script.ts`.
 *
 * Codec order is per plate, not global. A long GOP compresses better in VP9 and
 * a short one better in H.264, so the two played plates lead with WebM and the
 * scrubbed plates lead with MP4 — a browser that can decode both always takes
 * the smaller file, and one that cannot falls through to the other.
 *
 * Nothing carries `autoplay`. The controller starts the opening plate once
 * enough of it has buffered to run the beat without stalling: autoplay begins
 * at `canplay`, which promises exactly one more frame, and the hitch that
 * follows is what made the opening look broken. Every plate after the first is
 * `preload="none"` and is fetched a beat ahead of where the viewer is, so a
 * viewer who never scrolls past the hero downloads exactly one video.
 *
 * `prefers-reduced-motion: no-preference` on every source means a viewer who
 * asks for less motion matches *no* source at all — nothing downloads, and the
 * stills carry the sequence.
 */

const PLATES = [
  { id: "dawn", slug: "hunter-dawn", lead: true, codecs: ["webm", "mp4"] },
  { id: "turn", slug: "hunter-turn", lead: false, codecs: ["mp4", "webm"] },
  { id: "prey", slug: "valley-prey", lead: false, codecs: ["mp4", "webm"] },
  { id: "draw", slug: "hunter-draw", lead: false, codecs: ["mp4", "webm"] },
  { id: "strike", slug: "hunter-strike", lead: false, codecs: ["mp4", "webm"] },
  { id: "arrow", slug: "arrow-learns", lead: false, codecs: ["webm", "mp4"] },
] as const;

const MIME = { webm: "video/webm", mp4: "video/mp4" } as const;

export function Scene() {
  return (
    <div className={styles.scene} aria-hidden="true">
      {PLATES.map(({ id, slug, lead, codecs }) => (
        <div
          key={id}
          className={styles.plate}
          data-plate-id={id}
          {...(lead ? { "data-plate-on": "", style: { "--o": 1 } as React.CSSProperties } : {})}
        >
          <div
            className={styles.still}
            style={
              {
                "--still-first": `url("/scene/${slug}-first.jpg")`,
                "--still-last": `url("/scene/${slug}-last.jpg")`,
              } as React.CSSProperties
            }
          />

          <video
            className={styles.video}
            data-scene-video={id}
            preload={lead ? "auto" : "none"}
            muted
            playsInline
            tabIndex={-1}
          >
            {(["1080", "720"] as const).flatMap((size) =>
              codecs.map((codec) => (
                <source
                  key={`${size}-${codec}`}
                  src={`/scene/${slug}-${size}.${codec}`}
                  type={MIME[codec]}
                  media={
                    size === "1080"
                      ? "(min-width: 768px) and (prefers-reduced-motion: no-preference)"
                      : "(prefers-reduced-motion: no-preference)"
                  }
                />
              )),
            )}
          </video>
        </div>
      ))}
    </div>
  );
}
