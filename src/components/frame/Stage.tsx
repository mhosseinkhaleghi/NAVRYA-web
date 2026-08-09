import type { ReactNode } from "react";

import styles from "./Stage.module.css";

/**
 * The fixed full-screen frame, the scroll track that drives it, and the ordinary
 * document that follows.
 *
 * Every scene of the *film* lives inside the stage. It is pinned to the viewport
 * and clips its contents, so scrolling can never move the composition — what
 * scrolling moves is the timeline, and the track is simply how much document
 * there is to scroll through.
 *
 * `after` is the part of the site that is not a film. The sequence ends on the
 * page's own black, and from there the site behaves like any other: sections in
 * normal flow, scrolling up over the pinned frame, revealing once and staying
 * revealed. They are opaque and the frame beneath them has faded to the same
 * black, so the handover from film to document has nothing to see.
 */
export function Stage({
  children,
  after,
  chrome,
}: {
  children: ReactNode;
  after?: ReactNode;
  chrome?: ReactNode;
}) {
  return (
    <>
      <div className={styles.stage}>
        {/*
         * On compact frames the bar is a row of the stage rather than an
         * overlay, and the scenes below it are grid items that rely on row one
         * being the bar's height. The bar itself now lives in `chrome`, above
         * the document — so this holds its place. Desktop scenes are absolute
         * and reserve `--header-h` themselves, so it is not needed there.
         */}
        <div className={styles.band} aria-hidden="true" />
        {children}
      </div>
      <div className={styles.track} data-track="" aria-hidden="true" />
      {after ? <div className={styles.flow}>{after}</div> : null}
      {/*
       * The bar and the rail sit above everything, film and document alike.
       * They cannot stay inside the stage: it is a stacking context of its own,
       * so anything in it is trapped below the flow that scrolls over it.
       */}
      {chrome ? <div className={styles.chrome}>{chrome}</div> : null}
    </>
  );
}
