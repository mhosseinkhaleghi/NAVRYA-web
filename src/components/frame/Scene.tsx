import styles from "./Scene.module.css";

/**
 * The backdrop of the frame: three plates that chain into one continuous shot.
 *
 *   dawn   plays on load and holds its closing frame — the hunter turns to
 *          face the viewer. This is the only plate that plays itself.
 *   turn   he turns back to the valley. Scrubbed by scroll.
 *   prey   the deer walks in and settles to graze. Scrubbed by scroll.
 *
 * Each plate's closing frame matches the next one's opening frame, so the
 * handovers are invisible; only one is ever on screen, chosen by `data-plate`
 * on the wrapper.
 *
 * Codec order is per plate, not global. A long GOP compresses better in VP9
 * and a short one better in H.264, so the played plate leads with WebM and the
 * scrubbed plates lead with MP4 — a browser that can decode both always takes
 * the smaller file, and one that cannot falls through to the other.
 *
 * The scrubbed plates carry `preload="none"`: they must not compete for
 * bandwidth with the plate that is actually playing during the opening beat.
 * The controller loads them once the intro is over, several seconds before any
 * scroll can reach them.
 *
 * `prefers-reduced-motion: no-preference` on every source means a viewer who
 * asks for less motion matches *no* source at all — nothing downloads, and the
 * stills stand in. The timeline still runs; it just moves between frames.
 */

const PLATES = [
  { id: "dawn", slug: "hunter-dawn", plays: true, codecs: ["webm", "mp4"] },
  { id: "turn", slug: "hunter-turn", plays: false, codecs: ["mp4", "webm"] },
  { id: "prey", slug: "valley-prey", plays: false, codecs: ["mp4", "webm"] },
] as const;

const MIME = { webm: "video/webm", mp4: "video/mp4" } as const;

export function Scene() {
  return (
    <div className={styles.scene} data-plate="dawn" aria-hidden="true">
      {PLATES.map(({ id, slug, plays, codecs }) => (
        <div key={id} className={styles.plate} data-plate-id={id}>
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
