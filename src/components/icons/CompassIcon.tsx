export function CompassIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="24" cy="24" r="22" />
      {/* The needle: a slim two-tone lozenge, north-east to south-west. */}
      <path d="M31.5 16.5 26 26 16.5 31.5 22 22Z" />
      <path d="M26 26 22 22" />
    </svg>
  );
}
