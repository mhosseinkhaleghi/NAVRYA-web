import styles from "./Scene.module.css";

/**
 * The backdrop of the frame.
 *
 * Sources are ordered so the browser takes the smallest file it can play at the
 * size it needs. The `prefers-reduced-motion: no-preference` guard on every
 * source means a viewer who asks for less motion matches *no* source at all —
 * the video never downloads and the poster stands in its place. That keeps the
 * whole scene free of client-side JavaScript.
 */
export function Scene() {
  return (
    <div className={styles.scene} aria-hidden="true">
      <video
        className={styles.video}
        poster="/scene/hunter-dawn-poster.jpg"
        autoPlay
        muted
        loop
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

      <div className={styles.scrim} />
    </div>
  );
}
