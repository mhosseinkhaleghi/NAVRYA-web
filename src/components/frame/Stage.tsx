import type { ReactNode } from "react";

import styles from "./Stage.module.css";

/**
 * The fixed full-screen frame, plus the scroll track that drives it.
 *
 * Every scene of the site lives inside the stage. It is pinned to the viewport
 * and clips its contents, so scrolling can never move the composition — what
 * scrolling moves is the *timeline*, and the track below is simply how much
 * document there is to scroll through.
 */
export function Stage({ children }: { children: ReactNode }) {
  return (
    <>
      <div className={styles.stage}>{children}</div>
      <div className={styles.track} aria-hidden="true" />
    </>
  );
}
