import styles from "./BrandMark.module.css";

/**
 * The Navrya mark.
 *
 * Three things in one shape, as the brand book has it: a compass ring for
 * direction, the gap in it for the way out, and the arrow going through that
 * gap for forward movement. Drawn rather than placed — it is four numbers and a
 * triangle, and as SVG it stays sharp at the favicon's twelve pixels and at the
 * wordmark's, needs no file, and takes the site's own colour.
 *
 * The book sets the ring in its deep navy, which is very nearly this site's
 * black and would disappear on it. Here the ring carries the site's gold and
 * the arrow keeps the brand's violet, so the mark reads as itself against the
 * one background it has to live on.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      className={[styles.mark, className].filter(Boolean).join(" ")}
      viewBox="0 0 48 48"
      role="img"
      aria-label="Navrya"
    >
      {/*
       * The ring, opened at the north-east. A dashed circle rather than an arc
       * path: the dash and the gap are the two numbers the shape is actually
       * about, and they can be read here without solving an arc for them.
       */}
      <circle
        className={styles.ring}
        cx="24"
        cy="24"
        r="17.5"
        pathLength="100"
        strokeDasharray="76 24"
        transform="rotate(6 24 24)"
      />
      {/* The arrow: a sharp point at the centre widening as it leaves through
          the gap, so it reads as travelling outward rather than sitting there. */}
      <path className={styles.arrow} d="M25.6 25.4 46.5 4.8 40.6 26.4Z" />
    </svg>
  );
}
