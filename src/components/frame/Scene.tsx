import styles from "./Scene.module.css";

/**
 * The backdrop of the frame: five plates that chain into one continuous shot.
 *
 *   dawn    plays on load and holds its closing frame — the hunter turns to
 *           face the viewer. This is the only plate that plays itself.
 *   turn    he turns back to the valley.
 *   prey    the deer walks in and settles to graze.
 *   draw    he raises the bow and draws.
 *   strike  the camera pushes in to the draw, held at full tension.
 *
 * All but the first are scrubbed by scroll, and the handovers cross-dissolve
 * rather than cut — see the note in the stylesheet.
 *
 * Codec order is per plate, not global. A long GOP compresses better in VP9 and
 * a short one better in H.264, so the played plate leads with WebM and the
 * scrubbed plates lead with MP4 — a browser that can decode both always takes
 * the smaller file, and one that cannot falls through to the other.
 *
 * Every plate after the first carries `preload="none"`. The controller loads
 * them one beat ahead of where the viewer is, so nothing competes with the
 * plate that is actually on screen and a viewer who never scrolls past the
 * hero downloads exactly one video.
 *
 * `prefers-reduced-motion: no-preference` on every source means a viewer who
 * asks for less motion matches *no* source at all — nothing downloads, and the
 * stills carry the sequence.
 */

const PLATES = [
  { id: "dawn", slug: "hunter-dawn", plays: true, codecs: ["webm", "mp4"] },
  { id: "turn", slug: "hunter-turn", plays: false, codecs: ["mp4", "webm"] },
  { id: "prey", slug: "valley-prey", plays: false, codecs: ["mp4", "webm"] },
  { id: "draw", slug: "hunter-draw", plays: false, codecs: ["mp4", "webm"] },
  { id: "strike", slug: "hunter-strike", plays: false, codecs: ["mp4", "webm"] },
] as const;

const MIME = { webm: "video/webm", mp4: "video/mp4" } as const;

export function Scene() {
  return (
    <div className={styles.scene} aria-hidden="true">
      {PLATES.map(({ id, slug, plays, codecs }) => (
        <div
          key={id}
          className={styles.plate}
          data-plate-id={id}
          {...(plays ? { "data-plate-on": "", style: { "--o": 1 } as React.CSSProperties } : {})}
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
            {...(plays ? { autoPlay: true, preload: "auto" } : { preload: "none" })}
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
