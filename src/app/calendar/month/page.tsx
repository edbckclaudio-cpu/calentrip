"use client";
import { useEffect, useMemo, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import Image from "next/image";
import { useI18n } from "@/lib/i18n";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DialogHeader } from "@/components/ui/dialog";
import { getTrips, TripItem, FlightNote } from "@/lib/trips-store";

type RecordItem = { kind: "activity" | "restaurant"; cityIdx: number; cityName: string; date: string; time?: string; title: string; files?: Array<{ name: string; type: string; size: number; dataUrl?: string }> };
type EventItem = { type: "flight" | "activity" | "restaurant" | "transport" | "stay"; label: string; date: string; time?: string; meta?: FlightNote | RecordItem | { city?: string; address?: string; kind: "checkin" | "checkout" } };

export default function MonthCalendarPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [sideOpen, setSideOpen] = useState(false);
  const [dayOpen, setDayOpen] = useState<string | null>(null);
  const { data: session, status } = useSession();
  const { lang } = useI18n();

  useEffect(() => {
    try {
      const list: EventItem[] = [];
      const trips: TripItem[] = getTrips();
      trips.forEach((t) => {
        if (t.flightNotes && t.flightNotes.length) {
          t.flightNotes.forEach((fn) => {
            const legLabel = fn.leg === "outbound" ? "Voo de ida" : "Voo de volta";
            list.push({ type: "flight", label: `${legLabel}: ${fn.origin} → ${fn.destination}`, date: fn.date, time: fn.departureTime || undefined, meta: fn });
          });
        } else {
          list.push({ type: "flight", label: t.title, date: t.date });
        }
      });
      const rawSummary = typeof window !== "undefined" ? localStorage.getItem("calentrip_trip_summary") : null;
      const summary = rawSummary ? (JSON.parse(rawSummary) as { cities?: Array<{ name?: string; checkin?: string; checkout?: string; address?: string }> }) : null;
      const cities = Array.isArray(summary?.cities) ? summary!.cities! : [];
      cities.forEach((c, i) => {
        const cityName = c.name || `Cidade ${i + 1}`;
        const addr = c.address || "(endereço não informado)";
        if (c.checkin) list.push({ type: "stay", label: `Check-in hospedagem: ${cityName} • Endereço: ${addr}`, date: c.checkin, time: "17:00", meta: { city: cityName, address: addr, kind: "checkin" } });
        if (c.checkout) list.push({ type: "stay", label: `Checkout hospedagem: ${cityName} • Endereço: ${addr}`, date: c.checkout, time: "09:00", meta: { city: cityName, address: addr, kind: "checkout" } });
      });
      const rawRecs = typeof window !== "undefined" ? localStorage.getItem("calentrip:entertainment:records") : null;
      const recs: RecordItem[] = rawRecs ? (JSON.parse(rawRecs) as RecordItem[]) : [];
      (recs || []).forEach((r) => list.push({ type: r.kind, label: r.kind === "activity" ? `Atividade: ${r.title}` : `Restaurante: ${r.title}`, date: r.date, time: r.time, meta: r }));
      const seen = new Set<string>();
      const unique = list.filter((e) => {
        const key = `${e.type}|${e.label}|${(e.date || "").trim()}|${(e.time || "").trim()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setEvents(unique);
    } catch {}
  }, []);

  const grouped = useMemo(() => {
    const g: Record<string, EventItem[]> = {};
    events.forEach((e) => { if (e.date) { const k = e.date; (g[k] ||= []).push(e); } });
    Object.keys(g).forEach((k) => g[k].sort((a, b) => ((a.time || "00:00").localeCompare(b.time || "00:00"))));
    return g;
  }, [events]);

  const tripMonth = useMemo(() => {
    const dates = events.map((e) => e.date).filter(Boolean).sort();
    const d0 = dates[0] || new Date().toISOString().slice(0, 10);
    const d = new Date(`${d0}T00:00:00`);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }, [events]);

  const monthDays = useMemo(() => {
    const y = tripMonth.getFullYear();
    const m = tripMonth.getMonth();
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0);
    const days: Array<{ date: string; label: string; enabled: boolean }> = [];
    for (let day = 1; day <= end.getDate(); day++) {
      const d = new Date(y, m, day);
      const iso = `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const enabled = Boolean(grouped[iso]);
      days.push({ date: iso, label: String(day), enabled });
    }
    const pad = (start.getDay() + 6) % 7; // Monday-first grid
    const pre = Array.from({ length: pad }, () => ({ date: "", label: "", enabled: false }));
    return [...pre, ...days];
  }, [tripMonth, grouped]);

  return (
    <div className="min-h-screen pl-14 pr-4 py-6 space-y-6">
      <div className={sideOpen ? "fixed left-0 top-0 bottom-0 z-40 w-56 border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black transition-all" : "fixed left-0 top-0 bottom-0 z-40 w-14 border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black transition-all"}>
        <div className="h-14 flex items-center justify-center border-b border-zinc-200 dark:border-zinc-800">
          <button type="button" className="rounded-md p-2" onClick={() => setSideOpen((v) => !v)}>
            <span className="material-symbols-outlined text-[24px]">menu</span>
          </button>
        </div>
        <div className="p-2 space-y-2">
          <div className="rounded-md border border-zinc-200 dark:border-zinc-800 p-2">
            {status === "authenticated" ? (
              <div className="flex items-center gap-2">
                {session?.user?.image ? (
                  <Image src={session.user.image} alt="avatar" width={32} height={32} className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-xs">{(session?.user?.name || session?.user?.email || "PF").slice(0, 2).toUpperCase()}</span>
                )}
                {sideOpen ? (
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{session?.user?.name || "Usuário"}</div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400">{session?.user?.email || ""}</div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-xs">PF</span>
                {sideOpen ? (
                  <div className="flex-1">
                    <div className="text-sm font-semibold">Entrar</div>
                    <div className="mt-2 flex items-center gap-2">
                      <button type="button" className="text-xs" onClick={() => signIn("google")}>Google</button>
                      <button type="button" className="text-xs" onClick={() => signIn("credentials", { email: "demo@calentrip.com", password: "demo", callbackUrl: "/flights/search" })}>Demo</button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
          <button type="button" className="flex w-full items-center gap-3 rounded-md px-3 h-10 hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={() => { try { window.location.href = "/calendar/final"; } catch {} }}>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800">
              <span className="material-symbols-outlined text-[22px]">list_alt</span>
            </span>
            {sideOpen ? <span className="text-sm font-medium">Calendário em lista</span> : null}
          </button>
        </div>
      </div>
      {sideOpen ? (<div className="fixed top-0 right-0 bottom-0 left-56 z-30 bg-black/10" onClick={() => setSideOpen(false)} />) : null}

      <div className="container-page">
        <h1 className="mb-1 text-2xl font-semibold text-[var(--brand)]">Calendário mensal</h1>
        <p className="text-sm text-zinc-600">Veja o mês da viagem. Somente as datas com eventos estão habilitadas.</p>
      </div>

      <div className="container-page">
        <Card>
          <CardHeader>
            <CardTitle>Mesma viagem</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2 text-sm">
              {monthDays.map((d, i) => (
                <button key={`d-${i}`} type="button" disabled={!d.date || !d.enabled} className={!d.date ? "h-10 rounded border border-transparent" : d.enabled ? "h-10 rounded border border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800" : "h-10 rounded border border-zinc-200 text-zinc-400 dark:border-zinc-800"} onClick={() => setDayOpen(d.date)}>
                  {d.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {dayOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDayOpen(null)} />
          <div className="absolute bottom-0 left-0 right-0 z-10 w-full rounded-t-2xl border border-zinc-200 bg-white p-5 md:p-6 shadow-xl dark:border-zinc-800 dark:bg-black">
            <DialogHeader>Atividades do dia</DialogHeader>
            <div className="space-y-3 text-sm max-h-[60vh] overflow-y-auto">
              {grouped[dayOpen!] && grouped[dayOpen!].length ? (
                <ul className="space-y-2">
                  {grouped[dayOpen!].map((e, idx) => (
                    <li key={`ev-${idx}`} className="rounded border p-2">
                      <div className="font-medium">{e.time || ""} • {e.label}</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-zinc-600">Sem eventos neste dia.</div>
              )}
              <div className="mt-3 flex items-center justify-between">
                <Button type="button" variant="outline" onClick={() => { try { window.location.href = "/calendar/final"; } catch {} }}>Voltar para calendário em lista</Button>
                <Button type="button" className="h-10 rounded-lg font-semibold tracking-wide" onClick={() => setDayOpen(null)}>Fechar</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
