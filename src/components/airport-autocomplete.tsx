"use client";
import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { searchAirportsAsync, Airport } from "@/lib/airports";
import { useI18n } from "@/lib/i18n";

export default function AirportAutocomplete({ value, onSelect, placeholder, invalid }: { value: string; onSelect: (iata: string) => void; placeholder?: string; invalid?: boolean }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Airport[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    const id = setTimeout(async () => {
      if (!q) {
        setItems([]);
        setOpen(false);
        return;
      }
      const res = await searchAirportsAsync(q);
      setItems(res);
      setOpen(res.length > 0);
    }, 200);
    return () => clearTimeout(id);
  }, [q]);

  function onChangeInput(v: string) {
    setQ(v);
  }

  function select(a: Airport) {
    onSelect(a.iata);
    setOpen(false);
    setQ("");
  }

  return (
    <div ref={ref} className="relative">
      <Input
        className={invalid ? "border-red-500 focus:ring-red-400" : ""}
        value={q.length ? q : value}
        onChange={(e) => onChangeInput(e.target.value)}
        placeholder={placeholder ?? t("typeCityAirport")} />
      {open && (
        <Card className="absolute left-0 right-0 top-full mt-1 z-50 p-0">
          <ul className="max-h-60 overflow-auto divide-y">
            {items.map((a) => (
              <li key={a.iata}>
                <button type="button" className="w-full px-3 py-2 text-left hover:bg-zinc-50" onClick={() => select(a)}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{a.city} – {a.name}</div>
                      <div className="text-xs text-zinc-600">{a.country}</div>
                    </div>
                    <div className="text-sm font-semibold text-[var(--brand)]">{a.iata}</div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
