import type { ReactNode } from "react";

import styles from "./Stage.module.css";

/**
 * The film, and the ordinary document that follows it.
 *
 * The film is a tall block with a sticky screen inside it. The screen pins
 * itself for exactly as long as the block lasts and then lets go, so the
 * sections after it are plain siblings in normal flow — no pinned layer for
 * them to be stacked over, no z-index deciding who is on top, nothing but a
 * page.
 *
 * It used to be a fixed full-screen stage, a tall empty spacer to scroll
 * through, and a separate layer above both holding everything after the film.
 * That works, and it is the arrangement four rounds of "the wheel does nothing
 * past section 7" were fought inside. A fixed element does not belong to the
 * scroll it is driven by; a sticky one does. Everything below the film is now
 * reached the way anything on any page is reached, which is what was asked for
 * and is one fewer thing that can behave differently inside an embed.
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
      {/*
       * The block is the timeline's length; the screen inside it is what the
       * viewer looks at. `data-track` stays on the block, because the length of
       * the block is still exactly what the controller measures the scroll
       * against — the mechanism above it is unchanged.
       */}
      <div className={styles.film} data-track="">
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
      </div>
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
