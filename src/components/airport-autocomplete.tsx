"use client";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { searchAirportsAsync, Airport } from "@/lib/airports";
import { useI18n } from "@/lib/i18n";

export default function AirportAutocomplete({ value, onSelect, placeholder, invalid, onFocus }: { value: string; onSelect: (iata: string) => void; placeholder?: string; invalid?: boolean; onFocus?: () => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Airport[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useI18n();
  const portalRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null);
  const [dir, setDir] = useState<"down" | "up">("down");
  const [dropdownH, setDropdownH] = useState<number>(240);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      const insideInput = !!ref.current && ref.current.contains(t);
      const insidePortal = !!portalRef.current && portalRef.current.contains(t);
      if (!insideInput && !insidePortal) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    function updatePos() {
      const el = ref.current;
      if (!el) { setPos(null); return; }
      const r = el.getBoundingClientRect();
      setPos({ left: Math.round(r.left), top: Math.round(r.bottom), width: Math.round(r.width) });
      const above = Math.round(r.top);
      const below = Math.round(window.innerHeight - r.bottom);
      const need = 260;
      setDir(above > below && above >= need ? "up" : "down");
    }
    if (open) {
      updatePos();
      window.addEventListener("scroll", updatePos, true);
      window.addEventListener("resize", updatePos);
      return () => {
        window.removeEventListener("scroll", updatePos, true);
        window.removeEventListener("resize", updatePos);
      };
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      const box = portalRef.current;
      if (box) {
        const rect = box.getBoundingClientRect();
        if (rect.height) setDropdownH(Math.min(Math.round(rect.height), 240));
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [open, items.length, pos]);

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
        onFocus={onFocus}
        placeholder={placeholder ?? t("typeCityAirport")} />
      {open && pos && createPortal(
        <div
          ref={portalRef}
          style={{
            position: "fixed",
            left: pos.left,
            top: dir === "down" ? pos.top + 8 : Math.max(pos.top - dropdownH - 8, 0),
            width: pos.width,
            zIndex: 1000,
          }}
          className="relative"
        >
          {dir === "down" ? (
            <span className="absolute -top-2 left-4 w-0 h-0 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-white dark:border-b-black" />
          ) : (
            <span className="absolute -bottom-2 left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-white dark:border-t-black" />
          )}
          <Card className={dir === "up" ? "p-0 shadow-xl" : "p-0 shadow-lg"}>
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
        </div>,
        document.body
      )}
    </div>
  );
}
