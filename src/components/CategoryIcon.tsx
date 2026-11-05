// Line icons for the categories (24px grid, drawn in the current text colour). Categories
// added later in admin get the tag icon until one is drawn for them here.

const PATHS: Record<string, React.ReactNode> = {
  cafes: (
    <>
      <path d="M4.5 9.5h11v4a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z" />
      <path d="M15.5 10.5h1.25a2.5 2.5 0 0 1 0 5H15" />
      <path d="M8 3.5c-.8.9-.8 1.7 0 2.5M11.5 3.5c-.8.9-.8 1.7 0 2.5M4 21h13" />
    </>
  ),
  restaurants: (
    <>
      <path d="M5 3v5a2.5 2.5 0 0 0 5 0V3M7.5 3v18" />
      <path d="M18.5 21V3c-2.4 1.4-3.5 4.2-3.5 7.5V14h3.5" />
    </>
  ),
  salons: (
    <>
      <circle cx="6.5" cy="7" r="2.75" />
      <circle cx="6.5" cy="17" r="2.75" />
      <path d="M8.9 8.4 20 17.5M8.9 15.6 20 6.5" />
    </>
  ),
  gyms: <path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11" />,
  "t-shirts": <path d="M8.5 3.5 3.5 6.5l2 4 2.5-1v11h8v-11l2.5 1 2-4-5-3c-.6 1.5-1.9 2.5-3.5 2.5s-2.9-1-3.5-2.5z" />,
  bakeries: (
    <>
      <path d="M4.5 11.5a3.5 3.5 0 0 1 1.5-6.5h12a3.5 3.5 0 0 1 1.5 6.5V19a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1z" />
      <path d="M9 9l-1.5 2.5M13 9l-1.5 2.5M17 9l-1.5 2.5" />
    </>
  ),
  "sweet-shops": (
    <>
      <circle cx="12" cy="12" r="4.25" />
      <path d="M15 9l1.75-4.75L19.75 7.25zM9 15l-1.75 4.75L4.25 16.75z" />
    </>
  ),
  spas: (
    <>
      <path d="M12 20c-4.4 0-8-3.1-8-8 3.2 0 6.2 1.7 8 4.3 1.8-2.6 4.8-4.3 8-4.3 0 4.9-3.6 8-8 8z" />
      <path d="M12 16.3c-1.6-2.4-1.6-5.8 0-9.3 1.6 3.5 1.6 6.9 0 9.3z" />
    </>
  ),
  boutiques: (
    <>
      <path d="M10 6.5a2 2 0 1 1 2 2v1.5" />
      <path d="M12 10 3.6 16.1a1 1 0 0 0 .6 1.9h15.6a1 1 0 0 0 .6-1.9z" />
    </>
  ),
  "pet-shops": (
    <>
      <circle cx="6.5" cy="10.5" r="1.75" />
      <circle cx="10" cy="6.5" r="1.75" />
      <circle cx="14" cy="6.5" r="1.75" />
      <circle cx="17.5" cy="10.5" r="1.75" />
      <path d="M12 12.5c-2.4 0-5 2.9-5 5a2.4 2.4 0 0 0 3.4 2.2 4 4 0 0 1 3.2 0A2.4 2.4 0 0 0 17 17.5c0-2.1-2.6-5-5-5z" />
    </>
  ),
};

const TAG = (
  <>
    <path d="M3.5 12.6V4.5a1 1 0 0 1 1-1h8.1a1 1 0 0 1 .7.3l7.2 7.2a1 1 0 0 1 0 1.4l-8.1 8.1a1 1 0 0 1-1.4 0l-7.2-7.2a1 1 0 0 1-.3-.7z" />
    <circle cx="8" cy="8" r="1.25" />
  </>
);

export function CategoryIcon({ slug, className = "category-icon" }: { slug: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[slug] ?? TAG}
    </svg>
  );
}
