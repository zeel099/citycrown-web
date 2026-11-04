export function VerifiedBadge({ label = "Verified" }: { label?: string }) {
  return (
    <span className="badge-verified">
      <svg viewBox="0 0 10 10" aria-hidden="true">
        <rect width="10" height="10" rx="2.5" fill="currentColor" />
        <path d="M2.6 5.2 4.3 6.8 7.4 3.4" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </span>
  );
}
