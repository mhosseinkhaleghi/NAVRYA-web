"use client";

import { useEffect, useRef, useState } from "react";

import { BrandMark } from "@/components/site/BrandMark";
import type { Dictionary } from "@/i18n/dictionaries";

import styles from "./MissSection.module.css";

type Trait = Dictionary["miss"]["traits"][number];

/**
 * The loop inside section 6's bezel.
 *
 * One clip per trait, switched to match whichever dot the deck currently has
 * `aria-current` on. The deck's own carousel already computes that — see
 * `dotEls[t].setAttribute('aria-current', …)` in `stage-script.ts` — so this
 * reads it off the DOM with a `MutationObserver` rather than keeping a second,
 * competing notion of "which slide" in React state. `[data-miss]` is the
 * nearest ancestor both the dots and this panel share.
 *
 * A trait without a clip yet (see `Dictionary["miss"]["traits"][number]["media"]`)
 * shows the brand mark instead of standing empty — the panel keeps its shape
 * either way.
 *
 * Always the landscape file. The bezel is a fixed 16/10.4 "device" window on
 * every viewport, phone included; only its size in the layout changes, never
 * its shape. A 9:16 clip forced into that window would `cover`-crop down to a
 * sliver of itself, which is what made mobile playback look broken before.
 *
 * Plays twice from the moment a trait becomes current, then rests on its own
 * last frame — each shot closes on the NAVRYA mark, so a third loop would
 * just cut back to a blank chart. `loop` is deliberately left off the
 * element: with it set, the browser reseeks to 0 without ever firing `ended`,
 * which is the only hook a "play it exactly twice" rule has to hang off.
 * Without it, a non-looping video simply pauses on its final frame once
 * `ended` fires, which is the rest state this is after.
 */
export function BezelVideo({ traits }: { traits: Trait[] }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const root = videoRef.current?.closest("[data-miss]");
    if (!root) return;
    const dots = Array.from(root.querySelectorAll("[data-dot]"));
    if (!dots.length) return;

    const readActive = () => {
      const current = dots.findIndex((dot) => dot.getAttribute("aria-current") === "true");
      return current === -1 ? 0 : current;
    };

    setActive(readActive());

    const observer = new MutationObserver(() => setActive(readActive()));
    dots.forEach((dot) => observer.observe(dot, { attributes: true, attributeFilter: ["aria-current"] }));
    return () => observer.disconnect();
  }, []);

  const media = traits[active]?.media ?? null;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !media) return;

    // A new trait's source list: reselect and start its own two plays fresh.
    video.load();
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
  }, [media]);

  if (!media) {
    return (
      <div className={styles.bezelMedia}>
        <div className={styles.bezelIdle}>
          <BrandMark className={styles.bezelIdleMark} />
        </div>
        <div className={styles.bezelVignette} />
      </div>
    );
  }

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
      <div className={styles.bezelVignette} />
    </div>
  );
}
