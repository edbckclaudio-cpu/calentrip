"use client";
import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export default function Home() {
  const { t } = useI18n();
  useEffect(() => {
    try {
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
    } catch {}
  }, []);
  return (
    <div className="min-h-screen px-4 py-6">
      <div className="container-page max-w-xl">
        <h1 className="mb-2 text-2xl font-semibold text-[var(--brand)]">{t("homeWelcomeTitle")}</h1>
        <p className="mb-6 text-sm text-zinc-600">{t("homeWelcomeText")}</p>
        <Link href="/flights/search">
          <Button type="button">{t("homeStartButton")}</Button>
        </Link>
      </div>
    </div>
  );
}
