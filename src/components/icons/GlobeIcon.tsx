export function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="9.25" />
      <path d="M2.75 12h18.5" />
      <path d="M12 2.75c2.4 2.6 3.6 5.68 3.6 9.25S14.4 18.65 12 21.25c-2.4-2.6-3.6-5.68-3.6-9.25S9.6 5.35 12 2.75Z" />
    </svg>
  );
}
