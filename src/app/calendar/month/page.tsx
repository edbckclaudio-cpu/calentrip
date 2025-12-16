"use client";
import { useEffect, useMemo, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { isTripPremium } from "@/lib/premium";
import Image from "next/image";
import { useI18n } from "@/lib/i18n";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DialogHeader } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { TripItem, FlightNote, getSavedTrips, getTripEvents, updateTrip, migrateFromLocalStorage } from "@/lib/trips-db";
import { alarmForEvent } from "@/lib/ics";

type RecordItem = { kind: "activity" | "restaurant"; cityIdx: number; cityName: string; date: string; time?: string; title: string; files?: Array<{ name: string; type: string; size: number; dataUrl?: string }> };
type TransportSegmentMeta = { mode: "air" | "train" | "bus" | "car"; dep: string; arr: string; depTime?: string; arrTime?: string; originAddress?: string; originCity?: string };
type EventItem = { type: "flight" | "activity" | "restaurant" | "transport" | "stay"; label: string; date: string; time?: string; meta?: FlightNote | RecordItem | TransportSegmentMeta | { city?: string; address?: string; kind: "checkin" | "checkout" } };

export default function MonthCalendarPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [sideOpen, setSideOpen] = useState(false);
  const [dayOpen, setDayOpen] = useState<string | null>(null);
  const { data: session, status } = useSession();
  const { lang, t } = useI18n();
  const [gating, setGating] = useState<{ show: boolean; reason: "anon" | "noPremium" } | null>(null);
  const { show } = useToast();
  const [premiumFlag, setPremiumFlag] = useState(false);
  const [premiumUntil, setPremiumUntil] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editDate, setEditDate] = useState<string>("");
  const [editTime, setEditTime] = useState<string>("");
  const [currentTripId, setCurrentTripId] = useState<string | null>(null);
  const [loadedFromSaved, setLoadedFromSaved] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);

  async function reloadFromStorage() {
    try {
      const trips: TripItem[] = await getSavedTrips();
      let target: TripItem | null = null;
      try {
        const raw = typeof window !== "undefined" ? (sessionStorage.getItem("calentrip:tripSearch") || localStorage.getItem("calentrip:tripSearch")) : null;
        const ts = raw ? JSON.parse(raw) : null;
        if (ts) {
          const isSame = ts.mode === "same";
          const origin = isSame ? ts.origin : ts.outbound?.origin;
          const destination = isSame ? ts.destination : ts.outbound?.destination;
          const date = isSame ? ts.departDate : ts.outbound?.date;
          const pax = (() => { const p = ts.passengers || {}; return Number(p.adults || 0) + Number(p.children || 0) + Number(p.infants || 0); })();
          const title = origin && destination ? `${origin} → ${destination}` : "";
          target = trips.find((t) => t.title === title && t.date === date && Number(t.passengers || 0) === pax) || null;
        }
      } catch {}
      if (!target) {
        const actives = trips.filter((t) => t.reachedFinalCalendar);
        target = actives.length ? actives[actives.length - 1] : (trips.length ? trips[0] : null);
      }
      const list: EventItem[] = [];
      if (target) {
        const dbEvents = await getTripEvents(target.id);
        if (dbEvents.length) dbEvents.forEach((e) => list.push({ type: (e.type as unknown as EventItem["type"]) || "activity", label: e.label || e.name, date: e.date, time: e.time }));
        else list.push({ type: "flight", label: target.title, date: target.date });
      }
      const rawSummary = typeof window !== "undefined" ? localStorage.getItem("calentrip_trip_summary") : null;
      const summary = rawSummary ? (JSON.parse(rawSummary) as { cities?: Array<{ name?: string; checkin?: string; checkout?: string; address?: string; transportToNext?: TransportSegmentMeta }> }) : null;
      const cities = Array.isArray(summary?.cities) ? summary!.cities! : [];
      cities.forEach((c, i) => {
        const cityName = c.name || `Cidade ${i + 1}`;
        const addr = c.address || "(endereço não informado)";
        if (c.checkin) list.push({ type: "stay", label: `Check-in hospedagem: ${cityName} • Endereço: ${addr}`, date: c.checkin, time: "14:00", meta: { city: cityName, address: addr, kind: "checkin" } });
        if (c.checkout) list.push({ type: "stay", label: `Checkout hospedagem: ${cityName} • Endereço: ${addr}`, date: c.checkout, time: "11:00", meta: { city: cityName, address: addr, kind: "checkout" } });
      });
      for (let i = 0; i < cities.length - 1; i++) {
        const c = cities[i];
        const n = cities[i + 1];
        const seg = c.transportToNext;
        if (seg) {
          const label = `Transporte: ${(c.name || `Cidade ${i + 1}`)} → ${(n?.name || `Cidade ${i + 2}`)} • ${(seg.mode || "").toUpperCase()}`;
          const date = c.checkout || n?.checkin || "";
          const time = seg.depTime || "11:00";
          list.push({ type: "transport", label, date, time, meta: { ...seg, originAddress: c.address, originCity: c.name } });
        }
      }
      const rawRecs = typeof window !== "undefined" ? localStorage.getItem("calentrip:entertainment:records") : null;
      const recs: RecordItem[] = rawRecs ? (JSON.parse(rawRecs) as RecordItem[]) : [];
      (recs || []).forEach((r) => list.push({ type: r.kind, label: r.kind === "activity" ? `Atividade: ${r.title} (${r.cityName})` : `Restaurante: ${r.title} (${r.cityName})`, date: r.date, time: r.time, meta: r }));
      const seen = new Set<string>();
      const unique = list.filter((e) => {
        const key = e.type === "stay" ? `${e.type}|${e.label}|${(e.date || "").trim()}` : `${e.type}|${e.label}|${(e.date || "").trim()}|${(e.time || "").trim()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setEvents(unique);
      show("Calendário recarregado do storage", { variant: "success" });
    } catch {
      show("Falha ao recarregar do storage", { variant: "error" });
    }
  }
  async function exportICS() {
    function fmtUTC(d: Date) {
      const y = String(d.getUTCFullYear());
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const da = String(d.getUTCDate()).padStart(2, "0");
      const h = String(d.getUTCHours()).padStart(2, "0");
      const mi = String(d.getUTCMinutes()).padStart(2, "0");
      const s = "00";
      return `${y}${m}${da}T${h}${mi}${s}Z`;
    }
    function fmt(d: Date) {
      const y = String(d.getFullYear());
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const da = String(d.getDate()).padStart(2, "0");
      const h = String(d.getHours()).padStart(2, "0");
      const mi = String(d.getMinutes()).padStart(2, "0");
      const s = "00";
      return `${y}${m}${da}T${h}${mi}${s}`;
    }
    function parseDT(date: string, time?: string) {
      const t = (time || "00:00").padStart(5, "0");
      const s = `${(date || "").replace(/\//g, "-")}T${t}:00`;
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) return null;
      return d;
    }
    function escText(s: string) {
      return s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
    }
    function toAscii(s: string) {
      try {
        const base = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return base.replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();
      } catch {
        return s.replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();
      }
    }
    function limit(s: string, n = 320) {
      if (!s) return s;
      return s.length > n ? s.slice(0, n - 1) + "…" : s;
    }
    function foldLine(s: string) {
      const max = 74;
      if (s.length <= max) return s;
      const parts: string[] = [];
      for (let i = 0; i < s.length; i += max) parts.push(s.slice(i, i + max));
      return parts.join("\r\n ");
    }
    const tzHeader = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "Etc/UTC"; } catch { return "Etc/UTC"; } })();
    const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
    const isAndroidHeader = /Android/.test(ua);
    const useTZID = !isAndroidHeader;
    const lines: string[] = [];
    lines.push("BEGIN:VCALENDAR");
    lines.push("VERSION:2.0");
    lines.push("PRODID:-//CalenTrip//Calendar Export//PT");
    lines.push("CALSCALE:GREGORIAN");
    lines.push("METHOD:PUBLISH");
    lines.push("X-WR-CALNAME:CalenTrip");
    if (useTZID) {
      lines.push(`X-WR-TIMEZONE:${tzHeader}`);
      const mins = -new Date().getTimezoneOffset();
      const sign = mins >= 0 ? "+" : "-";
      const abs = Math.abs(mins);
      const hh = String(Math.floor(abs / 60)).padStart(2, "0");
      const mm = String(abs % 60).padStart(2, "0");
      const off = `${sign}${hh}${mm}`;
      lines.push("BEGIN:VTIMEZONE");
      lines.push(`TZID:${tzHeader}`);
      lines.push("BEGIN:STANDARD");
      lines.push("DTSTART:19700101T000000");
      lines.push(`TZOFFSETFROM:${off}`);
      lines.push(`TZOFFSETTO:${off}`);
      lines.push("END:STANDARD");
      lines.push("END:VTIMEZONE");
    }
    events.forEach((e, idx) => {
      const start = parseDT(e.date, e.time);
      const end = start ? new Date(start.getTime() + 60 * 60 * 1000) : null;
      const baseTitle = isAndroidHeader ? limit(e.label, 64) : limit(e.label, 120);
      const title = isAndroidHeader ? toAscii(baseTitle) : baseTitle;
      const desc = isAndroidHeader ? limit(e.label, 160) : limit(e.label, 280);
      lines.push("BEGIN:VEVENT");
      const uid = `month-${idx}-${start ? fmt(start) : String(Date.now())}@calentrip`;
      if (start) lines.push(useTZID ? `DTSTART;TZID=${tzHeader}:${fmt(start)}` : `DTSTART:${fmtUTC(start)}`);
      if (end) lines.push(useTZID ? `DTEND;TZID=${tzHeader}:${fmt(end)}` : `DTEND:${fmtUTC(end)}`);
      lines.push(`DTSTAMP:${fmtUTC(new Date())}`);
      lines.push(`UID:${uid}`);
      lines.push(`SUMMARY:${escText(title)}`);
      lines.push("TRANSP:OPAQUE");
      lines.push("SEQUENCE:0");
      lines.push("STATUS:CONFIRMED");
      lines.push(`DESCRIPTION:${escText(desc)}`);
      const alarmLines = alarmForEvent(e.type, !!(e.time && e.time.trim()), start);
      for (const L of alarmLines) lines.push(L);
      lines.push("END:VEVENT");
    });
    lines.push("END:VCALENDAR");
    const crlf = lines.map(foldLine).join("\r\n") + "\r\n";
    const blob = new Blob([crlf], { type: "text/calendar;charset=utf-8" });
    const file = new File([crlf], "calentrip.ics", { type: "text/calendar;charset=utf-8" });
    try {
      const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean; share?: (data: ShareData) => Promise<void> };
      const canShareFiles = typeof nav !== "undefined" && typeof nav.canShare === "function" && nav.canShare({ files: [file] });
      if (canShareFiles && typeof nav.share === "function") {
        await nav.share({ files: [file], title: "CalenTrip" });
        const ua2 = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
        const isIOS = /iPad|iPhone|iPod/.test(ua2) || (ua2.includes("Macintosh") && typeof window !== "undefined" && "ontouchend" in window);
        const isAndroid = /Android/.test(ua2);
        if (isIOS) {
          show(t("iosCalendarSentMsg"), { variant: "success" });
        } else if (isAndroid) {
          show(t("androidCalendarSentMsg"), { variant: "success" });
        } else {
          show(t("systemCalendarSentMsg"), { variant: "success" });
        }
        return;
      }
    } catch {}
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "calentrip.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    show(t("icsDownloadedMsg"), { variant: "info" });
  }

  useEffect(() => {
    (async () => { try { await migrateFromLocalStorage(); } catch {} })();
  }, []);

  useEffect(() => {
    try {
      const auto = typeof window !== "undefined" ? localStorage.getItem("calentrip:auto_load_saved") : null;
      const raw = typeof window !== "undefined" ? localStorage.getItem("calentrip:saved_calendar") : null;
      if (auto === "1" && raw) {
        const sc = JSON.parse(raw) as { name?: string; events?: EventItem[] };
        if (sc?.events && sc.events.length) {
          const norm = sc.events.map((e) => {
            if (e.type === "stay") {
              const kind = (e.meta as { kind?: string } | undefined)?.kind;
              const t = kind === "checkin" ? "14:00" : kind === "checkout" ? "11:00" : (e.time || undefined);
              return { ...e, time: t };
            }
            return e;
          });
          setEvents(norm);
          setLoadedFromSaved(true);
          setGating(null);
        }
        try { localStorage.removeItem("calentrip:auto_load_saved"); } catch {}
      }
    } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      try {
        if (loadedFromSaved) return;
        const trips: TripItem[] = await getSavedTrips();
        let target: TripItem | null = null;
        try {
          const raw = typeof window !== "undefined" ? (sessionStorage.getItem("calentrip:tripSearch") || localStorage.getItem("calentrip:tripSearch")) : null;
          const ts = raw ? JSON.parse(raw) : null;
          if (ts) {
            const isSame = ts.mode === "same";
            const origin = isSame ? ts.origin : ts.outbound?.origin;
            const destination = isSame ? ts.destination : ts.outbound?.destination;
            const date = isSame ? ts.departDate : ts.outbound?.date;
            const pax = (() => { const p = ts.passengers || {}; return Number(p.adults || 0) + Number(p.children || 0) + Number(p.infants || 0); })();
            const title = origin && destination ? `${origin} → ${destination}` : "";
            target = trips.find((t) => t.title === title && t.date === date && Number(t.passengers || 0) === pax) || null;
          }
        } catch {}
        if (!target) {
          const actives = trips.filter((t) => t.reachedFinalCalendar);
          target = actives.length ? actives[actives.length - 1] : (trips.length ? trips[0] : null);
        }
        if (target) {
          const premium = isTripPremium(target.id);
          setPremiumFlag(premium);
          setCurrentTripId(target.id);
          try {
            const rawP = typeof window !== "undefined" ? localStorage.getItem("calentrip:premium") : null;
            const listP: Array<{ tripId: string; expiresAt: number }> = rawP ? JSON.parse(rawP) : [];
            const rec = listP.find((r) => r.tripId === "global" && r.expiresAt > Date.now());
            if (rec) { const d = new Date(rec.expiresAt); const dd = String(d.getDate()).padStart(2, "0"); const mm = String(d.getMonth() + 1).padStart(2, "0"); setPremiumUntil(`${dd}/${mm}`); } else setPremiumUntil("");
          } catch { setPremiumUntil(""); }
          if (status !== "authenticated") setGating({ show: true, reason: "anon" });
          else if (!premium) setGating({ show: true, reason: "noPremium" });
          else setGating(null);
        }
        const dbEvents = target ? await getTripEvents(target.id) : [];
        if (dbEvents.length) {
          const mapped = dbEvents.map((e) => {
            const type = (e.type as unknown as EventItem["type"]) || "activity";
            const label = e.label || e.name;
            let time = e.time;
            if (type === "stay") {
              const isCheckin = (label || "").toLowerCase().includes("check-in");
              const isCheckout = (label || "").toLowerCase().includes("checkout");
              time = isCheckin ? "14:00" : isCheckout ? "11:00" : time;
            }
            return { type, label, date: e.date, time };
          });
          if (loadedFromSaved) return;
          setEvents(mapped);
          setGating(null);
          return;
        }
        const list: EventItem[] = [];
        const tripsForList = target ? [target] : trips;
        const addDays = (d: string, days: number) => { const dt = new Date(`${d}T00:00:00`); if (Number.isNaN(dt.getTime())) return d; dt.setDate(dt.getDate() + days); const p = (n: number) => String(n).padStart(2, "0"); return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`; };
        tripsForList.forEach((t) => {
          if (t.flightNotes && t.flightNotes.length) {
            t.flightNotes.forEach((fn) => {
              const legLabel = fn.leg === "outbound" ? "Voo de ida" : "Voo de volta";
              list.push({ type: "flight", label: `${legLabel}: ${fn.origin} → ${fn.destination}`, date: fn.date, time: fn.departureTime || undefined, meta: fn });
              if (fn.arrivalTime) {
                const arrDate = fn.arrivalNextDay ? addDays(fn.date, 1) : fn.date;
                const arrLabel = fn.leg === "outbound" ? "Chegada voo de ida" : "Chegada voo de volta";
                list.push({ type: "flight", label: `${arrLabel}: ${fn.destination}`, date: arrDate, time: fn.arrivalTime || undefined, meta: fn });
              }
            });
          } else {
            list.push({ type: "flight", label: t.title, date: t.date });
          }
        });
        const rawSummary = typeof window !== "undefined" ? localStorage.getItem("calentrip_trip_summary") : null;
        const summary = rawSummary ? (JSON.parse(rawSummary) as { cities?: Array<{ name?: string; checkin?: string; checkout?: string; address?: string; transportToNext?: TransportSegmentMeta }> }) : null;
        const cities = Array.isArray(summary?.cities) ? summary!.cities! : [];
        cities.forEach((c, i) => {
          const cityName = c.name || `Cidade ${i + 1}`;
          const addr = c.address || "(endereço não informado)";
          if (c.checkin) list.push({ type: "stay", label: `Check-in hospedagem: ${cityName} • Endereço: ${addr}`, date: c.checkin, time: "14:00", meta: { city: cityName, address: addr, kind: "checkin" } });
          if (c.checkout) list.push({ type: "stay", label: `Checkout hospedagem: ${cityName} • Endereço: ${addr}`, date: c.checkout, time: "11:00", meta: { city: cityName, address: addr, kind: "checkout" } });
        });
        for (let i = 0; i < cities.length - 1; i++) {
          const c = cities[i];
          const n = cities[i + 1];
          const seg = c.transportToNext;
          if (seg) {
            const label = `Transporte: ${(c.name || `Cidade ${i + 1}`)} → ${(n?.name || `Cidade ${i + 2}`)} • ${(seg.mode || "").toUpperCase()}`;
            const date = c.checkout || n?.checkin || "";
            const time = seg.depTime || "11:00";
            list.push({ type: "transport", label, date, time, meta: { ...seg, originAddress: c.address, originCity: c.name } });
          }
        }
        const rawRecs = typeof window !== "undefined" ? localStorage.getItem("calentrip:entertainment:records") : null;
        const recs: RecordItem[] = rawRecs ? (JSON.parse(rawRecs) as RecordItem[]) : [];
        (recs || []).forEach((r) => list.push({ type: r.kind, label: r.kind === "activity" ? `Atividade: ${r.title} (${r.cityName})` : `Restaurante: ${r.title} (${r.cityName})`, date: r.date, time: r.time, meta: r }));
        const seen = new Set<string>();
        const unique = list.filter((e) => {
          const key = e.type === "stay"
            ? `${e.type}|${e.label}|${(e.date || "").trim()}`
            : `${e.type}|${e.label}|${(e.date || "").trim()}|${(e.time || "").trim()}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        if (loadedFromSaved) return;
        setEvents(unique);
      } catch {}
    })();
  }, [status, loadedFromSaved]);

  useEffect(() => {
    (async () => {
      try {
        const raw = typeof window !== "undefined" ? (sessionStorage.getItem("calentrip:tripSearch") || localStorage.getItem("calentrip:tripSearch")) : null;
        const ts = raw ? JSON.parse(raw) : null;
        if (!ts) return;
        const isSame = ts.mode === "same";
        const origin = isSame ? ts.origin : ts.outbound?.origin;
        const destination = isSame ? ts.destination : ts.outbound?.destination;
        const date = isSame ? ts.departDate : ts.outbound?.date;
        const pax = (() => {
          const p = ts.passengers || {};
          return Number(p.adults || 0) + Number(p.children || 0) + Number(p.infants || 0);
        })();
        if (!origin || !destination || !date) return;
        const title = `${origin} → ${destination}`;
        const trips: TripItem[] = await getSavedTrips();
        const idx = trips.findIndex((t) => t.title === title && t.date === date && t.passengers === pax);
        if (idx < 0) return;
        await updateTrip(trips[idx].id, { reachedFinalCalendar: true });
      } catch {}
    })();
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

  const travelDates = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => { if (e.type === "flight" && e.date) set.add(e.date); });
    return set;
  }, [events]);

  const monthLabel = useMemo(() => {
    const loc = lang === "pt" ? "pt-BR" : lang === "es" ? "es-ES" : "en-US";
    return new Intl.DateTimeFormat(loc, { month: "long", year: "numeric" }).format(tripMonth);
  }, [tripMonth, lang]);

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

  const dayTitle = useMemo(() => {
    if (!dayOpen) return "Atividades do dia";
    const loc = lang === "pt" ? "pt-BR" : lang === "es" ? "es-ES" : "en-US";
    const d = new Date(`${dayOpen}T00:00:00`);
    if (Number.isNaN(d.getTime())) return "Atividades do dia";
    const dayNum = String(d.getDate());
    const dow = new Intl.DateTimeFormat(loc, { weekday: "long" }).format(d);
    return `Atividades do dia: ${dayNum} • ${dow}`;
  }, [dayOpen, lang]);

  function changeDay(delta: number) {
    if (!dayOpen) return;
    const d = new Date(`${dayOpen}T00:00:00`);
    if (Number.isNaN(d.getTime())) return;
    const y = tripMonth.getFullYear();
    const m = tripMonth.getMonth();
    const next = new Date(d);
    next.setDate(next.getDate() + delta);
    if (next.getFullYear() !== y || next.getMonth() !== m) return;
    const p = (n: number) => String(n).padStart(2, "0");
    setDayOpen(`${next.getFullYear()}-${p(next.getMonth() + 1)}-${p(next.getDate())}`);
  }

  return (
    <div className="min-h-screen pl-14 pr-4 py-6 space-y-6">
      {gating?.show ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="max-w-md w-full bg-white rounded-xl p-5 space-y-3">
            <div className="text-lg font-semibold">{gating.reason === "anon" ? "Faça login para desbloquear" : "Assinatura necessária"}</div>
            <div className="text-sm text-zinc-700">
              {gating.reason === "anon" ? (
                <div>{t("loginUnlockText")}</div>
              ) : (
                <div>{t("subMonthlyText")}</div>
              )}
            </div>
            <div className="flex gap-2 mt-2">
              {gating.reason === "anon" ? (
                <>
                  <button type="button" className="btn" onClick={() => signIn("google")}>Entrar com Google</button>
                  <button type="button" className="btn" onClick={() => signIn("credentials", { email: "demo@calentrip.com", password: "demo", callbackUrl: "/calendar/month" })}>Entrar Demo</button>
                </>
              ) : (
                <button type="button" className="btn" onClick={() => { try { window.location.href = "/profile"; } catch {} }}>{t("subscribeMonthlyButton")}</button>
              )}
            </div>
          </div>
        </div>
      ) : null}
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
                    <div className="mt-1 text-[10px] text-zinc-500">{t("planWord")}: {premiumFlag ? `${t("premiumWord")}${premiumUntil ? ` ${t("untilWord")} ${premiumUntil}` : ""}` : t("freeWord")}</div>
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
        <button type="button" className="flex w-full items-center gap-3 rounded-md px-3 h-10 hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={() => { try { localStorage.setItem("calentrip:saved_calendar", JSON.stringify({ events })); localStorage.setItem("calentrip:auto_load_saved", "1"); } catch {} try { window.location.href = "/calendar/final"; } catch {} }}>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800">
            <span className="material-symbols-outlined text-[22px] text-[#007AFF]">list_alt</span>
          </span>
          {sideOpen ? <span className="text-sm font-medium">Calendário em lista</span> : null}
        </button>
        <button type="button" className="flex w-full items-center gap-3 rounded-md px-3 h-10 hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={reloadFromStorage}>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800">
            <span className="material-symbols-outlined text-[22px] text-[#007AFF]">refresh</span>
          </span>
          {sideOpen ? <span className="text-sm font-medium">Recarregar do storage</span> : null}
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-md px-3 h-10 hover:bg-zinc-50 dark:hover:bg-zinc-900"
          onClick={async () => {
            try {
              const payload = { events };
              if (typeof window !== "undefined") localStorage.setItem("calentrip:saved_calendar", JSON.stringify(payload));
              try {
                const raw = typeof window !== "undefined" ? localStorage.getItem("calentrip:tripSearch") : null;
                const ts = raw ? JSON.parse(raw) : null;
                if (ts) {
                  const isSame = ts.mode === "same";
                  const origin = isSame ? ts.origin : ts.outbound?.origin;
                  const destination = isSame ? ts.destination : ts.outbound?.destination;
                  const date = isSame ? ts.departDate : ts.outbound?.date;
                  if (origin && destination && date) {
                    if (currentTripId) { await updateTrip(currentTripId, { reachedFinalCalendar: true }); }
                  }
                }
              } catch {}
              try { localStorage.setItem("calentrip:open_calendar_help", "1"); } catch {}
              show(t("savedInSearchesMsg"), { variant: "success" });
              try { localStorage.setItem("calentrip:saved_calendar", JSON.stringify({ events })); localStorage.setItem("calentrip:auto_load_saved", "1"); } catch {} try { window.location.href = "/calendar/final"; } catch {}
            } catch { show(t("saveErrorMsg"), { variant: "error" }); }
          }}
          disabled={!premiumFlag}
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800">
            <span className="material-symbols-outlined text-[22px] text-[#007AFF]">bookmark_add</span>
          </span>
          {sideOpen ? <span className="text-sm font-medium">{t("saveCalendarButton")}</span> : null}
        </button>
      </div>
    </div>
      {sideOpen ? (<div className="fixed top-0 right-0 bottom-0 left-56 z-30 bg-black/10" onClick={() => setSideOpen(false)} />) : null}

  <div className="container-page">
        <div className="sticky top-0 z-30 -mt-4 mb-2 px-3 py-2 bg-white/80 dark:bg-black/60 backdrop-blur border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-2">
          <Button type="button" variant="outline" className="px-2 py-1 text-xs rounded-md" onClick={() => { try { localStorage.setItem("calentrip:saved_calendar", JSON.stringify({ events })); localStorage.setItem("calentrip:auto_load_saved", "1"); } catch {} try { window.close(); } catch {} try { window.location.href = "/calendar/final"; } catch {} }}>
            <span className="material-symbols-outlined text-[18px] mr-1">list_alt</span>
            Voltar para lista
          </Button>
          <Button type="button" className="px-2 py-1 text-xs rounded-md" onClick={exportICS}>
            <span className="material-symbols-outlined text-[18px] mr-1">download</span>
            Exportar .ics
          </Button>
        </div>
        <h1 className="mb-1 text-2xl font-semibold text-[var(--brand)]">Calendário da viagem</h1>
        <div className="text-sm text-zinc-700 dark:text-zinc-300">{monthLabel}</div>
        
        <div className="mt-2 flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <span className="material-symbols-outlined text-[18px] text-[#febb02]">sticky_note_2</span>
          <span>
            Toque em uma data para ver atividades e detalhes. Datas com eventos têm anel amarelo; dias de voo aparecem destacados.
          </span>
        </div>
      </div>

      <div className="container-page">
        <div className="mb-2 flex items-center gap-3 text-xs">
          <div className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-[#007AFF]"></span><span>Voo</span></div>
          <div className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-[#febb02]"></span><span>{t("accommodationDialogTitle")}</span></div>
          <div className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-[#34c759]"></span><span>Atividades</span></div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Mesma viagem</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2 text-sm">
              {monthDays.map((d, i) => {
                const isTravel = !!(d.date && travelDates.has(d.date));
                const hasEvent = !!d.enabled && !!d.date;
                const base = "h-10 rounded relative";
                const ring = hasEvent ? " border-2 border-[#febb02]" : " border border-zinc-200 dark:border-zinc-800";
                const bg = isTravel ? " bg-[#007AFF] text-white" : hasEvent ? " hover:bg-zinc-50 dark:hover:bg-zinc-900" : " text-zinc-400";
                const cls = !d.date ? "h-10 rounded border border-transparent" : `${base}${ring}${bg}`;
                const types = d.date && grouped[d.date] ? Array.from(new Set(grouped[d.date].map((e) => e.type))) : [];
                return (
                  <button key={`d-${i}`} type="button" disabled={!d.date || !hasEvent} className={cls} onClick={() => setDayOpen(d.date)}>
                    {d.label}
                    {types.length ? (
                      <div className="absolute right-1 bottom-1 flex gap-1">
                        {types.includes("flight") ? <span className="inline-block w-2 h-2 rounded-full bg-[#007AFF]"></span> : null}
                        {types.includes("stay") ? <span className="inline-block w-2 h-2 rounded-full bg-[#febb02]"></span> : null}
                        {(types.includes("activity") || types.includes("restaurant")) ? <span className="inline-block w-2 h-2 rounded-full bg-[#34c759]"></span> : null}
                        {types.includes("transport") ? <span className="inline-block w-2 h-2 rounded-full bg-[#007AFF]"></span> : null}
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {dayOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDayOpen(null)} />
          <div className="absolute bottom-0 left-0 right-0 z-10 w-full rounded-t-2xl border border-zinc-200 bg-white p-5 md:p-6 shadow-xl dark:border-zinc-800 dark:bg-black" onTouchStart={(e) => setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY })} onTouchEnd={(e) => { if (!touchStart) return; const dx = e.changedTouches[0].clientX - touchStart.x; const dy = e.changedTouches[0].clientY - touchStart.y; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { if (dx < 0) changeDay(1); else changeDay(-1); } setTouchStart(null); }}>
            <DialogHeader>{dayTitle}</DialogHeader>
            <div className="space-y-3 text-sm max-h-[65vh] overflow-y-auto">
              {grouped[dayOpen!] && grouped[dayOpen!].length ? (
                <div className="grid grid-cols-[56px_1fr] gap-x-3">
                  {(() => {
                    const parseH = (t?: string) => { const s = (t || "00:00").padStart(5, "0"); const h = Number(s.slice(0, 2)); return Number.isFinite(h) ? h : 0; };
                    const dayEvs = grouped[dayOpen!]!.slice().sort((a, b) => ((a.time || "00:00").localeCompare(b.time || "00:00")));
                    const minH = Math.max(0, Math.min(...dayEvs.map((e) => parseH(e.time)), 8));
                    const maxH = Math.min(23, Math.max(...dayEvs.map((e) => parseH(e.time)), 18));
                    const startH = Math.min(minH, 7);
                    const endH = Math.max(maxH, 21);
                    const hours: number[] = []; for (let h = startH; h <= endH; h++) hours.push(h);
                    const iconOf = (e: EventItem) => (e.type === "flight" ? "local_airport" : e.type === "transport" ? "transfer_within_a_station" : e.type === "stay" ? "home" : "event");
                    const accentOf = (e: EventItem) => (e.type === "flight" ? "border-l-[#007AFF]" : e.type === "transport" ? "border-l-[#007AFF]" : e.type === "stay" ? "border-l-[#febb02]" : "border-l-[#34c759]");
                    return hours.flatMap((h, idxH) => {
                      const label = `${String(h).padStart(2, "0")}:00`;
                      const evsAt = dayEvs.filter((e) => parseH(e.time) === h);
                      return [
                        <div key={`hl-${idxH}`} className="text-xs text-zinc-500">{label}</div>,
                        <div key={`hc-${idxH}`} className="space-y-2">
                          {evsAt.length ? evsAt.map((e, idxE) => {
                            const icon = iconOf(e);
                            const accent = accentOf(e);
                            const isRec = e.type === "activity" || e.type === "restaurant";
                            const time = (e.time || "00:00").padStart(5, "0");
                            return (
                              <div key={`ev-${idxH}-${idxE}`} className={`rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 flex items-start justify-between gap-3 border-l-4 ${accent}`}>
                                <div className="leading-relaxed">
                                  <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                                    <span className="material-symbols-outlined text-[16px]">{icon}</span>
                                    <span>{time}</span>
                                  </div>
                                  <div className="mt-1 text-sm">{e.label}</div>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {isRec ? (
                                    <>
                                      <Button type="button" variant="outline" disabled={!premiumFlag} className="px-2 py-1 text-xs rounded-md gap-1" onClick={() => { setEditIdx(idxE); setEditDate(e.date); setEditTime(e.time || ""); setEditOpen(true); }}>
                                        <span className="material-symbols-outlined text-[16px]">edit</span>
                                        <span>{t("editLabel")}</span>
                                      </Button>
                                      <Button type="button" variant="outline" className="px-2 py-1 text-xs rounded-md gap-1" onClick={() => { try { localStorage.setItem("calentrip:saved_calendar", JSON.stringify({ events })); localStorage.setItem("calentrip:auto_load_saved", "1"); } catch {} try { window.location.href = "/calendar/final"; } catch {} }}>
                                        <span className="material-symbols-outlined text-[16px]">map</span>
                                        <span>{t("goButton")}</span>
                                      </Button>
                                    </>
                                  ) : null}
                                </div>
                              </div>
                            );
                          }) : <div className="h-7"></div>}
                        </div>
                      ];
                    });
                  })()}
                </div>
              ) : (
                <div className="text-zinc-600">Sem eventos neste dia.</div>
              )}
              <div className="mt-3 flex items-center justify-between">
                <Button type="button" variant="outline" className="px-2 py-1 text-xs rounded-md" onClick={() => { try { localStorage.setItem("calentrip:saved_calendar", JSON.stringify({ events })); localStorage.setItem("calentrip:auto_load_saved", "1"); } catch {} try { window.location.href = "/calendar/final"; } catch {} }}>Calendário em lista</Button>
                <Button type="button" className="px-2 py-1 text-xs rounded-md" onClick={() => setDayOpen(null)}>{t("close")}</Button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div>
        <div>
          {/* Edit dialog */}
          {editOpen ? (
            <div className="fixed inset-0 z-50">
              <div className="absolute inset-0 bg-black/40" onClick={() => setEditOpen(false)} />
              <div className="absolute bottom-0 left-0 right-0 z-10 w-full rounded-t-2xl border border-zinc-200 bg-white p-5 md:p-6 shadow-xl dark:border-zinc-800 dark:bg-black">
                <DialogHeader>{t("editActivityTitle")}</DialogHeader>
                <div className="space-y-3 text-sm">
                  <div>
                    <label className="mb-1 block text-sm">Data</label>
                    <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm">Hora</label>
                    <Input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} />
                  </div>
                  <div className="flex justify-between">
                    <Button type="button" variant="outline" onClick={() => {
                      try {
                        if (editIdx === null) return;
                        const day = dayOpen!;
                        const indices = grouped[day].map((_, i) => i);
                        setEvents((prev) => prev.filter((e) => !(e.date === day && indices.includes(prev.indexOf(e)) && indices.indexOf(prev.indexOf(e)) === editIdx)));
                        setEditOpen(false);
                        setEditIdx(null);
                        show(t("activityDeletedMsg"), { variant: "success" });
                      } catch { show(t("deleteErrorMsg"), { variant: "error" }); }
                    }}>Excluir</Button>
                    <Button type="button" onClick={() => {
                      try {
                        if (editIdx === null) return;
                        const target = grouped[dayOpen!][editIdx];
                        let found = false;
                        setEvents((prev) => prev.map((e) => {
                          if (!found && e.type === target.type && e.label === target.label && e.date === target.date && (e.time || "") === (target.time || "")) {
                            found = true;
                            const nextMeta = e.meta;
                            return { ...e, date: editDate, time: editTime, meta: nextMeta };
                          }
                          return e;
                        }));
                        setEditOpen(false);
                        setEditIdx(null);
                        show(t("activityUpdatedMsg"), { variant: "success" });
                      } catch { show(t("saveErrorMsg"), { variant: "error" }); }
                    }}>{t("saveLabel")}</Button>
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <Button type="button" className="px-2 py-1 text-xs rounded-md" onClick={() => setEditOpen(false)}>{t("close")}</Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
