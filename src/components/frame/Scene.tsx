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

          {/*
           * The proxy: the same shot at 854×480, and the whole film in 1.8MB
           * against the shipping renditions' 15.
           *
           * It exists because of arithmetic that no amount of load ordering
           * gets around. The scroll unlocks about six seconds in and a viewer
           * steps roughly every second and a half; the full plates were 23MB,
           * which on a 12Mbps line is fifteen seconds. They will always be
           * ahead of it, and they were — measured, eight stops out of twelve
           * with a frozen still where the shot should have been running.
           *
           * `preload="none"`, and the controller sends for it the moment the
           * opening plate starts playing. Eager was the obvious choice and it
           * was wrong: this is the only tier fetched before the viewer asks for
           * anything, so at parse time it competes with the one plate the
           * interface actually waits on. Measured live, it doubled that plate's
           * arrival and put three and a half seconds in front of first paint.
           *
           * Started at playback instead, it has the whole length of the opening
           * shot to itself — about a second of a five-second run — and is in
           * hand well before the scroll unlocks, which is the only deadline it
           * has. Its weight is budgeted for the same reason and the budget is
           * asserted in `verify.mjs`; re-encoding it at 720p once quietly
           * tripled it, and nothing in the suite noticed.
           *
           * So the light copy carries the motion from the first gesture and the
           * heavy one takes over the moment it can. Durations are identical to
           * the frame, so both answer the same scrub fraction and the handover
           * lands on the same picture, softer to sharper, in the same place.
           *
           * Not rendered for the lead plate: that one is played rather than
           * scrubbed, it is the only thing downloading at the time, and it is
           * already the lightest of the set.
           */}
          {lead ? null : (
            <video
              className={styles.proxy}
              data-scene-proxy={id}
              preload="none"
              muted
              playsInline
              tabIndex={-1}
              aria-hidden="true"
            >
              <source
                src={`/scene/${slug}-proxy.webm`}
                type="video/webm"
                media="(prefers-reduced-motion: no-preference)"
              />
            </video>
          )}

          <video
            className={styles.video}
            data-scene-video={id}
            /*
             * The lead plate plays, so it is fetched outright. The rest stay at
             * `none` here and are pulled by the controller, in scroll order,
             * the moment the opening beat is over — see the warming chain.
             *
             * `none` rather than `metadata`, and that was measured: seven
             * metadata requests at page load share the line with the plate the
             * viewer is actually watching, and the opening took five seconds
             * longer to become scrollable for it. The duration those requests
             * would have bought is not needed early — the scrubber holds the
             * position it wants as a fraction and places the frame the moment
             * the plate can carry one.
             */
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
