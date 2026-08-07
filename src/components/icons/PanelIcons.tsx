/**
 * One icon per panel, drawn on the same 48px circle so the three feature cards
 * read as a set: a compass for planning, a session clock for timing, a
 * stopwatch for reacting.
 */

type IconProps = { className?: string };

const frame = {
  viewBox: "0 0 48 48",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "1.1",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: "false",
} as const;

function CompassIcon({ className }: IconProps) {
  return (
    <svg className={className} {...frame}>
      <circle cx="24" cy="24" r="22" />
      {/* The needle: a slim lozenge, north-east to south-west. */}
      <path d="M31.5 16.5 26 26 16.5 31.5 22 22Z" />
      <path d="M26 26 22 22" />
    </svg>
  );
}

function SessionIcon({ className }: IconProps) {
  return (
    <svg className={className} {...frame}>
      <circle cx="24" cy="24" r="22" />
      {/* Clock hands above, a session bar with its open and close below. */}
      <path d="M24 24V14" />
      <path d="M24 24h6.5" />
      <path d="M14 33.5h20" />
      <circle cx="18.5" cy="33.5" r="1.9" />
      <circle cx="29.5" cy="33.5" r="1.9" />
    </svg>
  );
}

function TimerIcon({ className }: IconProps) {
  return (
    <svg className={className} {...frame}>
      <circle cx="24" cy="26" r="18" />
      {/* Crown and stem, the way a stopwatch is wound. */}
      <path d="M20 4h8" />
      <path d="M24 4v4" />
      <path d="M37 13l3.2-3.2" />
      <path d="M24 26l7-7" />
      <circle cx="24" cy="26" r="1.6" />
    </svg>
  );
}

export const PANEL_ICONS = {
  compass: CompassIcon,
  session: SessionIcon,
  timer: TimerIcon,
} as const;

export type PanelIconName = keyof typeof PANEL_ICONS;
