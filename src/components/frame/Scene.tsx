import styles from "./Scene.module.css";

/**
 * The backdrop of the frame.
 *
 * The plate plays once and holds its closing frame — no `loop`, because the
 * shot is a reveal that ends on the hunter turning to face the viewer, and
 * that frame is where the composition comes to rest. A video element with no
 * `loop` keeps its last frame painted after `ended`, so nothing needs to swap
 * in behind it.
 *
 * Sources are ordered so the browser takes the smallest file it can play at the
 * size it needs. The `prefers-reduced-motion: no-preference` guard on every
 * source means a viewer who asks for less motion matches *no* source at all —
 * the video never downloads and the still behind it stands in permanently.
 */
export function Scene() {
  return (
    <div className={styles.scene} aria-hidden="true">
      <div className={styles.still} />

      <video
        className={styles.video}
        data-scene-video=""
        autoPlay
        muted
        playsInline
        preload="auto"
        tabIndex={-1}
      >
        <source
          src="/scene/hunter-dawn-1080.webm"
          type="video/webm"
          media="(min-width: 768px) and (prefers-reduced-motion: no-preference)"
        />
        <source
          src="/scene/hunter-dawn-1080.mp4"
          type="video/mp4"
          media="(min-width: 768px) and (prefers-reduced-motion: no-preference)"
        />
        <source
          src="/scene/hunter-dawn-720.webm"
          type="video/webm"
          media="(prefers-reduced-motion: no-preference)"
        />
        <source
          src="/scene/hunter-dawn-720.mp4"
          type="video/mp4"
          media="(prefers-reduced-motion: no-preference)"
        />
      </video>
    </div>
  );
}
