"use client";

import { useEffect, useRef } from "react";

import type { Dictionary } from "@/i18n/dictionaries";

import styles from "./MissSection.module.css";

/**
 * The loop inside section 6's bezel.
 *
 * Always the landscape clip. The bezel is the comp's fixed "device" window —
 * 16/10.4 on every viewport, phone included; only its size in the layout
 * changes, never its shape (see `.bezel` below). A 9:16 clip forced into that
 * window would `cover`-crop down to a sliver of itself, which is the "not
 * clean on mobile" the landscape-only render avoids: one file, `cover`-fit,
 * looks the same everywhere the bezel appears.
 *
 * Plays twice from the moment it lands on screen, then rests on its own last
 * frame — the shot closes on the NAVRYA mark, so a third loop would just cut
 * back to a blank chart. `loop` is deliberately left off the element: with it
 * set, the browser reseeks to 0 without ever firing `ended`, which is the
 * only hook a "play it exactly twice" rule has to hang off. Without it, a
 * non-looping video simply pauses on its final frame once `ended` fires,
 * which is the rest state this is after — no explicit pause needed for it.
 */
export function BezelVideo({ media }: { media: Dictionary["miss"]["media"] }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let plays = 0;
    const onEnded = () => {
      plays += 1;
      if (plays < 2) {
        video.currentTime = 0;
        void video.play();
      }
      // A third `ended` never comes: the video is not looped, so the element
      // simply holds its last frame once this branch is skipped.
    };
    video.addEventListener("ended", onEnded);
    return () => video.removeEventListener("ended", onEnded);
  }, []);

  return (
    <div
      className={styles.bezelMedia}
      style={{ "--bezel-still": `url("${media.landscape.poster}")` } as React.CSSProperties}
    >
      <div className={styles.bezelStill} />
      <video
        ref={videoRef}
        className={styles.bezelVideo}
        autoPlay
        muted
        playsInline
        disablePictureInPicture
        disableRemotePlayback
        preload="auto"
        tabIndex={-1}
      >
        <source
          src={media.landscape.webm}
          type="video/webm"
          media="(prefers-reduced-motion: no-preference)"
        />
        <source
          src={media.landscape.mp4}
          type="video/mp4"
          media="(prefers-reduced-motion: no-preference)"
        />
      </video>
    </div>
  );
}
