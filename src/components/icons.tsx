export function LogoClock({ className = "", title = "CalenTrip" }: { className?: string; title?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <title>{title}</title>
      <rect x="2" y="6" width="20" height="12" rx="2" fill="#febb02" />
      <rect x="2" y="6" width="20" height="3" rx="2" fill="#e5a800" />
      <circle cx="23" cy="22" r="9" fill="#003580" />
      <circle cx="23" cy="22" r="7" fill="#febb02" />
      <rect x="21.8" y="15.5" width="2.4" height="7" rx="1" fill="#003580" transform="rotate(15 23 19)" />
      <rect x="22.2" y="20.5" width="2.4" height="6" rx="1" fill="#003580" transform="rotate(105 23.4 23.5)" />
    </svg>
  );
}

