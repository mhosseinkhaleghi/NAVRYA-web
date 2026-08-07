import type { ReactNode } from "react";

import styles from "./Stage.module.css";

/**
 * The fixed full-screen frame.
 *
 * Every scene of the site lives inside this one element. It is pinned to the
 * viewport and clips its contents, so scrolling can never move the composition
 * — later steps will swap what is *inside* the frame instead.
 */
export function Stage({ children }: { children: ReactNode }) {
  return <div className={styles.stage}>{children}</div>;
}
