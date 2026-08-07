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
 *           the frame comes to rest on black.
 *   miss    a different morning. The arrow is already buried in the tree, and
 *           the deer it was meant for runs out of frame.
 *
 * The last handover is the only one that is not a cut. Every other pair is two
 * pieces of one continuous render; these two are a black studio frame and a
 * forest at dawn, with nothing continuous between them, so that one dips
 * through black — which is also what the scene asks for.
 *
 * The clips were rendered as one continuous shot and cut into pieces, so each
 * plate's closing frame *is* the next plate's opening frame. Handovers are
 * therefore cuts, and exactly one plate is composited at a time — see the note
 * on `PLATES` in `stage-script.ts`.
 *
 * Only the first plate plays; every other one is scrubbed by scroll position.
 *
 * Every plate leads with WebM. That used to be true only of the played plate —
 * H.264 beat VP9 on the scrubbed ones while they carried a keyframe every 6
 * frames, because a GOP that short is nearly all intra. At the 12-frame GOP they
 * ship with now VP9 is smaller on all of them, by 30-35%. MP4 stays behind it as
 * the fallback: a browser that can decode both takes the smaller file, and one
 * that cannot falls through.
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
  { id: "turn", slug: "hunter-turn", lead: false, codecs: ["webm", "mp4"] },
  { id: "prey", slug: "valley-prey", lead: false, codecs: ["webm", "mp4"] },
  { id: "draw", slug: "hunter-draw", lead: false, codecs: ["webm", "mp4"] },
  { id: "strike", slug: "hunter-strike", lead: false, codecs: ["webm", "mp4"] },
  { id: "arrow", slug: "arrow-learns", lead: false, codecs: ["webm", "mp4"] },
  { id: "miss", slug: "forest-miss", lead: false, codecs: ["webm", "mp4"] },
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
