/**
 * The ornamental frame around the second slide.
 *
 * Built from five kinds of piece rather than one drawing, and that is the whole
 * trick: a frame has to fit a box whose aspect changes with every viewport, and
 * a single SVG stretched to fit would skew every ornament on it. So the straight
 * runs are drawn with `preserveAspectRatio="none"` — they are lines, and a
 * stretched line is still that line — while the corners, the two medallions and
 * the side marks are their own square SVGs pinned to the edges at a fixed size.
 * Nothing that has a shape is ever scaled unevenly.
 *
 * Everything is `currentColor` on a stroke, so the whole frame takes its colour
 * from one rule and inherits the palette with everything else. No fills, no
 * gradients: it is drawn metal, in the design system's sense.
 *
 * `aria-hidden` throughout. This is ornament — the slide's meaning is its
 * headline, and a screen reader that announced sixty path elements would be
 * reading the border of a picture frame aloud.
 */

function Corner({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 120 120" fill="none" aria-hidden="true">
      {/* The chamfer, doubled — the outer line turns the corner short of the
          inner one, which is what gives the frame its cut edge. */}
      <path d="M120 2H34L2 34v86" stroke="currentColor" strokeWidth="1.5" />
      <path d="M120 11H38L11 38v82" stroke="currentColor" strokeWidth="1" opacity="0.75" />
      {/* The fan that sits in the cut. */}
      <path d="M16 46l14-14M22 52l16-16M28 58l18-18" stroke="currentColor" strokeWidth="0.9" opacity="0.5" />
      <path d="M40 22h18l-9 9-9-9zM22 40v18l9-9-9-9z" stroke="currentColor" strokeWidth="0.9" opacity="0.65" />
      <path d="M62 16h30M16 62v30" stroke="currentColor" strokeWidth="0.9" opacity="0.4" />
      <circle cx="34" cy="34" r="3.5" stroke="currentColor" strokeWidth="0.9" opacity="0.8" />
    </svg>
  );
}

/** Crossed swords, the mark this page is built around. */
function Swords({ size }: { size: number }) {
  return (
    <g transform={`translate(${-size / 2} ${-size / 2}) scale(${size / 24})`}>
      <path
        d="M4 4l13 13M20 4L7 17"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path d="M3 18l3 3M21 18l-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M15 3h6v6" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      <path d="M9 3H3v6" stroke="currentColor" strokeWidth="1" opacity="0.6" />
    </g>
  );
}

function TopMark({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="-60 -30 120 60" fill="none" aria-hidden="true">
      {/* The band the mark sits on, so the frame's top line reads as passing
          behind it rather than stopping at it. */}
      <path d="M-60 0h18M42 0h18" stroke="currentColor" strokeWidth="1.5" />
      <path d="M-42 0l10-10h64l10 10-10 10h-64z" stroke="currentColor" strokeWidth="1" />
      <path d="M-30 0l7-7h46l7 7-7 7h-46z" stroke="currentColor" strokeWidth="0.8" opacity="0.55" />
      <path d="M-52 0l5-5v10zM52 0l-5-5v10z" stroke="currentColor" strokeWidth="0.9" opacity="0.7" />
      <g opacity="0.95">
        <Swords size={22} />
      </g>
    </svg>
  );
}

function BottomMark({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="-110 -44 220 88" fill="none" aria-hidden="true">
      {/* The wide chevron the medallion rests on. */}
      <path d="M-110 26h56l24-24 6 6M110 26H54L30 2l-6 6" stroke="currentColor" strokeWidth="1.2" />
      <path d="M-96 34h44l20-20M96 34H52L32 14" stroke="currentColor" strokeWidth="0.9" opacity="0.5" />
      <path d="M-14 40l14 14 14-14-14-6z" stroke="currentColor" strokeWidth="0.9" opacity="0.7" />
      <circle cx="0" cy="0" r="26" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="0" cy="0" r="21" stroke="currentColor" strokeWidth="0.8" opacity="0.55" />
      <g opacity="0.95">
        <Swords size={24} />
      </g>
    </svg>
  );
}

function SideMark({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="-22 -44 44 88" fill="none" aria-hidden="true">
      <path d="M0 -44v10M0 34v10" stroke="currentColor" strokeWidth="1.5" />
      <path d="M0 -34l14 17-14 17-14-17z" stroke="currentColor" strokeWidth="1" />
      <path d="M0 -24l9 7-9 7-9-7z" stroke="currentColor" strokeWidth="0.8" opacity="0.55" />
      <circle cx="0" cy="0" r="2.5" stroke="currentColor" strokeWidth="0.9" opacity="0.8" />
    </svg>
  );
}

export function BattleFrame({ styles }: { styles: Record<string, string> }) {
  return (
    <div className={styles.frame} aria-hidden="true">
      {/* The straight runs. Stretched to whatever box they are given, which for
          a line is not a distortion. */}
      <svg
        className={styles.rails}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        fill="none"
      >
        <rect x="0.5" y="0.5" width="99" height="99" stroke="currentColor" strokeWidth="0.4" />
        <rect x="3" y="3" width="94" height="94" stroke="currentColor" strokeWidth="0.25" opacity="0.6" />
      </svg>

      <Corner className={`${styles.corner} ${styles.cornerTopStart}`} />
      <Corner className={`${styles.corner} ${styles.cornerTopEnd}`} />
      <Corner className={`${styles.corner} ${styles.cornerBottomStart}`} />
      <Corner className={`${styles.corner} ${styles.cornerBottomEnd}`} />

      <TopMark className={styles.topMark} />
      <BottomMark className={styles.bottomMark} />
      <SideMark className={`${styles.sideMark} ${styles.sideStart}`} />
      <SideMark className={`${styles.sideMark} ${styles.sideEnd}`} />
    </div>
  );
}
