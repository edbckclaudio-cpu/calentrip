"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";

function NavIcon({ name, active }: { name: "explore" | "trips" | "stays" | "profile"; active?: boolean }) {
  const cls = `material-symbols-outlined text-[20px] ${active ? "text-[var(--brand)]" : "text-zinc-600"}`;
  switch (name) {
    case "explore":
      return <span className={cls}>travel_explore</span>;
    case "trips":
      return <span className={cls}>flight</span>;
    case "stays":
      return <span className={cls}>hotel</span>;
    case "profile":
      return <span className={cls}>account_circle</span>;
  }
}

export default function BottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  const items = [
    { href: "/flights/search", name: "explore" as const, label: t("navExplore") },
    { href: "/flights/results", name: "trips" as const, label: t("navTrips") },
    { href: "/accommodation/search", name: "stays" as const, label: t("navStays") },
    { href: "/profile", name: "profile" as const, label: t("navProfile") },
  ];

  return (
    <nav className="hidden">
      <ul className="grid grid-cols-4">
        {items.map((it) => {
          const active = pathname.startsWith(it.href);
          return (
            <li key={it.href} className="flex items-center justify-center py-2">
              <Link href={it.href} className="flex flex-col items-center gap-1 text-xs">
                <NavIcon name={it.name} active={active} />
                <span className={active ? "text-[var(--brand)]" : "text-zinc-600"}>{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
