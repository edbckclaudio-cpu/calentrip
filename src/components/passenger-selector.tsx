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
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm">{t("adults")}</div>
        <div className="flex items-center gap-2">
          <Button type="button" className="h-8 w-8 px-0" onClick={() => set("adults", -1)}>
            <span className="material-symbols-outlined text-base">remove</span>
          </Button>
          <div className="w-8 text-center text-sm font-medium">{value.adults ?? 0}</div>
          <Button type="button" className="h-8 w-8 px-0" onClick={() => set("adults", 1)}>
            <span className="material-symbols-outlined text-base">add</span>
          </Button>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm">{t("children")}</div>
        <div className="flex items-center gap-2">
          <Button type="button" className="h-8 w-8 px-0" onClick={() => set("children", -1)}>
            <span className="material-symbols-outlined text-base">remove</span>
          </Button>
          <div className="w-8 text-center text-sm font-medium">{value.children ?? 0}</div>
          <Button type="button" className="h-8 w-8 px-0" onClick={() => set("children", 1)}>
            <span className="material-symbols-outlined text-base">add</span>
          </Button>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm">{t("infants")}</div>
        <div className="flex items-center gap-2">
          <Button type="button" className="h-8 w-8 px-0" onClick={() => set("infants", -1)}>
            <span className="material-symbols-outlined text-base">remove</span>
          </Button>
          <div className="w-8 text-center text-sm font-medium">{value.infants ?? 0}</div>
          <Button type="button" className="h-8 w-8 px-0" onClick={() => set("infants", 1)}>
            <span className="material-symbols-outlined text-base">add</span>
          </Button>
        </div>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {t("ageNotePassengers")}
      </p>
    </div>
  );
}
