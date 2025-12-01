"use client";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

type Passengers = { adults: number; children: number; infants: number };

export default function PassengerSelector({ value, onChange }: { value: Passengers; onChange: (v: Passengers) => void }) {
  const { t } = useI18n();

  function set(type: keyof Passengers, delta: number) {
    const next = { ...value, [type]: Math.max(0, (value[type] ?? 0) + delta) } as Passengers;
    onChange(next);
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs" title={t("ageNotePassengers")}> 
      <div className="flex items-center justify-between gap-2 rounded-md border border-zinc-300 px-2 py-1 dark:border-zinc-700">
        <span className="text-[10px]">{t("adults")}</span>
        <div className="flex items-center gap-1">
          <Button type="button" className="h-6 w-6 px-0" onClick={() => set("adults", -1)}>
            <span className="material-symbols-outlined text-[14px]">remove</span>
          </Button>
          <div className="w-7 text-center text-[11px] font-medium">{value.adults ?? 0}</div>
          <Button type="button" className="h-6 w-6 px-0" onClick={() => set("adults", 1)}>
            <span className="material-symbols-outlined text-[14px]">add</span>
          </Button>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 rounded-md border border-zinc-300 px-2 py-1 dark:border-zinc-700">
        <span className="text-[10px]">{t("children")}</span>
        <div className="flex items-center gap-1">
          <Button type="button" className="h-6 w-6 px-0" onClick={() => set("children", -1)}>
            <span className="material-symbols-outlined text-[14px]">remove</span>
          </Button>
          <div className="w-7 text-center text-[11px] font-medium">{value.children ?? 0}</div>
          <Button type="button" className="h-6 w-6 px-0" onClick={() => set("children", 1)}>
            <span className="material-symbols-outlined text-[14px]">add</span>
          </Button>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 rounded-md border border-zinc-300 px-2 py-1 dark:border-zinc-700">
        <span className="text-[10px]">{t("infants")}</span>
        <div className="flex items-center gap-1">
          <Button type="button" className="h-6 w-6 px-0" onClick={() => set("infants", -1)}>
            <span className="material-symbols-outlined text-[14px]">remove</span>
          </Button>
          <div className="w-7 text-center text-[11px] font-medium">{value.infants ?? 0}</div>
          <Button type="button" className="h-6 w-6 px-0" onClick={() => set("infants", 1)}>
            <span className="material-symbols-outlined text-[14px]">add</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
