import Link from "next/link";

const TABS = [
  { key: "moderation", href: "/admin", label: "Moderation" },
  { key: "settings", href: "/admin/settings", label: "Cities, categories and boards" },
] as const;

export function AdminHeader({ current }: { current: (typeof TABS)[number]["key"] }) {
  return (
    <div className="admin-head">
      <h1 className="admin-title">Admin</h1>
      <nav className="admin-tabs" aria-label="Admin sections">
        {TABS.map((t) => (
          <Link key={t.key} href={t.href} aria-current={t.key === current ? "page" : undefined}>
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
