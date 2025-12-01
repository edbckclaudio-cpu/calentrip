"use client";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useRef, useState } from "react";

type Passengers = { adults: number; children: number; infants: number };

export default function PassengerSelector({ value, onChange }: { value: Passengers; onChange: (v: Passengers) => void }) {
  const { t } = useI18n();
  const [hint, setHint] = useState<"adults" | "children" | "infants" | null>(null);
  const hintTimerRef = useRef<number | null>(null);

  function set(type: keyof Passengers, delta: number) {
    const next = { ...value, [type]: Math.max(0, (value[type] ?? 0) + delta) } as Passengers;
    onChange(next);
  }

  function showHint(k: "adults" | "children" | "infants") {
    setHint(k);
    if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current);
    hintTimerRef.current = window.setTimeout(() => setHint(null), 1500);
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs" title={t("ageNotePassengers")}> 
      <div className="relative flex items-center justify-between gap-2 rounded-md border border-zinc-300 px-2 py-1 dark:border-zinc-700" aria-label={t("adults")} title={t("adults")} onMouseEnter={() => showHint("adults")} onTouchStart={() => showHint("adults")}>
        {hint === "adults" ? (
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-[var(--brand)] px-2 py-1 text-[10px] font-semibold text-black shadow">
            {t("adults")}
          </div>
        ) : null}
        <div className="flex items-center gap-1">
          <Button type="button" className="h-6 w-6 px-0" onClick={() => set("adults", -1)} onFocus={() => showHint("adults")}>
            <span className="material-symbols-outlined text-[14px]">remove</span>
          </Button>
          <div className="w-7 text-center text-[11px] font-medium">{value.adults ?? 0}</div>
          <Button type="button" className="h-6 w-6 px-0" onClick={() => set("adults", 1)} onFocus={() => showHint("adults")}>
            <span className="material-symbols-outlined text-[14px]">add</span>
          </Button>
        </div>
      </div>
      <div className="relative flex items-center justify-between gap-2 rounded-md border border-zinc-300 px-2 py-1 dark:border-zinc-700" aria-label={t("children")} title={t("children")} onMouseEnter={() => showHint("children")} onTouchStart={() => showHint("children")}>
        {hint === "children" ? (
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-[var(--brand)] px-2 py-1 text-[10px] font-semibold text-black shadow">
            {t("children")}
          </div>
        ) : null}
        <div className="flex items-center gap-1">
          <Button type="button" className="h-6 w-6 px-0" onClick={() => set("children", -1)} onFocus={() => showHint("children")}>
            <span className="material-symbols-outlined text-[14px]">remove</span>
          </Button>
          <div className="w-7 text-center text-[11px] font-medium">{value.children ?? 0}</div>
          <Button type="button" className="h-6 w-6 px-0" onClick={() => set("children", 1)} onFocus={() => showHint("children")}>
            <span className="material-symbols-outlined text-[14px]">add</span>
          </Button>
        </div>
      </div>
      <div className="relative flex items-center justify-between gap-2 rounded-md border border-zinc-300 px-2 py-1 dark:border-zinc-700" aria-label={t("infants")} title={t("infants")} onMouseEnter={() => showHint("infants")} onTouchStart={() => showHint("infants")}>
        {hint === "infants" ? (
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-[var(--brand)] px-2 py-1 text-[10px] font-semibold text-black shadow">
            {t("infants")}
          </div>
        ) : null}
        <div className="flex items-center gap-1">
          <Button type="button" className="h-6 w-6 px-0" onClick={() => set("infants", -1)} onFocus={() => showHint("infants")}>
            <span className="material-symbols-outlined text-[14px]">remove</span>
          </Button>
          <div className="w-7 text-center text-[11px] font-medium">{value.infants ?? 0}</div>
          <Button type="button" className="h-6 w-6 px-0" onClick={() => set("infants", 1)} onFocus={() => showHint("infants")}>
            <span className="material-symbols-outlined text-[14px]">add</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
