"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";

function NavIcon({ name, active }: { name: "explore" | "trips" | "stays" | "calendar" | "profile"; active?: boolean }) {
  const cls = `material-symbols-outlined text-[20px] ${active ? "text-[var(--brand)]" : "text-zinc-600"}`;
  switch (name) {
    case "explore":
      return <span className={cls}>travel_explore</span>;
    case "trips":
      return <span className={cls}>flight</span>;
    case "stays":
      return <span className={cls}>hotel</span>;
    case "calendar":
      return <span className={cls}>calendar_month</span>;
    case "profile":
      return <span className={cls}>account_circle</span>;
  }
}

export default function BottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  const items = [
    { href: "/", name: "explore" as const, label: t("navExplore") },
    { href: "/accommodation/search", name: "stays" as const, label: t("navStays") },
    { href: "/calendar/final", name: "calendar" as const, label: t("navCalendar") },
    { href: "/profile", name: "profile" as const, label: t("navProfile") },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 sm:hidden border-t border-[var(--border)] bg-white/95 backdrop-blur" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <ul className="grid grid-cols-4 px-2 py-2">
        {items.map((it) => {
          const active = (pathname || "").startsWith(it.href);
          return (
            <li key={it.href} className="flex items-center justify-center">
              <Link href={it.href} prefetch={it.href === "/flights/search" ? false : undefined} aria-current={active ? "page" : undefined} className="flex flex-col items-center gap-1 text-xs" onClick={() => {
                try {
                  if (it.name === "explore") {
                    if (typeof window !== "undefined") {
                      localStorage.removeItem("calentrip_trip_summary");
                      localStorage.removeItem("calentrip:entertainment:records");
                      localStorage.removeItem("calentrip:saved_calendar");
                      localStorage.removeItem("calentrip:open_calendar_help");
                      localStorage.removeItem("calentrip:arrivalNextDay_outbound");
                      localStorage.removeItem("calentrip:arrivalNextDay_inbound");
                      localStorage.removeItem("calentrip:tripSearch");
                      localStorage.removeItem("calentrip:auto_load_saved");
                    }
                  }
                } catch {}
              }}>
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
