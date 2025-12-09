"use client";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import Image from "next/image";
import { useI18n } from "@/lib/i18n";
import { isTripPremium } from "@/lib/premium";
 
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { Calendar, isCapAndroid } from "@/capacitor/calendar";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { getTrips, TripItem, FlightNote } from "@/lib/trips-store";
import { getSavedTrips as getSavedTripsDb, getTripEvents as getTripEventsDb, migrateFromLocalStorage as migrateFromLocalStorageDb, initDatabase as initDatabaseDb, updateTrip as updateTripDb, saveCalendarEvents as saveCalendarEventsDb, addTrip as addTripDb, getRefAttachments } from "@/lib/trips-db";
import { findAirportByIata, searchAirportsAsync } from "@/lib/airports";
import { alarmForEvent } from "@/lib/ics";

type SavedFile = { name: string; type: string; size: number; id?: string; dataUrl?: string };
type RecordItem = { kind: "activity" | "restaurant"; cityIdx: number; cityName: string; date: string; time?: string; title: string; files?: SavedFile[] };

type EventItem = { type: "flight" | "activity" | "restaurant" | "transport" | "stay"; label: string; date: string; time?: string; meta?: FlightNote | RecordItem | TransportSegmentMeta | { city?: string; address?: string; kind: "checkin" | "checkout" } };
type TransportSegmentMeta = { mode: "air" | "train" | "bus" | "car"; dep: string; arr: string; depTime?: string; arrTime?: string; originAddress?: string; originCity?: string };
type CityPersist = { name?: string; checkin?: string; checkout?: string; address?: string; transportToNext?: TransportSegmentMeta; stayFiles?: SavedFile[] };

type TripSearchPersist = {
  mode: "same" | "different";
  origin?: string;
  destination?: string;
  departDate?: string;
  returnDate?: string;
  departTime?: string;
  returnTime?: string;
  passengers?: { adults?: number; children?: number; infants?: number };
  outbound?: { origin?: string; destination?: string; date?: string; time?: string };
  inbound?: { origin?: string; destination?: string; date?: string; time?: string };
};

function buildRome2RioUrl(args: { originName: string; destName: string; originLat?: number; originLon?: number; destLat?: number; destLon?: number; date?: string; time?: string; passengers?: number; lang?: string; currency?: string }) {
  const p = new URLSearchParams();
  p.set("lang", args.lang || "pt-BR");
  p.set("currency", args.currency || "BRL");
  if (args.date) p.set("date", args.date);
  if (args.time) p.set("time", args.time);
  if (args.passengers) p.set("passengers", String(args.passengers));
  if (args.originLat && args.originLon) { p.set("sLat", String(args.originLat)); p.set("sLng", String(args.originLon)); }
  if (args.destLat && args.destLon) { p.set("dLat", String(args.destLat)); p.set("dLng", String(args.destLon)); }
  const base = `https://www.rome2rio.com/s/${encodeURIComponent(args.originName)}/${encodeURIComponent(args.destName)}`;
  const q = p.toString();
  return q ? `${base}?${q}` : base;
}

export default function FinalCalendarPage() {
  
  const [events, setEvents] = useState<EventItem[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerData, setDrawerData] = useState<{ originIata: string; departureDate: string; departureTime: string } | null>(null);
  const [transportInfo, setTransportInfo] = useState<{ distanceKm?: number; durationMin?: number; durationWithTrafficMin?: number; gmapsUrl?: string; r2rUrl?: string; uberUrl?: string; airportName?: string; arrivalByTime?: string; callTime?: string; notifyAt?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [stayDrawerOpen, setStayDrawerOpen] = useState(false);
  const [stayLoading, setStayLoading] = useState(false);
  const [stayInfo, setStayInfo] = useState<{ origin?: string; destination?: string; distanceKm?: number; drivingMin?: number; walkingMin?: number; busMin?: number; trainMin?: number; uberUrl?: string; gmapsUrl?: string; r2rUrl?: string; mapUrl?: string; callTime?: string; notifyAt?: string } | null>(null);
  const [stayCandidates, setStayCandidates] = useState<Array<{ name: string; lat: number; lon: number }>>([]);
  const [stayChosenIdx, setStayChosenIdx] = useState<number | null>(null);
  const arrivalWatchIds = useRef<Record<string, number>>({});
  const arrivalNotified = useRef<Record<string, boolean>>({});
  const [arrivalDrawerOpen, setArrivalDrawerOpen] = useState(false);
  const [arrivalInfo, setArrivalInfo] = useState<{ city?: string; address?: string; distanceKm?: number; walkingMin?: number; drivingMin?: number; busMin?: number; trainMin?: number; priceEstimate?: number; uberUrl?: string; gmapsUrl?: string } | null>(null);
  const { show } = useToast();
  const toastOnce = useRef<Set<string>>(new Set());
  const showOnce = useCallback((message: string, opts?: { variant?: "info" | "success" | "error"; duration?: number; sticky?: boolean }) => {
    if (toastOnce.current.has(message)) return 0;
    toastOnce.current.add(message);
    const id = show(message, opts);
    try { setTimeout(() => { try { toastOnce.current.delete(message); } catch {} }, 15000); } catch {}
    return id;
  }, [show]);
  const [locConsent, setLocConsent] = useState<"granted" | "denied" | "skipped" | "default">("default");
  const [locModalOpen, setLocModalOpen] = useState(false);
  const [docOpen, setDocOpen] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docFiles, setDocFiles] = useState<SavedFile[]>([]);
  const [goDrawerOpen, setGoDrawerOpen] = useState(false);
  const [goLoading, setGoLoading] = useState(false);
  const [goInfo, setGoInfo] = useState<{ destination?: string; distanceKm?: number; walkingMin?: number; drivingMin?: number; busMin?: number; trainMin?: number; priceEstimate?: number; uberUrl?: string; gmapsUrl?: string } | null>(null);
  const [goRecord, setGoRecord] = useState<RecordItem | null>(null);
  const [summaryCities, setSummaryCities] = useState<Array<{ name?: string; checkin?: string; checkout?: string; address?: string; transportToNext?: TransportSegmentMeta; stayFiles?: SavedFile[] }>>([]);
  const [returnDrawerOpen, setReturnDrawerOpen] = useState(false);
  const [returnLoading, setReturnLoading] = useState(false);
  const [returnInfo, setReturnInfo] = useState<{ city?: string; address?: string; airportName?: string; distanceKm?: number; walkingMin?: number; drivingMin?: number; busMin?: number; trainMin?: number; priceEstimate?: number; uberUrl?: string; gmapsUrl?: string; r2rUrl?: string; callTime?: string; notifyAt?: string } | null>(null);
  const [returnFiles, setReturnFiles] = useState<Array<{ name: string; type: string; size: number; id?: string; dataUrl?: string }>>([]);
  const [outboundFiles, setOutboundFiles] = useState<Array<{ name: string; type: string; size: number; id?: string; dataUrl?: string }>>([]);
  const returnTimer = useRef<number | null>(null);
  const transportToastShown = useRef<{ arrival: boolean; return: boolean }>({ arrival: false, return: false });
  const [sideOpen, setSideOpen] = useState(false);
  const [calendarHelpOpen, setCalendarHelpOpen] = useState(false);
  const [savedDrawerOpen, setSavedDrawerOpen] = useState(false);
  const [savedTripsList, setSavedTripsList] = useState<TripItem[]>([]);
  const [savedCalendarsList, setSavedCalendarsList] = useState<Array<{ name: string; events: EventItem[]; savedAt?: string }>>([]);
  const [filesDrawerOpen, setFilesDrawerOpen] = useState(false);
  const [filesList, setFilesList] = useState<Array<{ name: string; size?: number; modified?: number }>>([]);
  const { data: session, status } = useSession();
  const { lang, t } = useI18n();
  const [gating, setGating] = useState<{ show: boolean; reason: "anon" | "noPremium"; tripId?: string } | null>(null);
  const [currentTripId, setCurrentTripId] = useState<string | null>(null);
  const [premiumFlag, setPremiumFlag] = useState<boolean>(false);
  const [premiumUntil, setPremiumUntil] = useState<string>("");
  const [currentSavedName, setCurrentSavedName] = useState<string>("");
  const [editOpen, setEditOpen] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editDate, setEditDate] = useState<string>("");
  const [editTime, setEditTime] = useState<string>("");

  async function saveCalendarToFile() {
    try {
      if (Capacitor.getPlatform() !== "android") { show(t("androidOnlyMsg"), { variant: "info" }); return; }
      const name = typeof window !== "undefined" ? prompt(t("fileNamePrompt")) || "" : "";
      const safe = name.replace(/[^A-Za-z0-9_]/g, "").slice(0, 32);
      if (!safe) { show(t("invalidNameError"), { variant: "error" }); return; }
      const payload = { name: safe, version: 1, createdAt: new Date().toISOString(), events, summaryCities };
      const json = JSON.stringify(payload);
      const r = await StorageFiles.save({ name: safe, json });
      if (r?.ok) { show(t("fileSavedOnDevice"), { variant: "success" }); } else { show(t("fileSaveError"), { variant: "error" }); }
    } catch { show(t("fileSaveError"), { variant: "error" }); }
  }

  const openFilesDrawer = useCallback(async () => {
    try {
      if (Capacitor.getPlatform() !== "android") { show(t("androidOnlyMsg"), { variant: "info" }); return; }
      const r = await StorageFiles.list();
      setFilesList(r?.files || []);
      setFilesDrawerOpen(true);
    } catch { setFilesList([]); setFilesDrawerOpen(true); }
  }, [show]);

  async function loadFile(name: string) {
    try {
      const r = await StorageFiles.read({ name });
      if (!r?.ok || !r?.json) { show(t("fileOpenError"), { variant: "error" }); return; }
      const obj = JSON.parse(r.json) as { events?: EventItem[]; summaryCities?: Array<{ name?: string; checkin?: string; checkout?: string; address?: string; transportToNext?: TransportSegmentMeta; stayFiles?: SavedFile[] }> };
      setEvents(obj.events || []);
      setSummaryCities(obj.summaryCities || []);
      setFilesDrawerOpen(false);
      show(t("calendarLoadedMsg"), { variant: "success" });
    } catch { show(t("fileOpenError"), { variant: "error" }); }
  }

  async function deleteFile(name: string) {
    try {
      const r = await StorageFiles.delete({ name });
      if (r?.ok) { const l = await StorageFiles.list(); setFilesList(l?.files || []); } else { show(t("deleteErrorMsg"), { variant: "error" }); }
    } catch { show(t("deleteErrorMsg"), { variant: "error" }); }
  }

  async function loadTripEventsFromDbById(id: string) {
    try {
      await initDatabaseDb();
      try { await migrateFromLocalStorageDb(); } catch {}
      try {
        const allTrips: TripItem[] = await getSavedTripsDb();
        const cur = allTrips.find((t) => t.id === id);
        if (cur) setCurrentSavedName(cur.savedCalendarName || "");
      } catch {}
      const evs = await getTripEventsDb(String(id));
      if (Array.isArray(evs) && evs.length) {
        const list = evs.map((e: { type?: string; label?: string; name?: string; date: string; time?: string }) => {
          const typeMap = (e.type === "flight" || e.type === "activity" || e.type === "restaurant" || e.type === "transport" || e.type === "stay") ? e.type : "activity";
          return { type: typeMap as EventItem["type"], label: e.label || e.name || "", date: e.date, time: e.time || undefined };
        });
        setCurrentTripId(String(id));
        setEvents(list);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async function loadLatestCalendarFromDb() {
    try {
      await initDatabaseDb();
      try { await migrateFromLocalStorageDb(); } catch {}
      const all: TripItem[] = await getSavedTripsDb();
      let target: TripItem | null = null;
      try {
        const raw = typeof window !== "undefined" ? localStorage.getItem("calentrip:tripSearch") : null;
        const ts = raw ? JSON.parse(raw) : null;
        if (ts) {
          const isSame = ts.mode === "same";
          const origin = isSame ? ts.origin : ts.outbound?.origin;
          const destination = isSame ? ts.destination : ts.outbound?.destination;
          const date = isSame ? ts.departDate : ts.outbound?.date;
          const pax = (() => { const p = ts.passengers || {}; return Number(p.adults || 0) + Number(p.children || 0) + Number(p.infants || 0); })();
          const title = origin && destination ? `${origin} → ${destination}` : "";
          target = all.find((t) => t.title === title && t.date === date && Number(t.passengers || 0) === pax) || null;
        }
      } catch {}
      if (!target) {
        const actives = all.filter((t) => t.reachedFinalCalendar);
        target = actives.length ? actives[actives.length - 1] : (all.length ? all[0] : null);
      }
      if (!target) { show(t("noSavedCalendarsMsg"), { variant: "info" }); return; }
      setCurrentSavedName(target.savedCalendarName || "");
      const ok = await loadTripEventsFromDbById(target.id);
      if (ok) { show(t("calendarLoadedMsg"), { variant: "success" }); }
    } catch { show(t("calendarLoadError"), { variant: "error" }); }
  }

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("calentrip:tripSearch") : null;
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
      (async () => {
        try {
          await initDatabaseDb();
          try { await migrateFromLocalStorageDb(); } catch {}
          const all: TripItem[] = await getSavedTripsDb();
          const it = all.find((t) => t.title === title && t.date === date && Number(t.passengers || 0) === pax);
          if (it) await updateTripDb(it.id, { reachedFinalCalendar: true });
        } catch {}
      })();
    } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await initDatabaseDb();
        try { await migrateFromLocalStorageDb(); } catch {}
        const all: TripItem[] = await getSavedTripsDb();
        let target: TripItem | null = null;
        try {
          const raw = typeof window !== "undefined" ? localStorage.getItem("calentrip:tripSearch") : null;
          const ts = raw ? JSON.parse(raw) : null;
          if (ts) {
            const isSame = ts.mode === "same";
            const origin = isSame ? ts.origin : ts.outbound?.origin;
            const destination = isSame ? ts.destination : ts.outbound?.destination;
            const date = isSame ? ts.departDate : ts.outbound?.date;
            const pax = (() => { const p = ts.passengers || {}; return Number(p.adults || 0) + Number(p.children || 0) + Number(p.infants || 0); })();
            const title = origin && destination ? `${origin} → ${destination}` : "";
            target = all.find((t) => t.title === title && t.date === date && Number(t.passengers || 0) === pax) || null;
          }
        } catch {}
        if (!target) target = all.find((t) => t.reachedFinalCalendar) || (all.length ? all[0] : null);
        if (!target) return;
        setCurrentTripId(String(target.id));
        const dbEvents = await getTripEventsDb(String(target.id));
        if (Array.isArray(dbEvents) && dbEvents.length) {
          const list = dbEvents.map((e: { type?: string; label?: string; name?: string; date: string; time?: string }) => {
            const typeMap = (e.type === "flight" || e.type === "activity" || e.type === "restaurant" || e.type === "transport" || e.type === "stay") ? e.type : "activity";
            return { type: typeMap as EventItem["type"], label: e.label || e.name || "", date: e.date, time: e.time || undefined };
          });
          setEvents(list);
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    try {
      const flag = typeof window !== "undefined" ? localStorage.getItem("calentrip:open_calendar_help") : null;
      if (flag === "1") {
        setCalendarHelpOpen(true);
        localStorage.removeItem("calentrip:open_calendar_help");
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const flag = typeof window !== "undefined" ? localStorage.getItem("calentrip:open_files_drawer") : null;
      if (flag === "1") {
        localStorage.removeItem("calentrip:open_files_drawer");
        openFilesDrawer();
      }
    } catch {}
  }, [openFilesDrawer]);

  useEffect(() => {
    try {
      const flag = typeof window !== "undefined" ? localStorage.getItem("calentrip:open_saved_drawer") : null;
      if (flag === "1") {
        localStorage.removeItem("calentrip:open_saved_drawer");
        (async () => {
          try {
            await initDatabaseDb();
            try { await migrateFromLocalStorageDb(); } catch {}
            const trips = await getSavedTripsDb();
            setSavedTripsList(trips);
          } catch { setSavedTripsList([]); }
        })();
        try {
          const rawList = typeof window !== "undefined" ? localStorage.getItem("calentrip:saved_calendars_list") : null;
          const list = rawList ? (JSON.parse(rawList) as Array<{ name: string; events: EventItem[]; savedAt?: string }>) : [];
          setSavedCalendarsList(list);
        } catch { setSavedCalendarsList([]); }
        setSavedDrawerOpen(true);
      }
    } catch {}
  }, [openFilesDrawer]);

  useEffect(() => {
    try {
      const auto = typeof window !== "undefined" ? localStorage.getItem("calentrip:auto_load_saved") : null;
      const raw = typeof window !== "undefined" ? localStorage.getItem("calentrip:saved_calendar") : null;
      if (auto === "1" && raw) {
        const sc = JSON.parse(raw) as { name?: string; events?: EventItem[] };
        if (sc?.events && sc.events.length) setEvents(sc.events);
        localStorage.removeItem("calentrip:auto_load_saved");
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const v = typeof window !== "undefined" ? localStorage.getItem("calentrip:locConsent") : null;
      if (v === "granted" || v === "denied" || v === "skipped") setLocConsent(v as typeof locConsent);
      else setLocConsent("default");
    } catch { setLocConsent("default"); }
  }, []);

  const ensureLocationConsent = useCallback(() => {
    if (locConsent === "granted") return true;
    setLocModalOpen(true);
    return false;
  }, [locConsent]);

  function saveCalendarNamed(silent?: boolean, fixedName?: string) {
    try {
      const rawName = silent ? "" : (typeof window !== "undefined" ? (prompt("Nome do calendário (apenas letras, até 9)") || "") : "");
      let name = (fixedName || rawName || "").replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, "").slice(0, 9).trim();
      if (!name) {
        try {
          const raw = typeof window !== "undefined" ? localStorage.getItem("calentrip:tripSearch") : null;
          const ts = raw ? JSON.parse(raw) : null;
          if (ts) {
            const isSame = ts.mode === "same";
            const origin = (isSame ? ts.origin : ts.outbound?.origin) || "";
            const destination = (isSame ? ts.destination : ts.outbound?.destination) || "";
            const fallback = `${String(origin)}${String(destination)}`.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, "").toUpperCase().slice(0, 9);
            name = fallback || "CALENDAR";
          } else {
            name = "CALENDAR";
          }
        } catch { name = "CALENDAR"; }
      }
      let evs = events;
      if (!evs.length) {
        try {
          const all: TripItem[] = getTrips();
          const list: EventItem[] = [];
          const seenFlights = new Set<string>();
          all.forEach((t) => {
            (t.flightNotes || []).forEach((fn) => {
              const legLabel = fn.leg === "outbound" ? "Voo de ida" : "Voo de volta";
              const sig = `${fn.leg}|${fn.origin}|${fn.destination}|${fn.date}`;
              if (!seenFlights.has(sig)) {
                seenFlights.add(sig);
                list.push({ type: "flight", label: `${legLabel}: ${fn.origin} → ${fn.destination}`, date: fn.date, time: fn.departureTime || undefined, meta: fn });
              }
            });
          });
          const rawSummary = typeof window !== "undefined" ? localStorage.getItem("calentrip_trip_summary") : null;
          const summary = rawSummary ? (JSON.parse(rawSummary) as { cities?: CityPersist[] }) : null;
          const cities = Array.isArray(summary?.cities) ? (summary!.cities as CityPersist[]) : [];
          cities.forEach((c, i) => {
            const cityName = c.name || `Cidade ${i + 1}`;
            const addr = c.address || "(endereço não informado)";
            if (c.checkin) {
              let ciTime = i === 0 ? "23:59" : "17:00";
              try { if (i === 0 && localStorage.getItem("calentrip:arrivalNextDay_outbound") === "true") ciTime = "14:00"; } catch {}
              list.push({ type: "stay", label: `Check-in hospedagem: ${cityName} • Endereço: ${addr}`, date: c.checkin, time: ciTime, meta: { city: cityName, address: addr, kind: "checkin" } });
            }
            if (c.checkout) {
              list.push({ type: "stay", label: `Checkout hospedagem: ${cityName} • Endereço: ${addr}`, date: c.checkout, time: "08:00", meta: { city: cityName, address: addr, kind: "checkout" } });
            }
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
          const rawEnt = typeof window !== "undefined" ? localStorage.getItem("calentrip:entertainment:records") : null;
          const recs: RecordItem[] = rawEnt ? JSON.parse(rawEnt) : [];
          (recs || []).forEach((r) => list.push({ type: r.kind, label: r.kind === "activity" ? `Atividade: ${r.title}` : `Restaurante: ${r.title}`, date: r.date, time: r.time, meta: r }));
          const seen = new Set<string>();
          evs = list.filter((e) => {
            const key = `${e.type}|${e.label}|${(e.date || "").trim()}|${(e.time || "").trim()}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          setEvents(evs);
        } catch {}
      }
      const payload = { name, events: evs };
      if (typeof window !== "undefined") localStorage.setItem("calentrip:saved_calendar", JSON.stringify(payload));
      try {
        const rawList = typeof window !== "undefined" ? localStorage.getItem("calentrip:saved_calendars_list") : null;
        const list = rawList ? (JSON.parse(rawList) as Array<{ name: string; events: EventItem[]; savedAt?: string }>) : [];
        const entry = { name, events, savedAt: new Date().toISOString() };
        const idx = list.findIndex((c) => (c?.name || "") === name);
        if (idx >= 0) list[idx] = entry; else list.push(entry);
        localStorage.setItem("calentrip:saved_calendars_list", JSON.stringify(list));
      } catch {}
      (async () => {
        try {
          await initDatabaseDb();
          try { await migrateFromLocalStorageDb(); } catch {}
          const raw = typeof window !== "undefined" ? localStorage.getItem("calentrip:tripSearch") : null;
          const ts = raw ? JSON.parse(raw) : null;
          let tripId = currentTripId;
          if (!tripId) {
            const all: TripItem[] = await getSavedTripsDb();
            if (ts) {
              const isSame = ts.mode === "same";
              const origin = isSame ? ts.origin : ts.outbound?.origin;
              const destination = isSame ? ts.destination : ts.outbound?.destination;
              const date = isSame ? ts.departDate : ts.outbound?.date;
              const pax = (() => { const p = ts.passengers || {}; return Number(p.adults || 0) + Number(p.children || 0) + Number(p.infants || 0); })();
              const title = origin && destination ? `${origin} → ${destination}` : "";
              const target = all.find((t) => t.title === title && t.date === date && Number(t.passengers || 0) === pax) || null;
              if (target) tripId = target.id;
            }
            if (!tripId && ts) {
              const isSame = ts.mode === "same";
              const origin = isSame ? ts.origin : ts.outbound?.origin;
              const destination = isSame ? ts.destination : ts.outbound?.destination;
              const date = isSame ? ts.departDate : ts.outbound?.date;
              const pax = (() => { const p = ts.passengers || {}; return Number(p.adults || 0) + Number(p.children || 0) + Number(p.infants || 0); })();
              const id = String(Date.now());
              await addTripDb({ id, title: `${origin} → ${destination}`, date, passengers: pax, reachedFinalCalendar: true, savedCalendarName: name });
              setCurrentTripId(id);
              tripId = id;
            }
          }
          if (tripId) {
            const dbEventsPayload = evs.map((e) => ({ name: e.label || "Evento", label: e.label || undefined, date: e.date, time: e.time || undefined, type: e.type }));
            await saveCalendarEventsDb(tripId, dbEventsPayload);
            await updateTripDb(tripId, { reachedFinalCalendar: true, savedCalendarName: name });
          }
        } catch {}
      })();
      show(t("savedInSearchesMsg"), { variant: "success" });
      return true;
    } catch { show(t("saveErrorMsg"), { variant: "error" }); return false; }
  }

  const sorted = useMemo(() => {
    const dateOnly = (d: string) => (d || "").replace(/\//g, "-");
    const arr = [...events].sort((a, b) => {
      const da = dateOnly(a.date);
      const db = dateOnly(b.date);
      if (da !== db) return da.localeCompare(db);
      const aIsOutbound = a.type === "flight" && (a.meta as FlightNote | undefined)?.leg === "outbound";
      const bIsOutbound = b.type === "flight" && (b.meta as FlightNote | undefined)?.leg === "outbound";
      const aIsCheckin = a.type === "stay" && ((a.meta as { kind?: string } | undefined)?.kind === "checkin");
      const bIsCheckin = b.type === "stay" && ((b.meta as { kind?: string } | undefined)?.kind === "checkin");
      const aIsInbound = a.type === "flight" && (a.meta as FlightNote | undefined)?.leg === "inbound";
      const bIsInbound = b.type === "flight" && (b.meta as FlightNote | undefined)?.leg === "inbound";
      const aIsCheckout = a.type === "stay" && ((a.meta as { kind?: string } | undefined)?.kind === "checkout");
      const bIsCheckout = b.type === "stay" && ((b.meta as { kind?: string } | undefined)?.kind === "checkout");
      if (aIsOutbound && bIsCheckin) return -1;
      if (bIsOutbound && aIsCheckin) return 1;
      if (aIsCheckout && bIsInbound) return -1;
      if (bIsCheckout && aIsInbound) return 1;
      if (aIsInbound && !bIsInbound) return 1;
      if (bIsInbound && !aIsInbound) return -1;
      return (a.time || "00:00").padStart(5, "0").localeCompare((b.time || "00:00").padStart(5, "0"));
    });
    let lastInboundIdx = -1;
    for (let i = 0; i < arr.length; i++) {
      const n = arr[i].meta as FlightNote | undefined;
      if (arr[i].type === "flight" && n?.leg === "inbound") lastInboundIdx = i;
    }
    if (lastInboundIdx >= 0 && lastInboundIdx !== arr.length - 1) {
      const [inb] = arr.splice(lastInboundIdx, 1);
      arr.push(inb);
    }
    return arr;
  }, [events]);

  useEffect(() => {
    (async () => {
      try {
        await initDatabaseDb();
        try { await migrateFromLocalStorageDb(); } catch {}
        const trips: TripItem[] = await getSavedTripsDb();
        const current = trips.length ? trips[0] : null;
        if (!current) return;
        const isDemo = (session?.user?.email || "").toLowerCase() === "demo@calentrip.com";
        const premium = isTripPremium(current.id) || isDemo;
        setCurrentTripId(current.id);
        setCurrentSavedName(current.savedCalendarName || "");
        setPremiumFlag(premium);
        try {
          const raw = typeof window !== "undefined" ? localStorage.getItem("calentrip:premium") : null;
          const list: Array<{ tripId: string; expiresAt: number }> = raw ? JSON.parse(raw) : [];
          const rec = list.find((r) => r.tripId === "global" && r.expiresAt > Date.now());
          if (rec) {
            const d = new Date(rec.expiresAt);
            const dd = String(d.getDate()).padStart(2, "0");
            const mm = String(d.getMonth() + 1).padStart(2, "0");
            setPremiumUntil(`${dd}/${mm}`);
          } else setPremiumUntil("");
        } catch { setPremiumUntil(""); }
        if (status !== "authenticated") setGating({ show: true, reason: "anon", tripId: current.id });
        else if (!premium) setGating({ show: true, reason: "noPremium", tripId: current.id });
        else setGating(null);
      } catch {}
    })();
  }, [status, session]);

  const lastInboundSignature = useMemo(() => {
    let sig = "";
    let best = -Infinity;
    events.forEach((e) => {
      const n = e.meta as FlightNote | undefined;
      if (e.type === "flight" && n?.leg === "inbound" && e.date && e.time) {
        const ts = new Date(`${e.date}T${(e.time || "00:00").padStart(5, "0")}:00`).getTime();
        if (ts > best) { best = ts; sig = `${n.origin}|${n.destination}|${e.date}|${e.time || ""}`; }
      }
    });
    return sig;
  }, [events]);

  function openGoogleCalendarInstall() {
    try {
      const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
      const isAndroid = /Android/.test(ua);
      const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && typeof window !== "undefined" && "ontouchend" in window);
      const urlAndroidMarket = "market://details?id=com.google.android.calendar";
      const urlAndroidWeb = "https://play.google.com/store/apps/details?id=com.google.android.calendar";
      const urlIOS = "https://apps.apple.com/app/google-calendar/id909319292";
      if (isAndroid) {
        try { window.location.href = urlAndroidMarket; } catch {}
        setTimeout(() => { try { window.open(urlAndroidWeb, "_blank"); } catch {} }, 600);
        show(t("openingGoogleCalendarPlayStore"), { variant: "info" });
      } else if (isIOS) {
        try { window.open(urlIOS, "_blank"); } catch {}
        show(t("openingGoogleCalendarAppStore"), { variant: "info" });
      } else {
        try { window.open(urlAndroidWeb, "_blank"); } catch {}
        show(t("openingGoogleCalendarStore"), { variant: "info" });
      }
    } catch {}
  }

  function openDownloads() {
    try {
      const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
      const isAndroid = /Android/.test(ua);
      if (isAndroid) {
        try { window.location.href = "intent://com.android.providers.downloads.ui#Intent;scheme=content;end"; } catch {}
        setTimeout(() => { try { window.open("file:///storage/emulated/0/Download/", "_blank"); } catch {} }, 600);
        show(t("openingDownloadsFolderInfo"), { variant: "info" });
      } else {
        show(t("openDownloadsTapIcsInfo"), { variant: "info" });
      }
    } catch {}
  }

  async function saveCalendarFull() {
    try { saveCalendarNamed(true); } catch {}
    const uaHeader = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
    const isAndroidHeader = /Android/.test(uaHeader);
    function fmt(d: Date) {
      const y = String(d.getFullYear());
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const da = String(d.getDate()).padStart(2, "0");
      const h = String(d.getHours()).padStart(2, "0");
      const mi = String(d.getMinutes()).padStart(2, "0");
      const s = String(d.getSeconds()).padStart(2, "0");
      return `${y}${m}${da}T${h}${mi}${s}`;
    }
    function fmtUTC(d: Date) {
      const y = String(d.getUTCFullYear());
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const da = String(d.getUTCDate()).padStart(2, "0");
      const h = String(d.getUTCHours()).padStart(2, "0");
      const mi = String(d.getUTCMinutes()).padStart(2, "0");
      const s = String(d.getUTCSeconds()).padStart(2, "0");
      return `${y}${m}${da}T${h}${mi}${s}Z`;
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
    async function geocode(q: string) {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      const js = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
      return js[0] ? { lat: Number(js[0].lat), lon: Number(js[0].lon), display: js[0].display_name } : null;
    }
    async function computeReturnDetails() {
      if (!summaryCities.length) return null as null | { airportName: string; distanceKm?: number; walkingMin?: number; drivingMin?: number; busMin?: number; trainMin?: number; priceEstimate?: number; gmapsUrl?: string; uberUrl?: string; callTime?: string; notifyAt?: string; callAtISO?: string; notifyAtISO?: string };
      const trips: TripItem[] = await getSavedTripsDb();
      const notes = trips.flatMap((t) => (t.flightNotes || [])).filter((n) => n.leg === "inbound" && n.origin && n.date && n.departureTime);
      if (!notes.length) return null;
      const fn = [...notes].sort((a, b) => new Date(`${a.date}T${(a.departureTime || "00:00").padStart(5, "0")}:00`).getTime() - new Date(`${b.date}T${(b.departureTime || "00:00").padStart(5, "0")}:00`).getTime()).slice(-1)[0];
      const airport = await findAirportByIata(fn.origin);
      const last = summaryCities[summaryCities.length - 1];
      if (!last?.address) return null;
      const o = await geocode(last.address);
      const d = await geocode(airport ? `${airport.name} (${airport.iata})` : `${fn.origin} airport`);
      let walkingMin: number | undefined;
      let drivingMin: number | undefined;
      let busMin: number | undefined;
      let trainMin: number | undefined;
      let distanceKm: number | undefined;
      let gmapsUrl: string | undefined;
      let uberUrl: string | undefined;
      let callTime: string | undefined;
      let notifyAt: string | undefined;
      let priceEstimate: number | undefined;
      let callAtISO: string | undefined;
      let notifyAtISO: string | undefined;
      if (o && d) {
        try {
          const osrmDrive = `https://router.project-osrm.org/route/v1/driving/${o.lon},${o.lat};${d.lon},${d.lat}?overview=false`;
          const resD = await fetch(osrmDrive);
          const jsD = await resD.json();
          const rD = jsD?.routes?.[0];
          if (rD) {
            drivingMin = Math.round((rD.duration ?? 0) / 60);
            distanceKm = Math.round((rD.distance ?? 0) / 1000);
            priceEstimate = Math.round((distanceKm || 0) * 6 + 3);
          }
        } catch {}
        try {
          const osrmWalk = `https://router.project-osrm.org/route/v1/walking/${o.lon},${o.lat};${d.lon},${d.lat}?overview=false`;
          const resW = await fetch(osrmWalk);
          const jsW = await resW.json();
          const rW = jsW?.routes?.[0];
          if (rW) walkingMin = Math.round((rW.duration ?? 0) / 60);
        } catch {}
        const trafficFactor = 1.3;
        const driveWithTraffic = drivingMin ? Math.round(drivingMin * trafficFactor) : undefined;
        busMin = driveWithTraffic ? Math.round(driveWithTraffic * 1.8) : undefined;
        trainMin = driveWithTraffic ? Math.round(driveWithTraffic * 1.2) : undefined;
        gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(last.address)}&destination=${encodeURIComponent(airport ? `${airport.name} (${airport.iata})` : `${fn.origin} airport`)}`;
        uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=${d.lat}&dropoff[longitude]=${d.lon}&dropoff[formatted_address]=${encodeURIComponent(airport ? `${airport.name} (${airport.iata})` : `${fn.origin} airport`)}`;
        if (fn.departureTime && fn.date) {
          const [h, m] = (fn.departureTime || "00:00").split(":");
          const dt = new Date(`${fn.date}T${h.padStart(2, "0")}:${m.padStart(2, "0")}:00`);
          const mins = 240 + (driveWithTraffic ?? drivingMin ?? 60);
          const callAt = new Date(dt.getTime() - mins * 60 * 1000);
          const notifyAtDate = new Date(callAt.getTime() - 2 * 60 * 60 * 1000);
          const fmtLocal = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
          callTime = fmtLocal(callAt);
          notifyAt = `${notifyAtDate.toLocaleDateString()} ${fmtLocal(notifyAtDate)}`;
          callAtISO = callAt.toISOString();
          notifyAtISO = notifyAtDate.toISOString();
        }
      }
      return { airportName: airport ? `${airport.name} (${airport.iata})` : `${fn.origin} airport`, distanceKm, walkingMin, drivingMin, busMin, trainMin, priceEstimate, gmapsUrl, uberUrl, callTime, notifyAt, callAtISO, notifyAtISO };
    }
    const tzHeader = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "Etc/UTC"; } catch { return "Etc/UTC"; } })();
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
    const returnDetails = await computeReturnDetails();
    for (let idx = 0; idx < events.length; idx++) {
      const e = events[idx];
      const start = parseDT(e.date, e.time);
      const end = start ? new Date(start.getTime() + 60 * 60 * 1000) : null;
      const desc = e.label;
      const baseTitle = isAndroidHeader ? limit(e.label, 64) : limit(e.label, 120);
      const title = isAndroidHeader ? toAscii(baseTitle) : baseTitle;
      lines.push("BEGIN:VEVENT");
      const uid = `ev-${idx}-${start ? fmt(start) : String(Date.now())}@calentrip`;
      if (start) lines.push(useTZID ? `DTSTART;TZID=${tzHeader}:${fmt(start)}` : `DTSTART:${fmtUTC(start)}`);
      if (end) lines.push(useTZID ? `DTEND;TZID=${tzHeader}:${fmt(end)}` : `DTEND:${fmtUTC(end)}`);
      lines.push(`DTSTAMP:${fmtUTC(new Date())}`);
      lines.push(`UID:${uid}`);
      lines.push(`SUMMARY:${escText(title)}`);
      lines.push("TRANSP:OPAQUE");
      lines.push("SEQUENCE:0");
      lines.push("STATUS:CONFIRMED");
      let extraCall: { callAt: Date; callEnd: Date; callTime?: string; uberUrl?: string; gmapsUrl?: string } | null = null;
      if (e.type === "stay" && (e.meta as { kind?: string })?.kind === "checkout" && idx === (events.reduce((acc, cur, i) => ((cur.type === "stay" && (cur.meta as { kind?: string })?.kind === "checkout") ? i : acc), -1))) {
        const extra = returnDetails;
        const info: string[] = [];
        info.push(desc);
        if (extra?.airportName) info.push(`Destino: ${extra.airportName}`);
        if (extra?.distanceKm !== undefined) info.push(`Distância: ${extra.distanceKm} km`);
        const modes: string[] = [];
        if (extra?.walkingMin) modes.push(`A pé: ${extra.walkingMin} min`);
        if (extra?.busMin) modes.push(`Ônibus: ${extra.busMin} min (estimado)`);
        if (extra?.trainMin) modes.push(`Trem/Metro: ${extra.trainMin} min (estimado)`);
        if (extra?.drivingMin !== undefined) modes.push(`Uber/Táxi: ${extra.drivingMin} min${extra.priceEstimate !== undefined ? ` • R$${extra.priceEstimate}` : ""}`);
        if (modes.length) info.push(modes.join(" | "));
        const gmaps = extra?.gmapsUrl || null;
        const uber = extra?.uberUrl || null;
        if (gmaps) info.push(`Google Maps: ${gmaps}`);
        if (uber) info.push(`Uber: ${uber}`);
        if (extra?.callTime) info.push(`Chamar Uber às: ${extra.callTime}`);
        if (extra?.notifyAt) info.push(`Notificação programada: ${extra.notifyAt}`);
        const descBody = limit(info.join("\n"), 480);
        lines.push(`DESCRIPTION:${escText(descBody)}`);
        if (extra?.callAtISO) {
          const callAt = new Date(extra.callAtISO);
          const callEnd = new Date(callAt.getTime() + 30 * 60 * 1000);
          extraCall = { callAt, callEnd, callTime: extra.callTime, uberUrl: extra.uberUrl, gmapsUrl: extra.gmapsUrl };
        }
      } else {
        if (e.type === "transport" && start) {
          const sig = `${e.date}|${e.time || ""}`;
          let tn: { callTime?: string; notifyAt?: string; callAtISO?: string; uberUrl?: string; gmapsUrl?: string } | null = null;
          try {
            const raw = typeof window !== "undefined" ? localStorage.getItem("calentrip:transport_notify") : null;
            const map = raw ? JSON.parse(raw) as Record<string, { callTime: string; notifyAt: string; callAtISO: string; uberUrl?: string; gmapsUrl?: string }> : {};
            tn = map[sig] || null;
          } catch {}
          const baseDesc = isAndroidHeader ? limit(desc, 160) : limit(desc, 280);
          const extra: string[] = [baseDesc];
          if (tn?.callTime) extra.push(`Chamar Uber às: ${tn.callTime}`);
          if (tn?.notifyAt) extra.push(`Notificação programada: ${tn.notifyAt}`);
          if (tn?.uberUrl) extra.push(`Uber: ${tn.uberUrl}`);
          if (tn?.gmapsUrl) extra.push(`Google Maps: ${tn.gmapsUrl}`);
          lines.push(`DESCRIPTION:${escText(extra.join("\n"))}`);
          const alarmLines = alarmForEvent(e.type, !!(e.time && e.time.trim()), start);
          for (const L of alarmLines) lines.push(L);
          if (tn?.callAtISO) {
            const callAt = new Date(tn.callAtISO);
            const callEnd = new Date(callAt.getTime() + 30 * 60 * 1000);
            extraCall = { callAt, callEnd, callTime: tn.callTime, uberUrl: tn.uberUrl, gmapsUrl: tn.gmapsUrl };
          }
        } else {
          const baseDesc = isAndroidHeader ? limit(desc, 160) : limit(desc, 280);
          lines.push(`DESCRIPTION:${escText(baseDesc)}`);
          const alarmLines = alarmForEvent(e.type, !!(e.time && e.time.trim()), start);
          for (const L of alarmLines) lines.push(L);
        }
      }
      lines.push("END:VEVENT");
      if (extraCall) {
        const { callAt, callEnd, callTime, uberUrl, gmapsUrl } = extraCall;
        lines.push("BEGIN:VEVENT");
        const uid2 = `call-${idx}-${fmt(callAt)}@calentrip`;
        if (useTZID) {
          lines.push(`DTSTART;TZID=${tzHeader}:${fmt(callAt)}`);
          lines.push(`DTEND;TZID=${tzHeader}:${fmt(callEnd)}`);
        } else {
          lines.push(`DTSTART:${fmtUTC(callAt)}`);
          lines.push(`DTEND:${fmtUTC(callEnd)}`);
        }
        lines.push(`SUMMARY:Chamar Uber`);
        lines.push(`UID:${uid2}`);
        lines.push(`DTSTAMP:${fmtUTC(new Date())}`);
        lines.push("STATUS:CONFIRMED");
        lines.push("TRANSP:OPAQUE");
        lines.push("SEQUENCE:0");
        const descParts = [`Chamar Uber às: ${callTime}`];
        if (uberUrl) descParts.push(`Uber: ${uberUrl}`);
        if (gmapsUrl) descParts.push(`Google Maps: ${gmapsUrl}`);
        lines.push(`DESCRIPTION:${escText(limit(descParts.join("\n"), 240))}`);
        lines.push("BEGIN:VALARM");
        lines.push("ACTION:DISPLAY");
        lines.push("DESCRIPTION:Lembrete de transporte");
        lines.push("TRIGGER:-PT0M");
        lines.push("END:VALARM");
        lines.push("END:VEVENT");
      }
    }
    lines.push("END:VCALENDAR");
    const crlf = lines.map(foldLine).join("\r\n") + "\r\n";
    const blob = new Blob([crlf], { type: "text/calendar;charset=utf-8" });
    const file = new File([crlf], "calentrip.ics", { type: "text/calendar;charset=utf-8" });
    try {
      const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean; share?: (data: ShareData) => Promise<void> };
      const canShareFiles = typeof nav !== "undefined" && typeof nav.canShare === "function" && nav.canShare({ files: [file] });
      if (canShareFiles && typeof nav.share === "function") {
        await nav.share({ files: [file], title: "CalenTrip" });
        const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
        const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && typeof window !== "undefined" && "ontouchend" in window);
        const isAndroid = /Android/.test(ua);
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
    try { openDownloads(); } catch {}
    show(t("icsDownloadedAndroidHelp"), { variant: "info" });
  }

  

  useEffect(() => {
    try {
      const rawSaved = typeof window !== "undefined" ? localStorage.getItem("calentrip:saved_calendar") : null;
      if (rawSaved) {
        try {
          const sc = JSON.parse(rawSaved) as { events?: EventItem[] };
          if (sc?.events && sc.events.length) { setEvents(sc.events); return; }
        } catch {}
      }
      const all: TripItem[] = getTrips();
      let trips: TripItem[] = [];
      let tsObj: TripSearchPersist | null = null;
      try {
        const rawTs = typeof window !== "undefined" ? localStorage.getItem("calentrip:tripSearch") : null;
        tsObj = rawTs ? JSON.parse(rawTs) : null;
        if (tsObj) {
          const isSame = tsObj.mode === "same";
          const origin = isSame ? tsObj.origin : tsObj.outbound?.origin;
          const destination = isSame ? tsObj.destination : tsObj.outbound?.destination;
          const date = isSame ? tsObj.departDate : tsObj.outbound?.date;
          const pax = (() => { const p = tsObj.passengers || {}; return Number(p.adults || 0) + Number(p.children || 0) + Number(p.infants || 0); })();
          const title = origin && destination ? `${origin} → ${destination}` : "";
          const matchIdx = all.findIndex((t) => t.title === title && t.date === date && t.passengers === pax);
          if (matchIdx >= 0) trips = [all[matchIdx]];
        }
      } catch {}
      if (!trips.length) {
        const actives = all.filter((t) => t.reachedFinalCalendar);
        trips = actives.length ? [actives[actives.length - 1]] : (all.length ? [all[all.length - 1]] : []);
      }
      const list: EventItem[] = [];
      const seenFlights = new Set<string>();
      trips.forEach((t) => {
        if (t.flightNotes && t.flightNotes.length) {
          t.flightNotes.forEach((fn) => {
            const legLabel = fn.leg === "outbound" ? "Voo de ida" : "Voo de volta";
            const sig = `${fn.leg}|${fn.origin}|${fn.destination}|${fn.date}`;
            if (!seenFlights.has(sig)) {
              seenFlights.add(sig);
              list.push({ type: "flight", label: `${legLabel}: ${fn.origin} → ${fn.destination}`, date: fn.date, time: fn.departureTime || undefined, meta: fn });
            }
            // Removemos a criação de eventos de chegada para evitar duplicação visual
          });
        }
      });
      if (!list.some((e) => e.type === "flight") && tsObj) {
        const isSame = tsObj.mode === "same";
        if (isSame) {
          const o = tsObj.origin?.trim();
          const d = tsObj.destination?.trim();
          const dd = tsObj.departDate?.trim();
          const rd = tsObj.returnDate?.trim();
          if (o && d && dd) list.push({ type: "flight", label: `Voo de ida: ${o} → ${d}` , date: dd, time: tsObj.departTime || undefined, meta: { leg: "outbound", origin: o, destination: d, date: dd, departureTime: tsObj.departTime || undefined } });
          if (o && d && rd) list.push({ type: "flight", label: `Voo de volta: ${d} → ${o}` , date: rd, time: tsObj.returnTime || undefined, meta: { leg: "inbound", origin: d, destination: o, date: rd, departureTime: tsObj.returnTime || undefined } });
        } else if (tsObj?.outbound && tsObj?.inbound) {
          const ob = tsObj.outbound;
          const ib = tsObj.inbound;
          if (ob?.origin && ob?.destination && ob?.date) list.push({ type: "flight", label: `Voo de ida: ${ob.origin} → ${ob.destination}`, date: ob.date, time: ob.time || undefined, meta: { leg: "outbound", origin: ob.origin, destination: ob.destination, date: ob.date, departureTime: ob.time || undefined } });
          if (ib?.origin && ib?.destination && ib?.date) list.push({ type: "flight", label: `Voo de volta: ${ib.origin} → ${ib.destination}`, date: ib.date, time: ib.time || undefined, meta: { leg: "inbound", origin: ib.origin, destination: ib.destination, date: ib.date, departureTime: ib.time || undefined } });
        }
      }
      const rawSummary = typeof window !== "undefined" ? localStorage.getItem("calentrip_trip_summary") : null;
      const summary = rawSummary ? (JSON.parse(rawSummary) as { cities?: CityPersist[] }) : null;
      const cities = Array.isArray(summary?.cities) ? (summary!.cities as CityPersist[]) : [];
      setSummaryCities(cities as Array<{ name?: string; checkin?: string; checkout?: string; address?: string; transportToNext?: TransportSegmentMeta; stayFiles?: SavedFile[] }>);
      cities.forEach((c, i) => {
        const cityName = c.name || `Cidade ${i + 1}`;
        const addr = c.address || "(endereço não informado)";
        if (c.checkin) {
          let ciTime = i === 0 ? "23:59" : "17:00";
          try { if (i === 0 && localStorage.getItem("calentrip:arrivalNextDay_outbound") === "true") ciTime = "14:00"; } catch {}
          list.push({ type: "stay", label: `Check-in hospedagem: ${cityName} • Endereço: ${addr}`, date: c.checkin, time: ciTime, meta: { city: cityName, address: addr, kind: "checkin" } });
        }
        if (c.checkout) {
          list.push({ type: "stay", label: `Checkout hospedagem: ${cityName} • Endereço: ${addr}`, date: c.checkout, time: "08:00", meta: { city: cityName, address: addr, kind: "checkout" } });
        }
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
      const raw = typeof window !== "undefined" ? localStorage.getItem("calentrip:entertainment:records") : null;
      const recs: RecordItem[] = raw ? JSON.parse(raw) : [];
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

  async function openTransportDrawer(item: EventItem) {
    if (item.type !== "flight") return;
    const fn = item.meta as FlightNote;
    if (!fn || !fn.origin || !fn.date) return;
    setDrawerData({ originIata: fn.origin, departureDate: fn.date, departureTime: fn.departureTime || "" });
    setDrawerOpen(true);
    setLoading(true);
    try {
      const airport = await findAirportByIata(fn.origin);
      const originQ = airport ? `${airport.name} (${airport.iata})` : `${fn.origin} airport`;
      const pos = await new Promise<GeolocationPosition | null>((resolve) => {
        if (!navigator.geolocation) resolve(null);
        if (!ensureLocationConsent()) { resolve(null); return; }
        navigator.geolocation.getCurrentPosition((p) => resolve(p), () => resolve(null), { enableHighAccuracy: true, timeout: 10000 });
      });
      const geocode = async (q: string) => {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
        const res = await fetch(url, { headers: { "Accept": "application/json" } });
        const js = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
        return js[0] ? { lat: Number(js[0].lat), lon: Number(js[0].lon) } : null;
      };
      const airportLoc = await geocode(originQ);
      let distanceKm: number | undefined;
      let durationMin: number | undefined;
      let uberUrl: string | undefined;
      if (pos && airportLoc) {
        const o = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        const d = airportLoc;
        const osrm = `https://router.project-osrm.org/route/v1/driving/${o.lon},${o.lat};${d.lon},${d.lat}?overview=false`;
        const res = await fetch(osrm);
        const js = await res.json();
        const r = js?.routes?.[0];
        if (r) {
          distanceKm = Math.round((r.distance ?? 0) / 1000);
          durationMin = Math.round((r.duration ?? 0) / 60);
        }
        uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup[latitude]=${o.lat}&pickup[longitude]=${o.lon}&dropoff[latitude]=${d.lat}&dropoff[longitude]=${d.lon}&dropoff[formatted_address]=${encodeURIComponent(originQ)}`;
      }
      const gmapsUrl = pos
        ? `https://www.google.com/maps/dir/?api=1&origin=${pos.coords.latitude}%2C${pos.coords.longitude}&destination=${encodeURIComponent(originQ)}`
        : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(originQ)}`;
      const r2rUrl = buildRome2RioUrl({ originName: pos ? `${pos.coords.latitude},${pos.coords.longitude}` : "my location", destName: originQ, originLat: pos?.coords.latitude, originLon: pos?.coords.longitude, destLat: airportLoc?.lat, destLon: airportLoc?.lon, date: fn.date, time: fn.departureTime, lang: "pt-BR", currency: "BRL" });
      if (!uberUrl && airportLoc) {
        uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=${airportLoc.lat}&dropoff[longitude]=${airportLoc.lon}&dropoff[formatted_address]=${encodeURIComponent(originQ)}`;
      }
      const trafficFactor = 1.3;
      const durationWithTrafficMin = durationMin ? Math.round(durationMin * trafficFactor) : undefined;
      let callTime: string | undefined;
      let notifyAt: string | undefined;
      let arriveBy: string | undefined;
      if (fn.departureTime && fn.date) {
        const [h, m] = (fn.departureTime || "00:00").split(":");
        const dt = new Date(`${fn.date}T${h.padStart(2, "0")}:${m.padStart(2, "0")}:00`);
    const arriveTarget = new Date(dt.getTime() - 3 * 60 * 60 * 1000);
        const travelMs = (durationWithTrafficMin ?? durationMin ?? 60) * 60 * 1000;
        const callAt = new Date(arriveTarget.getTime() - travelMs);
        const notifyAtDate = new Date(callAt.getTime() - 2 * 60 * 60 * 1000);
        const fmt = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        arriveBy = fmt(arriveTarget);
        callTime = fmt(callAt);
        notifyAt = `${notifyAtDate.toLocaleDateString()} ${fmt(notifyAtDate)}`;
        try {
          if (typeof Notification !== "undefined") {
            if (Notification.permission === "default") await Notification.requestPermission();
            if (Notification.permission === "granted") {
              const delay = notifyAtDate.getTime() - Date.now();
              if (delay > 0 && delay < 365 * 24 * 60 * 60 * 1000) {
                setTimeout(() => {
                  new Notification("Lembrete de transporte", { body: `Chame o Uber às ${callTime}.` });
                }, delay);
              }
            }
          }
        } catch {}
        try {
          const sig = `${item.date}|${item.time || ""}`;
          const raw = typeof window !== "undefined" ? localStorage.getItem("calentrip:transport_notify") : null;
          const map = raw ? JSON.parse(raw) as Record<string, { callTime: string; notifyAt: string; callAtISO: string; uberUrl?: string; gmapsUrl?: string }> : {};
          map[sig] = { callTime, notifyAt, callAtISO: callAt.toISOString(), uberUrl, gmapsUrl };
          if (typeof window !== "undefined") localStorage.setItem("calentrip:transport_notify", JSON.stringify(map));
        } catch {}
      }
      setTransportInfo({ distanceKm, durationMin, durationWithTrafficMin, gmapsUrl, r2rUrl, uberUrl, airportName: originQ, arrivalByTime: arriveBy, callTime, notifyAt });
      try {
        const allTrips: TripItem[] = getTrips();
        const match = allTrips.find((t) => (t.flightNotes || []).some((n) => n.leg === "outbound" && n.origin === fn.origin && n.destination === fn.destination && n.date === fn.date));
        const files = (match?.attachments || []).filter((a) => (a.leg ?? "outbound") === "outbound");
        setOutboundFiles(files as Array<{ name: string; type: string; size: number; id?: string; dataUrl?: string }>);
      } catch {}
    } catch {
      const dest = drawerData?.originIata ? `${drawerData.originIata} airport` : "aeroporto";
      const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
      const r2rUrl = buildRome2RioUrl({ originName: "Origem", destName: dest, lang: "pt-BR", currency: "BRL" });
      const uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=${encodeURIComponent(dest)}`;
      setTransportInfo({ distanceKm: undefined, durationMin: undefined, durationWithTrafficMin: undefined, gmapsUrl, r2rUrl, uberUrl, airportName: dest });
      try { showOnce("Não foi possível calcular a rota detalhada. Usando links básicos.", { variant: "info" }); } catch {}
    } finally {
      setLoading(false);
    }
  }

  async function openDepartureDrawer(item: EventItem) {
    if (item.type !== "transport") return;
    const seg = item.meta as TransportSegmentMeta;
    const originAddr = (seg.originAddress || "").trim();
    const depPoint = (seg.dep || "").trim();
    if (!originAddr || !depPoint) { setStayInfo(null); setStayDrawerOpen(true); return; }
    setStayDrawerOpen(true);
    setStayLoading(true);
    try {
      const geocode = async (q: string) => {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        const js = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
        return js[0] ? { lat: Number(js[0].lat), lon: Number(js[0].lon), display: js[0].display_name } : null;
      };
    const o = await geocode(originAddr);
    let destLabel = depPoint;
    let destLatLon: { lat: number; lon: number } | null = null;
    const cityForSearch = (seg.originCity || depPoint).trim();
    const looksLikeCityOnly = !/[,\d]/.test(depPoint) && !/(rodovi|terminal|est(a|ã)\w+|bus|gare|station)/i.test(depPoint);
    if (seg.mode === "bus" && looksLikeCityOnly && cityForSearch) {
      try {
        const fetchList = async (q: string) => {
          const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`;
          const res = await fetch(url, { headers: { Accept: "application/json" } });
          const js = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
          return js.map((r) => ({ name: r.display_name, lat: Number(r.lat), lon: Number(r.lon) }));
        };
        const list1 = await fetchList(`rodoviária ${cityForSearch}`);
        const list2 = await fetchList(`bus station ${cityForSearch}`);
        const seen = new Set<string>();
        const merged: Array<{ name: string; lat: number; lon: number }> = [];
        [...list1, ...list2].forEach((it) => {
          const key = `${Math.round(it.lat * 10000)}|${Math.round(it.lon * 10000)}`;
          if (!seen.has(key)) { seen.add(key); merged.push(it); }
        });
        const cityLow = cityForSearch.toLowerCase();
        const cityBusPrefs: Record<string, string[]> = {
          ["são paulo"]: ["tietê", "terminal tietê"],
          ["sao paulo"]: ["tiete", "terminal tiete"],
          ["rio de janeiro"]: ["novo rio"],
          ["porto"]: ["campo 24 de agosto"],
        };
        const rankBus = (n: string) => {
          const s = (n || "").toLowerCase();
          let score = 100;
          if (s.includes(cityLow)) score -= 10;
          if (/(central|centrale)/.test(s)) score -= 15;
          if (/(rodovi|terminal|gare routière|autostazione)/.test(s)) score -= 10;
          const prefs = cityBusPrefs[cityLow] || [];
          for (const k of prefs) { if (s.includes(k)) score -= 40; }
          return score;
        };
        merged.sort((a, b) => rankBus(a.name) - rankBus(b.name));
        if (merged.length) {
          setStayCandidates(merged.slice(0, 6));
          const raw = typeof window !== "undefined" ? localStorage.getItem("calentrip:bus_station_selection") : null;
          const map = raw ? JSON.parse(raw) as Record<string, { name: string; lat: number; lon: number }> : {};
          const saved = map[cityForSearch];
          const idxSaved = saved ? merged.findIndex((c) => Math.abs(c.lat - saved.lat) < 0.001 && Math.abs(c.lon - saved.lon) < 0.001) : -1;
          const chosen = idxSaved >= 0 ? merged[idxSaved] : merged[0];
          destLabel = chosen.name;
          destLatLon = { lat: chosen.lat, lon: chosen.lon };
          setStayChosenIdx(idxSaved >= 0 ? idxSaved : 0);
        }
      } catch {}
    }
    if (seg.mode === "train" && looksLikeCityOnly && cityForSearch) {
      try {
        const fetchList = async (q: string) => {
          const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=8`;
          const res = await fetch(url, { headers: { Accept: "application/json" } });
          const js = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
          return js.map((r) => ({ name: r.display_name, lat: Number(r.lat), lon: Number(r.lon) }));
        };
        const list1 = await fetchList(`estação de trem ${cityForSearch}`);
        const list2 = await fetchList(`train station ${cityForSearch}`);
        const list3 = await fetchList(`gare ${cityForSearch}`);
        const seen = new Set<string>();
        const merged: Array<{ name: string; lat: number; lon: number }> = [];
        [...list1, ...list2, ...list3].forEach((it) => {
          const key = `${Math.round(it.lat * 10000)}|${Math.round(it.lon * 10000)}`;
          if (!seen.has(key)) { seen.add(key); merged.push(it); }
        });
        const cityLow = cityForSearch.toLowerCase();
        const cityTrainPrefs: Record<string, string[]> = {
          ["firenze"]: ["santa maria novella", "smn"],
          ["florence"]: ["santa maria novella", "smn"],
          ["roma"]: ["termini"],
          ["rome"]: ["termini"],
          ["milano"]: ["centrale"],
          ["milan"]: ["centrale", "central"],
          ["venezia"]: ["santa lucia"],
          ["venice"]: ["santa lucia"],
          ["napoli"]: ["centrale"],
          ["naples"]: ["centrale"],
          ["torino"]: ["porta nuova"],
          ["turin"]: ["porta nuova"],
          ["bologna"]: ["centrale"],
          ["pisa"]: ["centrale"],
          ["paris"]: ["gare du nord", "gare de lyon"],
          ["berlin"]: ["hauptbahnhof", "hbf"],
          ["munich"]: ["hauptbahnhof", "hbf"],
          ["münchen"]: ["hauptbahnhof", "hbf"],
          ["madrid"]: ["atocha"],
          ["barcelona"]: ["sants"],
        };
        const rank = (n: string) => {
          const s = (n || "").toLowerCase();
          let score = 100;
          if (s.includes(cityLow)) score -= 20;
          if (/termini/.test(s)) score -= 50;
          if (/(centrale|central|hauptbahnhof|hbf)/.test(s)) score -= 40;
          if (/(santa maria novella|smn)/.test(s)) score -= 45;
          if (/(gare du nord|gare de lyon)/.test(s)) score -= 35;
          if (/(stazione|station|gare)/.test(s)) score -= 10;
          const prefs = cityTrainPrefs[cityLow] || [];
          for (const k of prefs) { if (s.includes(k)) score -= 50; }
          return score;
        };
        merged.sort((a, b) => rank(a.name) - rank(b.name));
        if (merged.length) {
          setStayCandidates(merged.slice(0, 6));
          const raw = typeof window !== "undefined" ? localStorage.getItem("calentrip:train_station_selection") : null;
          const map = raw ? (JSON.parse(raw) as Record<string, { name: string; lat: number; lon: number }>) : {};
          const saved = map[cityForSearch];
          const idxSaved = saved ? merged.findIndex((c) => Math.abs(c.lat - saved.lat) < 0.001 && Math.abs(c.lon - saved.lon) < 0.001) : -1;
          const chosen = idxSaved >= 0 ? merged[idxSaved] : merged[0];
          destLabel = chosen.name;
          destLatLon = { lat: chosen.lat, lon: chosen.lon };
          setStayChosenIdx(idxSaved >= 0 ? idxSaved : 0);
        }
      } catch {}
    }
    if (seg.mode === "air" && looksLikeCityOnly && cityForSearch) {
      try {
        const airports = await searchAirportsAsync(cityForSearch);
        const filtered = airports.filter((a) => a.city.toLowerCase() === cityForSearch.toLowerCase()).slice(0, 6);
        const orderMap: Record<string, number> = {};
        filtered.forEach((a, i) => { orderMap[`${a.city} – ${a.name} (${a.iata})`] = i; });
        const names = filtered.map((a) => `${a.city} – ${a.name} (${a.iata})`);
        const geos: Array<{ name: string; lat: number; lon: number; pref?: number }> = [];
        for (const n of names) {
          try {
            const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(n)}&format=json&limit=1`;
            const res = await fetch(url, { headers: { Accept: "application/json" } });
            const js = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
            const r = js[0];
            if (r) geos.push({ name: r.display_name, lat: Number(r.lat), lon: Number(r.lon), pref: orderMap[n] ?? 999 });
          } catch {}
        }
        if (geos.length) {
          geos.sort((a, b) => (a.pref ?? 999) - (b.pref ?? 999));
          setStayCandidates(geos.map((g) => ({ name: g.name, lat: g.lat, lon: g.lon })).slice(0, 6));
          const raw = typeof window !== "undefined" ? localStorage.getItem("calentrip:airport_selection") : null;
          const map = raw ? (JSON.parse(raw) as Record<string, { name: string; lat: number; lon: number }>) : {};
          const saved = map[cityForSearch];
          const idxSaved = saved ? geos.findIndex((c) => Math.abs(c.lat - saved.lat) < 0.001 && Math.abs(c.lon - saved.lon) < 0.001) : -1;
          const chosen = idxSaved >= 0 ? geos[idxSaved] : geos[0];
          destLabel = chosen.name;
          destLatLon = { lat: chosen.lat, lon: chosen.lon };
          setStayChosenIdx(idxSaved >= 0 ? idxSaved : 0);
        }
      } catch {}
    }
    const d = destLatLon ? { lat: destLatLon.lat, lon: destLatLon.lon, display: destLabel } : await geocode(depPoint + (seg.originCity ? ` ${seg.originCity}` : ""));
    let distanceKm: number | undefined;
    let drivingMin: number | undefined;
    let walkingMin: number | undefined;
      let uberUrl: string | undefined;
      let gmapsUrl: string | undefined;
      let r2rUrl: string | undefined;
      let mapUrl: string | undefined;
    if (d) {
      const pos = await new Promise<GeolocationPosition | null>((resolve) => {
        try {
          if (!ensureLocationConsent()) { resolve(null); return; }
          navigator.geolocation.getCurrentPosition((p) => resolve(p), () => resolve(null), { enableHighAccuracy: true, maximumAge: 30000, timeout: 20000 });
        } catch { resolve(null); }
      });
      if (pos) {
        const cur = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        const osrmDrive = `https://router.project-osrm.org/route/v1/driving/${cur.lon},${cur.lat};${d.lon},${d.lat}?overview=false`;
        const resD = await fetch(osrmDrive);
        const jsD = await resD.json();
        const rD = jsD?.routes?.[0];
        if (rD) {
          distanceKm = Math.round((rD.distance ?? 0) / 1000);
          drivingMin = Math.round((rD.duration ?? 0) / 60);
        }
        try {
          const osrmWalk = `https://router.project-osrm.org/route/v1/walking/${cur.lon},${cur.lat};${d.lon},${d.lat}?overview=false`;
          const resW = await fetch(osrmWalk);
          const jsW = await resW.json();
          const rW = jsW?.routes?.[0];
          if (rW) walkingMin = Math.round((rW.duration ?? 0) / 60);
        } catch {}
        uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup[latitude]=${cur.lat}&pickup[longitude]=${cur.lon}&dropoff[latitude]=${d.lat}&dropoff[longitude]=${d.lon}&dropoff[formatted_address]=${encodeURIComponent(destLabel || depPoint)}`;
        gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${cur.lat}%2C${cur.lon}&destination=${encodeURIComponent(destLabel || depPoint)}`;
      } else {
        uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=${d.lat}&dropoff[longitude]=${d.lon}&dropoff[formatted_address]=${encodeURIComponent(destLabel || depPoint)}`;
        gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destLabel || depPoint)}`;
      }
      if (o && d) {
        const bbox = [Math.min(o.lon, d.lon), Math.min(o.lat, d.lat), Math.max(o.lon, d.lon), Math.max(o.lat, d.lat)];
        mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox.join("%2C")}&layer=mapnik`;
      }
      r2rUrl = `https://www.rome2rio.com/s/${encodeURIComponent(originAddr)}/${encodeURIComponent(destLabel || depPoint)}`;
    }
    if (!gmapsUrl) gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destLabel || depPoint)}`;
      if (!r2rUrl) r2rUrl = `https://www.rome2rio.com/s/${encodeURIComponent(originAddr)}/${encodeURIComponent(destLabel || depPoint)}`;
      if (!uberUrl) uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=${encodeURIComponent(destLabel || depPoint)}`;
      const trafficFactor = 1.3;
      const drivingWithTrafficMin = drivingMin ? Math.round(drivingMin * trafficFactor) : undefined;
      const busMin = drivingWithTrafficMin ? Math.round(drivingWithTrafficMin * 1.8) : undefined;
      const trainMin = drivingWithTrafficMin ? Math.round(drivingWithTrafficMin * 1.2) : undefined;
      let callTime: string | undefined;
      let notifyAt: string | undefined;
      if (item.date && item.time) {
        const [h, m] = (item.time || "00:00").split(":");
        const depDT = new Date(`${item.date}T${h.padStart(2, "0")}:${m.padStart(2, "0")}:00`);
        const bufferMin = 60;
        const travelMs = ((drivingWithTrafficMin ?? drivingMin ?? 30) + bufferMin) * 60 * 1000;
        const callAt = new Date(depDT.getTime() - travelMs);
        const notifyAtDate = new Date(callAt.getTime());
        const fmt = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        callTime = fmt(callAt);
        notifyAt = `${notifyAtDate.toLocaleDateString()} ${fmt(notifyAtDate)}`;
        try {
          if (typeof Notification !== "undefined") {
            if (Notification.permission === "default") await Notification.requestPermission();
            if (Notification.permission === "granted") {
              const delay = notifyAtDate.getTime() - Date.now();
              if (delay > 0 && delay < 365 * 24 * 60 * 60 * 1000) {
                setTimeout(() => {
                  new Notification("Lembrete de transporte", { body: `Chame o Uber às ${callTime}.` });
                }, delay);
              }
            }
          }
        } catch {}
      }
      setStayInfo({ origin: originAddr, destination: destLabel || depPoint, distanceKm, drivingMin: drivingWithTrafficMin ?? drivingMin, walkingMin, busMin, trainMin, uberUrl, gmapsUrl, r2rUrl, mapUrl, callTime, notifyAt });
    } catch {
      const gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originAddr)}&destination=${encodeURIComponent(depPoint)}`;
      const r2rUrl = `https://www.rome2rio.com/s/${encodeURIComponent(originAddr)}/${encodeURIComponent(depPoint)}`;
      const uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=${encodeURIComponent(depPoint)}`;
      setStayInfo({ origin: originAddr, destination: depPoint, gmapsUrl, r2rUrl, uberUrl });
      try { show(t("routeDetailedErrorUsingBasicLinks"), { variant: "info" }); } catch {}
    } finally {
      setStayLoading(false);
    }
  }

 

  async function openCheckinDrawer(item: EventItem) {
    if (item.type !== "stay") return;
    const m = item.meta as { city?: string; address?: string; kind: "checkin" | "checkout" } | undefined;
    if (!m || m.kind !== "checkin") return;
    setArrivalDrawerOpen(true);
    setArrivalInfo(null);
    const geocode = async (q: string) => {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      const js = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
      return js[0] ? { lat: Number(js[0].lat), lon: Number(js[0].lon), display: js[0].display_name } : null;
    };
    const dest = await geocode(m.address || m.city || "");
    if (!dest) {
      const q = (m.address || m.city || "").trim();
      const gmapsUrl = q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : undefined;
      const uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=${encodeURIComponent((m.address || m.city || "").trim())}`;
      setArrivalInfo({ city: m.city, address: m.address, gmapsUrl, uberUrl });
      try { showOnce("Destino não geocodificado. Usando busca genérica.", { variant: "info" }); } catch {}
      return;
    }
    const getPos = () => new Promise<GeolocationPosition | null>((resolve) => {
      try {
        if (!ensureLocationConsent()) { resolve(null); return; }
        navigator.geolocation.getCurrentPosition((p) => resolve(p), () => resolve(null), { enableHighAccuracy: true, maximumAge: 30000, timeout: 20000 });
      } catch { resolve(null); }
    });
    try {
      const pos = await getPos();
      if (!pos) {
        const q = (m.address || m.city || "").trim();
        const gmapsUrl = q ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}` : undefined;
        const uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=${dest.lat}&dropoff[longitude]=${dest.lon}&dropoff[formatted_address]=${encodeURIComponent(q)}`;
        setArrivalInfo({ city: m.city, address: m.address, gmapsUrl, uberUrl });
        try { showOnce("Sem localização atual. Links básicos foram gerados.", { variant: "info" }); } catch {}
        return;
      }
      const cur = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      const osrmDrive = `https://router.project-osrm.org/route/v1/driving/${cur.lon},${cur.lat};${dest.lon},${dest.lat}?overview=false`;
      const resD = await fetch(osrmDrive);
      const jsD = await resD.json();
      const rD = jsD?.routes?.[0];
      const drivingMin = rD ? Math.round((rD.duration ?? 0) / 60) : undefined;
      const osrmWalk = `https://router.project-osrm.org/route/v1/walking/${cur.lon},${cur.lat};${dest.lon},${dest.lat}?overview=false`;
      let walkingMin: number | undefined;
      try { const resW = await fetch(osrmWalk); const jsW = await resW.json(); const rW = jsW?.routes?.[0]; walkingMin = rW ? Math.round((rW.duration ?? 0) / 60) : undefined; } catch {}
      const trafficFactor = 1.3;
      const driveWithTraffic = drivingMin ? Math.round(drivingMin * trafficFactor) : undefined;
      const busMin = driveWithTraffic ? Math.round(driveWithTraffic * 1.8) : undefined;
      const trainMin = driveWithTraffic ? Math.round(driveWithTraffic * 1.2) : undefined;
      const gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${cur.lat}%2C${cur.lon}&destination=${encodeURIComponent(m.address || m.city || "")}`;
      const uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup[latitude]=${cur.lat}&pickup[longitude]=${cur.lon}&dropoff[latitude]=${dest.lat}&dropoff[longitude]=${dest.lon}&dropoff[formatted_address]=${encodeURIComponent(m.address || m.city || "")}`;
      const distKm = (() => {
        const toRad = (v: number) => (v * Math.PI) / 180;
        const R = 6371;
        const dLat = toRad(dest.lat - cur.lat);
        const dLon = toRad(dest.lon - cur.lon);
        const lat1 = toRad(cur.lat);
        const lat2 = toRad(dest.lat);
        const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
        return Math.round(2 * R * Math.asin(Math.sqrt(h)));
      })();
      const priceEstimate = Math.round((distKm || 0) * 6 + 3);
      setArrivalInfo({ city: m.city, address: m.address, distanceKm: distKm, walkingMin, drivingMin: driveWithTraffic ?? drivingMin, busMin, trainMin, priceEstimate, uberUrl, gmapsUrl });
    } catch {
      const q = (m.address || m.city || "").trim();
      const gmapsUrl = q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : undefined;
      const uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=${encodeURIComponent(q)}`;
      setArrivalInfo({ city: m.city, address: m.address, gmapsUrl, uberUrl });
      try { showOnce("Erro ao calcular rota. Usando links básicos.", { variant: "info" }); } catch {}
    }
  }

  async function openGoDrawer(item: EventItem) {
    if (!(item.type === "activity" || item.type === "restaurant")) return;
    const rec = item.meta as RecordItem;
    setGoRecord(rec);
    setGoDrawerOpen(true);
    setGoLoading(true);
    try {
      const getPos = () => new Promise<GeolocationPosition | null>((resolve) => {
        if (!navigator.geolocation) resolve(null);
        if (!ensureLocationConsent()) { resolve(null); return; }
        navigator.geolocation.getCurrentPosition((p) => resolve(p), () => resolve(null), { enableHighAccuracy: true, maximumAge: 30000, timeout: 20000 });
      });
      const geocode = async (q: string) => {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        const js = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
        return js[0] ? { lat: Number(js[0].lat), lon: Number(js[0].lon), display: js[0].display_name } : null;
      };
      const query = `${rec.title} ${rec.cityName}`.trim();
      const dest = await geocode(query);
      const pos = await getPos();
      let walkingMin: number | undefined;
      let drivingMin: number | undefined;
      let gmapsUrl: string | undefined;
      let uberUrl: string | undefined;
      let busMin: number | undefined;
      let trainMin: number | undefined;
      let distanceKm: number | undefined;
      if (dest && pos) {
        const cur = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        const osrmDrive = `https://router.project-osrm.org/route/v1/driving/${cur.lon},${cur.lat};${dest.lon},${dest.lat}?overview=false`;
        const resD = await fetch(osrmDrive);
        const jsD = await resD.json();
        const rD = jsD?.routes?.[0];
        if (rD) {
          drivingMin = Math.round((rD.duration ?? 0) / 60);
          distanceKm = Math.round((rD.distance ?? 0) / 1000);
        }
        try {
          const osrmWalk = `https://router.project-osrm.org/route/v1/walking/${cur.lon},${cur.lat};${dest.lon},${dest.lat}?overview=false`;
          const resW = await fetch(osrmWalk);
          const jsW = await resW.json();
          const rW = jsW?.routes?.[0];
          if (rW) walkingMin = Math.round((rW.duration ?? 0) / 60);
        } catch {}
        const trafficFactor = 1.3;
        const driveWithTraffic = drivingMin ? Math.round(drivingMin * trafficFactor) : undefined;
        busMin = driveWithTraffic ? Math.round(driveWithTraffic * 1.8) : undefined;
        trainMin = driveWithTraffic ? Math.round(driveWithTraffic * 1.2) : undefined;
        const priceEstimate = Math.round((distanceKm || 0) * 6 + 3);
        gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${cur.lat}%2C${cur.lon}&destination=${encodeURIComponent(query)}`;
        uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup[latitude]=${cur.lat}&pickup[longitude]=${cur.lon}&dropoff[latitude]=${dest.lat}&dropoff[longitude]=${dest.lon}&dropoff[formatted_address]=${encodeURIComponent(query)}`;
        setGoInfo({ destination: query, distanceKm, walkingMin, drivingMin: driveWithTraffic ?? drivingMin, busMin, trainMin, priceEstimate, uberUrl, gmapsUrl });
      } else if (dest && !pos) {
        gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
        uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=${dest.lat}&dropoff[longitude]=${dest.lon}&dropoff[formatted_address]=${encodeURIComponent(query)}`;
        setGoInfo({ destination: query, gmapsUrl, uberUrl });
        try { show(t("noCurrentLocationUsingBasicLinks"), { variant: "info" }); } catch {}
      } else {
        gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
        uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=${encodeURIComponent(query)}`;
        setGoInfo({ destination: query, gmapsUrl, uberUrl });
        try { show(t("destNotGeocodedGenericSearch"), { variant: "info" }); } catch {}
      }
    } catch {
      const q = `${rec.title} ${rec.cityName}`.trim();
      const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
      const uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=${encodeURIComponent(q)}`;
      setGoInfo({ destination: q, gmapsUrl, uberUrl });
      try { showOnce("Erro ao calcular rota. Usando links básicos.", { variant: "info" }); } catch {}
    } finally {
      setGoLoading(false);
    }
  }

 

  const openReturnAirportDrawer = useCallback(async () => {
    if (!summaryCities.length) return;
    const last = summaryCities[summaryCities.length - 1];
    if (!last.address) return;
    setReturnDrawerOpen(true);
    setReturnLoading(true);
    try {
      const trips: TripItem[] = getTrips();
      const notes = trips.flatMap((t) => (t.flightNotes || [])).filter((n) => n.leg === "inbound" && n.origin && n.date && n.departureTime);
      if (!notes.length) { setReturnInfo({ city: last.name, address: last.address }); return; }
      const sortedNotes = [...notes].sort((a, b) => new Date(`${a.date}T${(a.departureTime || "00:00").padStart(5, "0")}:00`).getTime() - new Date(`${b.date}T${(b.departureTime || "00:00").padStart(5, "0")}:00`).getTime());
      const fn = sortedNotes[sortedNotes.length - 1];
      const trip = trips.find((t) => (t.flightNotes || []).some((n) => n.leg === "inbound" && n.origin === fn.origin && n.destination === fn.destination && n.date === fn.date && n.departureTime === fn.departureTime));
      setReturnFiles((trip?.attachments || []).filter((a) => a.leg === "inbound").map((a) => ({ name: a.name, type: a.type, size: a.size, dataUrl: a.dataUrl })));
      const airport = await findAirportByIata(fn.origin);
      const geocode = async (q: string) => {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        const js = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
        return js[0] ? { lat: Number(js[0].lat), lon: Number(js[0].lon), display: js[0].display_name } : null;
      };
      const o = await geocode(last.address || "");
      const d = await geocode(airport ? `${airport.name} (${airport.iata})` : `${fn.origin} airport`);
      const getPos = () => new Promise<GeolocationPosition | null>((resolve) => {
        try {
          if (!ensureLocationConsent()) { resolve(null); return; }
          navigator.geolocation.getCurrentPosition((p) => resolve(p), () => resolve(null), { enableHighAccuracy: true, maximumAge: 30000, timeout: 20000 });
        } catch { resolve(null); }
      });
      const reverseName = async (lat: number, lon: number) => {
        try {
          const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
          const res = await fetch(url, { headers: { Accept: "application/json" } });
          const js = await res.json();
          const name = js?.display_name as string | undefined;
          return name;
        } catch { return undefined; }
      };
      let walkingMin: number | undefined;
      let drivingMin: number | undefined;
      let busMin: number | undefined;
      let trainMin: number | undefined;
      let distanceKm: number | undefined;
      let gmapsUrl: string | undefined;
      let r2rUrl: string | undefined;
      let uberUrl: string | undefined;
      let callTime: string | undefined;
      let notifyAt: string | undefined;
      let priceEstimate: number | undefined;
      const pos = await getPos();
      if (d && pos) {
        const cur = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        const osrmDrive = `https://router.project-osrm.org/route/v1/driving/${cur.lon},${cur.lat};${d.lon},${d.lat}?overview=false`;
        const resD = await fetch(osrmDrive);
        const jsD = await resD.json();
        const rD = jsD?.routes?.[0];
        if (rD) {
          drivingMin = Math.round((rD.duration ?? 0) / 60);
          distanceKm = Math.round((rD.distance ?? 0) / 1000);
          priceEstimate = Math.round((distanceKm || 0) * 6 + 3);
        }
        try {
          const osrmWalk = `https://router.project-osrm.org/route/v1/walking/${cur.lon},${cur.lat};${d.lon},${d.lat}?overview=false`;
          const resW = await fetch(osrmWalk);
          const jsW = await resW.json();
          const rW = jsW?.routes?.[0];
          if (rW) walkingMin = Math.round((rW.duration ?? 0) / 60);
        } catch {}
        const trafficFactor = 1.3;
        const driveWithTraffic = drivingMin ? Math.round(drivingMin * trafficFactor) : undefined;
        busMin = driveWithTraffic ? Math.round(driveWithTraffic * 1.8) : undefined;
        trainMin = driveWithTraffic ? Math.round(driveWithTraffic * 1.2) : undefined;
        gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${cur.lat}%2C${cur.lon}&destination=${encodeURIComponent(airport ? `${airport.name} (${airport.iata})` : `${fn.origin} airport`)}`;
        const originAddr = (await reverseName(cur.lat, cur.lon)) || `${cur.lat},${cur.lon}`;
        r2rUrl = buildRome2RioUrl({
          originName: originAddr,
          destName: airport ? `${airport.name} (${airport.iata})` : `${fn.origin} airport`,
          originLat: cur.lat,
          originLon: cur.lon,
          destLat: d.lat,
          destLon: d.lon,
          date: fn.date,
          time: fn.departureTime,
          passengers: trip?.passengers,
          lang: "pt-BR",
          currency: "BRL",
        });
        uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=${d.lat}&dropoff[longitude]=${d.lon}&dropoff[formatted_address]=${encodeURIComponent(airport ? `${airport.name} (${airport.iata})` : `${fn.origin} airport`)}`;
        if (fn.departureTime && fn.date) {
          const [h, m] = (fn.departureTime || "00:00").split(":");
          const dt = new Date(`${fn.date}T${h.padStart(2, "0")}:${m.padStart(2, "0")}:00`);
          const mins = 240 + (driveWithTraffic ?? drivingMin ?? 60);
          const callAt = new Date(dt.getTime() - mins * 60 * 1000);
          const notifyAtDate = new Date(callAt.getTime() - 2 * 60 * 60 * 1000);
          const fmt = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
          callTime = fmt(callAt);
          notifyAt = `${notifyAtDate.toLocaleDateString()} ${fmt(notifyAtDate)}`;
          try {
            if (typeof Notification !== "undefined") {
              if (Notification.permission === "default") await Notification.requestPermission();
              if (Notification.permission === "granted") {
                const delay = notifyAtDate.getTime() - Date.now();
                if (delay > 0 && delay < 365 * 24 * 60 * 60 * 1000) {
                  setTimeout(() => {
                    try { new Notification("Lembrete de transporte", { body: `Chame o Uber às ${callTime}.` }); } catch {}
                  }, delay);
                }
              }
            }
          } catch {}
        }
      } else if (o && d) {
        const osrmDrive = `https://router.project-osrm.org/route/v1/driving/${o.lon},${o.lat};${d.lon},${d.lat}?overview=false`;
        const resD = await fetch(osrmDrive);
        const jsD = await resD.json();
        const rD = jsD?.routes?.[0];
        if (rD) {
          drivingMin = Math.round((rD.duration ?? 0) / 60);
          distanceKm = Math.round((rD.distance ?? 0) / 1000);
          priceEstimate = Math.round((distanceKm || 0) * 6 + 3);
        }
        try {
          const osrmWalk = `https://router.project-osrm.org/route/v1/walking/${o.lon},${o.lat};${d.lon},${d.lat}?overview=false`;
          const resW = await fetch(osrmWalk);
          const jsW = await resW.json();
          const rW = jsW?.routes?.[0];
          if (rW) walkingMin = Math.round((rW.duration ?? 0) / 60);
        } catch {}
        const trafficFactor = 1.3;
        const driveWithTraffic = drivingMin ? Math.round(drivingMin * trafficFactor) : undefined;
        busMin = driveWithTraffic ? Math.round(driveWithTraffic * 1.8) : undefined;
        trainMin = driveWithTraffic ? Math.round(driveWithTraffic * 1.2) : undefined;
        gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(last.address)}&destination=${encodeURIComponent(airport ? `${airport.name} (${airport.iata})` : `${fn.origin} airport`)}`;
        r2rUrl = buildRome2RioUrl({
          originName: last.address || "Origem",
          destName: airport ? `${airport.name} (${airport.iata})` : `${fn.origin} airport`,
          originLat: o.lat,
          originLon: o.lon,
          destLat: d.lat,
          destLon: d.lon,
          date: fn.date,
          time: fn.departureTime,
          passengers: trip?.passengers,
          lang: "pt-BR",
          currency: "BRL",
        });
        uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=${d.lat}&dropoff[longitude]=${d.lon}&dropoff[formatted_address]=${encodeURIComponent(airport ? `${airport.name} (${airport.iata})` : `${fn.origin} airport`)}`;
        if (fn.departureTime && fn.date) {
          const [h, m] = (fn.departureTime || "00:00").split(":");
          const dt = new Date(`${fn.date}T${h.padStart(2, "0")}:${m.padStart(2, "0")}:00`);
          const mins = 240 + (driveWithTraffic ?? drivingMin ?? 60);
          const callAt = new Date(dt.getTime() - mins * 60 * 1000);
          const notifyAtDate = new Date(callAt.getTime() - 2 * 60 * 60 * 1000);
          const fmt = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
          callTime = fmt(callAt);
          notifyAt = `${notifyAtDate.toLocaleDateString()} ${fmt(notifyAtDate)}`;
          
        }
      } else {
        gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(airport ? `${airport.name} (${airport.iata})` : `${fn.origin} airport`)}`;
        r2rUrl = buildRome2RioUrl({
          originName: last.address || "Origem",
          destName: airport ? `${airport.name} (${airport.iata})` : `${fn.origin} airport`,
          lang: "pt-BR",
          currency: "BRL",
        });
        uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=${encodeURIComponent(airport ? `${airport.name} (${airport.iata})` : `${fn.origin} airport`)}`;
        try { showOnce("Destino não geocodificado. Usando links básicos.", { variant: "info" }); } catch {}
      }
      setReturnInfo({ city: last.name, address: last.address, airportName: airport ? `${airport.name} (${airport.iata})` : `${fn.origin} airport`, distanceKm, walkingMin, drivingMin, busMin, trainMin, priceEstimate, uberUrl, gmapsUrl, r2rUrl, callTime, notifyAt });
    } catch {
      const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent("aeroporto")}`;
      const uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=${encodeURIComponent(summaryCities[summaryCities.length - 1]?.address || "aeroporto")}`;
      const r2rUrl = buildRome2RioUrl({ originName: summaryCities[summaryCities.length - 1]?.address || "Origem", destName: "aeroporto", lang: "pt-BR", currency: "BRL" });
      setReturnInfo({ city: summaryCities[summaryCities.length - 1]?.name, address: summaryCities[summaryCities.length - 1]?.address, gmapsUrl, uberUrl, r2rUrl });
      try { showOnce("Erro ao calcular rota. Usando links básicos.", { variant: "info" }); } catch {}
    } finally {
      setReturnLoading(false);
    }
  }, [summaryCities, ensureLocationConsent, showOnce]);

  useEffect(() => {
    if (!summaryCities.length) return;
    const last = summaryCities[summaryCities.length - 1];
    if (!last.address) return;
    const trips: TripItem[] = getTrips();
    const notes = trips.flatMap((t) => (t.flightNotes || [])).filter((n) => n.leg === "inbound" && n.origin && n.date && n.departureTime);
    if (!notes.length) return;
    (async () => {
      const sortedNotes = [...notes].sort((a, b) => new Date(`${a.date}T${(a.departureTime || "00:00").padStart(5, "0")}:00`).getTime() - new Date(`${b.date}T${(b.departureTime || "00:00").padStart(5, "0")}:00`).getTime());
      const fn = sortedNotes[sortedNotes.length - 1];
      const airport = await findAirportByIata(fn.origin);
      const geocode = async (q: string) => {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        const js = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
        return js[0] ? { lat: Number(js[0].lat), lon: Number(js[0].lon), display: js[0].display_name } : null;
      };
      const o = await geocode(last.address || "");
      const d = await geocode(airport ? `${airport.name} (${airport.iata})` : `${fn.origin} airport`);
      if (!(o && d)) return;
      let drivingMin: number | undefined;
      let distanceKm: number | undefined;
      try {
        const osrmDrive = `https://router.project-osrm.org/route/v1/driving/${o.lon},${o.lat};${d.lon},${d.lat}?overview=false`;
        const resD = await fetch(osrmDrive);
        const jsD = await resD.json();
        const rD = jsD?.routes?.[0];
        if (rD) { drivingMin = Math.round((rD.duration ?? 0) / 60); distanceKm = Math.round((rD.distance ?? 0) / 1000); }
      } catch {}
      const trafficFactor = 1.3;
      const driveWithTraffic = drivingMin ? Math.round(drivingMin * trafficFactor) : undefined;
      if (fn.departureTime && fn.date) {
        const [h, m] = (fn.departureTime || "00:00").split(":");
        const dt = new Date(`${fn.date}T${h.padStart(2, "0")}:${m.padStart(2, "0")}:00`);
        const mins = 240 + (driveWithTraffic ?? drivingMin ?? 60);
        const notifyTime = new Date(dt.getTime() - mins * 60 * 1000);
        const delay = notifyTime.getTime() - Date.now();
        if (delay > 0) {
          const id = window.setTimeout(() => {
            setReturnDrawerOpen(true);
            openReturnAirportDrawer();
            try {
              const lines = [
                `Destino: ${airport ? `${airport.name} (${airport.iata})` : `${fn.origin} airport`}`,
                `Partida: ${fn.date} ${fn.departureTime}`,
                distanceKm !== undefined ? `Distância: ${distanceKm} km` : `Distância: —`,
                driveWithTraffic !== undefined ? `Tempo estimado: ${driveWithTraffic} min` : (drivingMin !== undefined ? `Tempo estimado: ${drivingMin} min` : `Tempo estimado: —`),
              ];
              new Notification("Transporte até o aeroporto de volta", { body: lines.join("\n") });
            } catch {}
            try { if (!transportToastShown.current.return) { showOnce("Opções de deslocamento disponíveis", { variant: "info" }); transportToastShown.current.return = true; } } catch {}
          }, delay);
          returnTimer.current = id;
        }
      }
    })();
    return () => {
      if (returnTimer.current) { try { clearTimeout(returnTimer.current); } catch {} returnTimer.current = null; }
    };
  }, [summaryCities, openReturnAirportDrawer, showOnce]);

  useEffect(() => {
    const checkins = events.filter((e) => {
      if (e.type !== "stay") return false;
      const m = e.meta as { city?: string; address?: string; kind: "checkin" | "checkout" } | undefined;
      return m?.kind === "checkin";
    });
    if (!checkins.length || typeof window === "undefined") return;
    const geocode = async (q: string) => {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      const js = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
      return js[0] ? { lat: Number(js[0].lat), lon: Number(js[0].lon), display: js[0].display_name } : null;
    };
    const distanceKm = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
      const toRad = (v: number) => (v * Math.PI) / 180;
      const R = 6371;
      const dLat = toRad(b.lat - a.lat);
      const dLon = toRad(b.lon - a.lon);
      const lat1 = toRad(a.lat);
      const lat2 = toRad(b.lat);
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(h));
    };
    const ensurePermission = async () => {
      if (typeof Notification === "undefined") return false;
      if (Notification.permission === "default") await Notification.requestPermission();
      return Notification.permission === "granted";
    };
    checkins.forEach(async (e) => {
      const m = e.meta as { city?: string; address?: string; kind: "checkin" | "checkout" } | undefined;
      const city = m?.city || "";
      const addr = m?.address || "";
      const key = `${city}-${addr}`;
      if (arrivalWatchIds.current[key]) return;
      const dest = await geocode(addr || city);
      if (!dest) return;
      const ok = await ensurePermission();
      const thresholdKm = 3;
      if (!ensureLocationConsent()) return;
      const watchId = navigator.geolocation.watchPosition(
        async (pos) => {
          const cur = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          const d = distanceKm(cur, dest);
      if (d <= thresholdKm && !arrivalNotified.current[key]) {
        arrivalNotified.current[key] = true;
        if (ok) {
          try { new Notification(`Bem-vindo(a) a ${city}`, { body: `Você está a ~${Math.round(d)} km do destino.` }); } catch {}
          try { show(`Bem-vindo(a) a ${city}`, { variant: "success" }); } catch {}
        }
        setTimeout(async () => {
          try {
            const osrmDrive = `https://router.project-osrm.org/route/v1/driving/${cur.lon},${cur.lat};${dest.lon},${dest.lat}?overview=false`;
            const resD = await fetch(osrmDrive);
            const jsD = await resD.json();
            const rD = jsD?.routes?.[0];
            const drivingMin = rD ? Math.round((rD.duration ?? 0) / 60) : undefined;
            const osrmWalk = `https://router.project-osrm.org/route/v1/walking/${cur.lon},${cur.lat};${dest.lon},${dest.lat}?overview=false`;
            let walkingMin: number | undefined;
            try { const resW = await fetch(osrmWalk); const jsW = await resW.json(); const rW = jsW?.routes?.[0]; walkingMin = rW ? Math.round((rW.duration ?? 0) / 60) : undefined; } catch {}
            const trafficFactor = 1.3;
            const driveWithTraffic = drivingMin ? Math.round(drivingMin * trafficFactor) : undefined;
            const busMin = driveWithTraffic ? Math.round(driveWithTraffic * 1.8) : undefined;
            const trainMin = driveWithTraffic ? Math.round(driveWithTraffic * 1.2) : undefined;
            const uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=${dest.lat}&dropoff[longitude]=${dest.lon}&dropoff[formatted_address]=${encodeURIComponent(addr || city)}`;
            const gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${cur.lat}%2C${cur.lon}&destination=${encodeURIComponent(addr || city)}`;
            if (ok) {
              const lines = [
                `Distância: ${Math.round(d)} km`,
                `A pé: ${walkingMin ? `${walkingMin} min` : "—"}`,
                `Ônibus: ${busMin ? `${busMin} min` : "—"}`,
                `Trem/Metro: ${trainMin ? `${trainMin} min` : "—"}`,
                `Uber/Táxi: ${driveWithTraffic ?? drivingMin ?? "—"} min • R$${Math.round((d || 0) * 6 + 3)}`,
                `Uber: ${uberUrl}`,
                `Maps: ${gmapsUrl}`,
              ];
              try { new Notification(`Opções de deslocamento até a hospedagem`, { body: lines.join("\n") }); } catch {}
              try { if (!transportToastShown.current.arrival) { showOnce("Opções de deslocamento disponíveis", { variant: "info" }); transportToastShown.current.arrival = true; } } catch {}
            }
            setArrivalInfo({ city, address: addr || city, distanceKm: Math.round(d), walkingMin, drivingMin: driveWithTraffic ?? drivingMin, busMin, trainMin, uberUrl, gmapsUrl });
            setArrivalDrawerOpen(true);
          } catch {}
        }, 60 * 1000);
      }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 20000 }
      );
      arrivalWatchIds.current[key] = watchId;
    });
    return () => {
      Object.values(arrivalWatchIds.current).forEach((id) => {
        try { navigator.geolocation.clearWatch(id); } catch {}
      });
      arrivalWatchIds.current = {};
    };
  }, [events, ensureLocationConsent, show, showOnce]);

  return (
    <div className="min-h-screen pl-14 pr-4 py-6 space-y-6">
      {locModalOpen ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="max-w-md w-full bg-white rounded-xl p-5 space-y-3">
            <DialogHeader>Permitir localização</DialogHeader>
            <div className="text-sm text-zinc-700">
              A localização é usada para estimar rotas, tempo e opções de transporte até sua hospedagem e aeroporto.
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  try { localStorage.setItem("calentrip:locConsent", "skipped"); } catch {}
                  setLocConsent("skipped");
                  setLocModalOpen(false);
                }}
              >
                Pular
              </Button>
              <Button
                type="button"
                onClick={() => {
                  try {
                    if (!navigator.geolocation) {
                      try { localStorage.setItem("calentrip:locConsent", "denied"); } catch {}
                      setLocConsent("denied");
                      setLocModalOpen(false);
                      return;
                    }
                    navigator.geolocation.getCurrentPosition(
                      () => {
                        try { localStorage.setItem("calentrip:locConsent", "granted"); } catch {}
                        setLocConsent("granted");
                        setLocModalOpen(false);
                      },
                      () => {
                        try { localStorage.setItem("calentrip:locConsent", "denied"); } catch {}
                        setLocConsent("denied");
                        setLocModalOpen(false);
                      },
                      { enableHighAccuracy: true, timeout: 10000 }
                    );
                  } catch {
                    try { localStorage.setItem("calentrip:locConsent", "denied"); } catch {}
                    setLocConsent("denied");
                    setLocModalOpen(false);
                  }
                }}
              >
                Ativar localização
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {gating?.show ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="max-w-md w-full bg-white rounded-xl p-5 space-y-3">
            <DialogHeader>{gating.reason === "anon" ? t("loginUnlockTitle") : t("subscriptionNeededTitle")}</DialogHeader>
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
                  <Button type="button" onClick={() => signIn("google")}>{t("signInWithGoogle")}</Button>
                  <Button type="button" variant="secondary" onClick={() => signIn("credentials", { email: "demo@calentrip.com", password: "demo", callbackUrl: "/calendar/final" })}>{t("signInDemo")}</Button>
                </>
              ) : (
                <Button
                  type="button"
                  onClick={async () => {
                    try {
                      if (!gating?.tripId) return;
                      const userId = session?.user?.email || session?.user?.name || undefined;
                      const mod = await import("@/lib/billing");
                      const r = await mod.completePurchaseForTrip(gating.tripId, userId);
                      if (r?.ok) {
                        setPremiumFlag(true);
                        setGating(null);
                        show(t("purchaseSuccess"), { variant: "success" });
                      } else {
                        const msg = r?.error === "billing"
                          ? "Disponível no app Android. Instale via Google Play."
                          : r?.error === "product" ? "Produto não encontrado no Google Play."
                          : r?.error === "purchase" ? "Compra cancelada ou falhou."
                          : r?.error === "token" ? "Token de compra não recebido."
                          : r?.error === "verify" ? "Falha ao verificar a compra."
                          : r?.error === "ack" ? "Falha ao confirmar a compra."
                          : r?.error === "store" ? "Falha ao salvar assinatura."
                          : "Falha na compra";
                        show(msg, { variant: "error" });
                        if (r?.error === "billing") { try { window.location.href = "/profile"; } catch {} }
                      }
                    } catch {
                      show(t("purchaseError"), { variant: "error" });
                    }
                  }}
                >
                  {t("subscribeMonthlyButton")}
                </Button>
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
          {/* botão de instalação removido conforme solicitação */}
        </div>
        <div className="p-2 space-y-2">
          <div className="rounded-md border border-zinc-200 dark:border-zinc-800 p-2">
            {status === "authenticated" ? (
              <div className="flex items-center gap-2">
                {session?.user?.image ? (
                  <Image src={session.user.image} alt="avatar" width={32} height={32} className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-xs">
                    {(session?.user?.name || session?.user?.email || "PF").slice(0, 2).toUpperCase()}
                  </span>
                )}
                {sideOpen ? (
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{session?.user?.name || "Usuário"}</div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400">{session?.user?.email || ""}</div>
                    <div className="mt-1 text-[10px] text-zinc-500">Idioma: {lang.toUpperCase()}</div>
                    <div className="mt-1 text-[10px] text-zinc-500">{t("planWord")}: {premiumFlag ? `${t("premiumWord")}${premiumUntil ? ` ${t("untilWord")} ${premiumUntil}` : ""}` : t("freeWord")}</div>
                    {!premiumFlag && currentTripId ? (
                      <div className="mt-2">
                        <Button type="button" onClick={async () => {
                          try {
                            const userId = session?.user?.email || session?.user?.name || undefined;
                            const mod = await import("@/lib/billing");
                            const r = await mod.completePurchaseForTrip(currentTripId, userId);
                            if (r?.ok) { setPremiumFlag(true); show(t("purchaseSuccess"), { variant: "success" }); }
                            else { show(t("purchaseFail"), { variant: "error" }); }
                          } catch { show(t("purchaseError"), { variant: "error" }); }
                        }}>{t("activatePremiumButton")}</Button>
                      </div>
                    ) : null}
                    <div className="mt-2 flex items-center gap-2">
                      <button type="button" className="underline text-xs" onClick={() => { try { window.location.href = "/profile"; } catch {} }}>{t("viewProfile")}</button>
                      <button type="button" className="text-xs" onClick={() => signOut()}>{t("signOut")}</button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-xs">PF</span>
                {sideOpen ? (
                  <div className="flex-1">
                    <div className="text-sm font-semibold">Entrar</div>
                    <div className="mt-1 text-[10px] text-zinc-500">Idioma: {lang.toUpperCase()}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <button type="button" className="text-xs" onClick={() => signIn("google")}>Google</button>
                      <button type="button" className="text-xs" onClick={() => signIn("credentials", { email: "demo@calentrip.com", password: "demo", callbackUrl: "/flights/search" })}>Demo</button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
          
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-md px-3 h-10 hover:bg-zinc-50 dark:hover:bg-zinc-900"
            onClick={() => {
              try {
                if (typeof window !== "undefined") {
                  localStorage.removeItem("calentrip_trip_summary");
                  localStorage.removeItem("calentrip:entertainment:records");
                  localStorage.removeItem("calentrip:tripSearch");
                  localStorage.removeItem("calentrip:arrivalNextDay_outbound");
                  localStorage.removeItem("calentrip:arrivalNextDay_inbound");
                }
                setEvents([]);
              } catch {}
              try { window.location.href = "/flights/search"; } catch {}
            }}
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800">
              <span className="material-symbols-outlined text-[22px] text-[#007AFF]">travel_explore</span>
            </span>
            {sideOpen ? <span className="text-sm font-medium">Iniciar nova pesquisa</span> : null}
          </button>
          <button type="button" className="flex w-full items-center gap-3 rounded-md px-3 h-10 hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={() => {
            try {
              const trips = getTrips();
              setSavedTripsList(trips);
            } catch { setSavedTripsList([]); }
            try {
              const rawList = typeof window !== "undefined" ? localStorage.getItem("calentrip:saved_calendars_list") : null;
              const list = rawList ? (JSON.parse(rawList) as Array<{ name: string; events: EventItem[]; savedAt?: string }>) : [];
              setSavedCalendarsList(list);
            } catch { setSavedCalendarsList([]); }
            setSavedDrawerOpen(true);
          }}>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800">
              <span className="material-symbols-outlined text-[22px] text-[#007AFF]">lists</span>
            </span>
            {sideOpen ? <span className="text-sm font-medium">Pesquisas salvas</span> : null}
          </button>
          <button type="button" className="flex w-full items-center gap-3 rounded-md px-3 h-10 hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={() => { try { window.location.href = "/calendar/final"; } catch {} }}>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800">
              <span className="material-symbols-outlined text-[22px] text-[#007AFF]">list_alt</span>
            </span>
            {sideOpen ? <span className="text-sm font-medium">Calendário em lista</span> : null}
          </button>
          
          <button type="button" className="flex w-full items-center gap-3 rounded-md px-3 h-10 hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={async () => {
            const ok = saveCalendarNamed(false);
            if (ok) {
              try { await saveCalendarFull(); } catch {}
              setCalendarHelpOpen(true);
            }
          }}>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800">
              <span className="material-symbols-outlined text-[22px] text-[#007AFF]">bookmark_add</span>
            </span>
          {sideOpen ? <span className="text-sm font-medium">{t("saveCalendarButton")}</span> : null}
          </button>
          <button type="button" className="flex w-full items-center gap-3 rounded-md px-3 h-10 hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={() => {
            const subject = encodeURIComponent("Calendário da viagem");
            const body = encodeURIComponent(events.map((e) => `${e.date} ${e.time || ""} • ${e.label}`).join("\n"));
            const a = document.createElement("a");
            a.href = `mailto:?subject=${subject}&body=${body}`;
            a.style.display = "none";
            document.body.appendChild(a);
            a.click();
            a.remove();
            show(t("openingEmailMsg"), { variant: "info" });
          }}>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800">
              <span className="material-symbols-outlined text-[22px] text-[#007AFF]">mail</span>
            </span>
            {sideOpen ? <span className="text-sm font-medium">Enviar por e-mail</span> : null}
          </button>
          {false && (<button type="button" className="flex w-full items-center gap-3 rounded-md px-3 h-10 hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={async () => {
            try {
              const ok = saveCalendarNamed();
              if (ok) { setCalendarHelpOpen(true); return; }
            } catch {}
            setCalendarHelpOpen(true);
            return;
            const text = events.map((e) => `${e.date} ${e.time || ""} • ${e.label}`).join("\n");
            try {
              if (navigator.share) { await navigator.share({ title: "Calendário", text }); show(t("sharedMsg"), { variant: "success" }); return; }
              await navigator.clipboard.writeText(text);
              show(t("calendarCopiedMsg"), { variant: "success" });
            } catch { show(t("shareErrorMsg"), { variant: "error" }); }
          }}>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800">
              <span className="material-symbols-outlined text-[22px] text-[#007AFF]">share</span>
            </span>
            {sideOpen ? <span className="text-sm font-medium">Compartilhar calendário</span> : null}
          </button>)}
          <button type="button" className="flex w-full items-center gap-3 rounded-md px-3 h-10 hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={async () => {
            function fmt(d: Date) {
              const y = String(d.getFullYear());
              const m = String(d.getMonth() + 1).padStart(2, "0");
              const da = String(d.getDate()).padStart(2, "0");
              const h = String(d.getHours()).padStart(2, "0");
              const mi = String(d.getMinutes()).padStart(2, "0");
              const s = "00";
              return `${y}${m}${da}T${h}${mi}${s}`;
            }
            function fmtUTC(d: Date) {
              const y = String(d.getUTCFullYear());
              const m = String(d.getUTCMonth() + 1).padStart(2, "0");
              const da = String(d.getUTCDate()).padStart(2, "0");
              const h = String(d.getUTCHours()).padStart(2, "0");
              const mi = String(d.getUTCMinutes()).padStart(2, "0");
              const s = String(d.getUTCSeconds()).padStart(2, "0");
              return `${y}${m}${da}T${h}${mi}${s}Z`;
            }
            function parseDT(date: string, time?: string) {
              const t = (time || "00:00").padStart(5, "0");
              const s = `${(date || "").replace(/\//g, "-")}T${t}:00`;
              const d = new Date(s);
              if (Number.isNaN(d.getTime())) return null;
              return d;
            }
            async function geocode(q: string) {
              const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
              const res = await fetch(url, { headers: { Accept: "application/json" } });
              const js = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
              return js[0] ? { lat: Number(js[0].lat), lon: Number(js[0].lon), display: js[0].display_name } : null;
            }
            async function computeReturnDetails() {
              if (!summaryCities.length) return null as null | {
                airportName: string;
                distanceKm?: number;
                walkingMin?: number;
                drivingMin?: number;
                busMin?: number;
                trainMin?: number;
                priceEstimate?: number;
                gmapsUrl?: string;
                uberUrl?: string;
                callTime?: string;
                notifyAt?: string;
                callAtISO?: string;
                notifyAtISO?: string;
              };
              const trips: TripItem[] = getTrips();
              const notes = trips.flatMap((t) => (t.flightNotes || [])).filter((n) => n.leg === "inbound" && n.origin && n.date && n.departureTime);
              if (!notes.length) return null;
              const fn = [...notes].sort((a, b) => new Date(`${a.date}T${(a.departureTime || "00:00").padStart(5, "0")}:00`).getTime() - new Date(`${b.date}T${(b.departureTime || "00:00").padStart(5, "0")}:00`).getTime()).slice(-1)[0];
              const airport = await findAirportByIata(fn.origin);
              const last = summaryCities[summaryCities.length - 1];
              if (!last?.address) return null;
              const o = await geocode(last.address);
              const d = await geocode(airport ? `${airport.name} (${airport.iata})` : `${fn.origin} airport`);
              let walkingMin: number | undefined;
              let drivingMin: number | undefined;
              let busMin: number | undefined;
              let trainMin: number | undefined;
              let distanceKm: number | undefined;
              let gmapsUrl: string | undefined;
              let uberUrl: string | undefined;
              let callTime: string | undefined;
              let notifyAt: string | undefined;
              let priceEstimate: number | undefined;
              let callAtISO: string | undefined;
              let notifyAtISO: string | undefined;
              if (o && d) {
                const osrmDrive = `https://router.project-osrm.org/route/v1/driving/${o.lon},${o.lat};${d.lon},${d.lat}?overview=false`;
                try {
                  const resD = await fetch(osrmDrive);
                  const jsD = await resD.json();
                  const rD = jsD?.routes?.[0];
                  if (rD) {
                    drivingMin = Math.round((rD.duration ?? 0) / 60);
                    distanceKm = Math.round((rD.distance ?? 0) / 1000);
                    priceEstimate = Math.round((distanceKm || 0) * 6 + 3);
                  }
                } catch {}
                try {
                  const osrmWalk = `https://router.project-osrm.org/route/v1/walking/${o.lon},${o.lat};${d.lon},${d.lat}?overview=false`;
                  const resW = await fetch(osrmWalk);
                  const jsW = await resW.json();
                  const rW = jsW?.routes?.[0];
                  if (rW) walkingMin = Math.round((rW.duration ?? 0) / 60);
                } catch {}
                const trafficFactor = 1.3;
                const driveWithTraffic = drivingMin ? Math.round(drivingMin * trafficFactor) : undefined;
                busMin = driveWithTraffic ? Math.round(driveWithTraffic * 1.8) : undefined;
                trainMin = driveWithTraffic ? Math.round(driveWithTraffic * 1.2) : undefined;
                gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(last.address)}&destination=${encodeURIComponent(airport ? `${airport.name} (${airport.iata})` : `${fn.origin} airport`)}`;
                uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=${d.lat}&dropoff[longitude]=${d.lon}&dropoff[formatted_address]=${encodeURIComponent(airport ? `${airport.name} (${airport.iata})` : `${fn.origin} airport`)}`;
                if (fn.departureTime && fn.date) {
                  const [h, m] = (fn.departureTime || "00:00").split(":");
                  const dt = new Date(`${fn.date}T${h.padStart(2, "0")}:${m.padStart(2, "0")}:00`);
                  const mins = 240 + (driveWithTraffic ?? drivingMin ?? 60);
                  const callAt = new Date(dt.getTime() - mins * 60 * 1000);
                  const notifyAtDate = new Date(callAt.getTime() - 2 * 60 * 60 * 1000);
                  const fmt = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
                  callTime = fmt(callAt);
                  notifyAt = `${notifyAtDate.toLocaleDateString()} ${fmt(notifyAtDate)}`;
          
                
                  try {
                    if (typeof Notification !== "undefined") {
                      if (Notification.permission === "default") await Notification.requestPermission();
                      if (Notification.permission === "granted") {
                        const delay = notifyAtDate.getTime() - Date.now();
                        if (delay > 0 && delay < 365 * 24 * 60 * 60 * 1000) {
                          setTimeout(() => {
                            try { new Notification("Lembrete de transporte", { body: `Chame o Uber às ${callTime}.` }); } catch {}
                          }, delay);
                        }
                      }
                    }
                  } catch {}
                }
              }
              return { airportName: airport ? `${airport.name} (${airport.iata})` : `${fn.origin} airport`, distanceKm, walkingMin, drivingMin, busMin, trainMin, priceEstimate, gmapsUrl, uberUrl, callTime, notifyAt, callAtISO, notifyAtISO };
            }
            const lines: string[] = [];
            const uaHeader = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
            const isAndroidHeader = /Android/.test(uaHeader);
            lines.push("BEGIN:VCALENDAR");
            lines.push("VERSION:2.0");
            lines.push("PRODID:-//CalenTrip//Calendar Export//PT");
            lines.push("CALSCALE:GREGORIAN");
            lines.push("METHOD:PUBLISH");
            lines.push("X-WR-CALNAME:CalenTrip");
            const tzHeader = (() => {
              try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "Etc/UTC"; } catch { return "Etc/UTC"; }
            })();
            if (!/Android/.test(typeof navigator !== "undefined" ? navigator.userAgent || "" : "")) {
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
            function escText(s: string) {
              return s
                .replace(/\\/g, "\\\\")
                .replace(/\r?\n/g, "\\n")
                .replace(/;/g, "\\;")
                .replace(/,/g, "\\,");
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
              const max = 74; // RFC 5545 recommends 75 octets; using 74 chars approximation
              if (s.length <= max) return s;
              const parts: string[] = [];
              for (let i = 0; i < s.length; i += max) {
                parts.push(s.slice(i, i + max));
              }
              return parts.join("\r\n ");
            }
            const returnDetails = await computeReturnDetails();
 
            const isAndroid = isAndroidHeader;
            const tzidHeader = tzHeader;
            const useTZID = !isAndroid;
            const minimalICS = false;
            const androidUltraMin = false;

            if (isCapAndroid()) {
              const evs = events.map((e) => {
                const start = parseDT(e.date, e.time);
                const end = start ? new Date(start.getTime() + 60 * 60 * 1000) : null;
                const toISO = (d: Date) => d.toISOString();
                return { startISO: start ? toISO(start) : new Date().toISOString(), endISO: end ? toISO(end) : undefined, title: e.label, description: e.label };
              });
              try {
                const perm = await Calendar.requestPermissions();
                if (perm?.granted) {
                  const res = await Calendar.addEvents({ events: evs });
                  if (res.ok && res.added > 0) { show(t("eventsAddedToCalendarMsg"), { variant: "success" }); return; }
                }
              } catch {}
            }
            events.forEach((e, idx) => {
              const start = parseDT(e.date, e.time);
              const end = start ? new Date(start.getTime() + 60 * 60 * 1000) : null;
              const desc = e.label;
              lines.push("BEGIN:VEVENT");
              const uid = `ev-${idx}-${start ? fmt(start) : String(Date.now())}@calentrip`;
              const baseTitle = isAndroid ? limit(e.label, 64) : limit(e.label, 120);
              const title = isAndroid ? toAscii(baseTitle) : baseTitle;
              if (start) lines.push(useTZID ? `DTSTART;TZID=${tzidHeader}:${fmt(start)}` : `DTSTART:${fmtUTC(start)}`);
              if (end) lines.push(useTZID ? `DTEND;TZID=${tzidHeader}:${fmt(end)}` : `DTEND:${fmtUTC(end)}`);
              lines.push(`DTSTAMP:${fmtUTC(new Date())}`);
              lines.push(`UID:${uid}`);
              lines.push(`SUMMARY:${escText(title)}`);
              let locationText: string | null = null;
              if (e.type === "flight") {
                const fn = e.meta as FlightNote | undefined;
                if (fn?.leg === "outbound") locationText = `${fn?.origin || ""} airport`;
              } else if (e.type === "transport") {
                const seg = e.meta as TransportSegmentMeta;
                const originAddr = (seg?.originAddress || "").trim();
                const depPoint = (seg?.dep || "").trim();
                if (originAddr || depPoint) locationText = `${originAddr || ""}${originAddr || depPoint ? " → " : ""}${depPoint || ""}`.trim();
              } else if (e.type === "stay") {
                const m = e.meta as { city?: string; address?: string; kind?: string } | undefined;
                if (m?.kind === "checkin") locationText = (m.address || m.city || "").trim();
              } else if (e.type === "activity" || e.type === "restaurant") {
                const rec = e.meta as RecordItem;
                locationText = `${rec?.title || ""} ${rec?.cityName || ""}`.trim();
              }
              if (locationText) lines.push(`LOCATION:${escText(locationText)}`);
              lines.push("TRANSP:OPAQUE");
              lines.push("SEQUENCE:0");
              lines.push("STATUS:CONFIRMED");
              let extraCall: { callAt: Date; callEnd: Date; callTime?: string; uberUrl?: string; gmapsUrl?: string } | null = null;
              if (!minimalICS && !androidUltraMin && e.type === "stay" && (e.meta as { kind?: string })?.kind === "checkout" && idx === (events.reduce((acc, cur, i) => ((cur.type === "stay" && (cur.meta as { kind?: string })?.kind === "checkout") ? i : acc), -1))) {
                const extra = returnDetails;
                const info: string[] = [];
                info.push(desc);
                if (extra?.airportName) info.push(`Destino: ${extra.airportName}`);
                if (extra?.distanceKm !== undefined) info.push(`Distância: ${extra.distanceKm} km`);
                const modes: string[] = [];
                if (extra?.walkingMin) modes.push(`A pé: ${extra.walkingMin} min`);
                if (extra?.busMin) modes.push(`Ônibus: ${extra.busMin} min (estimado)`);
                if (extra?.trainMin) modes.push(`Trem/Metro: ${extra.trainMin} min (estimado)`);
                if (extra?.drivingMin !== undefined) modes.push(`Uber/Táxi: ${extra.drivingMin} min${extra.priceEstimate !== undefined ? ` • R$${extra.priceEstimate}` : ""}`);
                if (modes.length) info.push(modes.join(" | "));
                const gmaps = extra?.gmapsUrl || null;
                const uber = extra?.uberUrl || null;
                if (!minimalICS) {
                  if (gmaps) info.push(`Google Maps: ${gmaps}`);
                  if (uber) info.push(`Uber: ${uber}`);
                  if (extra?.callTime) info.push(`Chamar Uber às: ${extra.callTime}`);
                  if (extra?.notifyAt) info.push(`Notificação programada: ${extra.notifyAt}`);
                  const descBody = limit(info.join("\n"), 480);
                  lines.push(`DESCRIPTION:${escText(descBody)}`);
                }
                if (extra?.callAtISO) {
                  const callAt = new Date(extra.callAtISO);
                  const callEnd = new Date(callAt.getTime() + 30 * 60 * 1000);
                  extraCall = { callAt, callEnd, callTime: extra.callTime, uberUrl: extra.uberUrl, gmapsUrl: extra.gmapsUrl };
                }
              } else if (!minimalICS && !androidUltraMin) {
                const info: string[] = [];
                info.push(desc);
                if (e.type === "flight") {
                  const fn = e.meta as FlightNote | undefined;
                  if (fn?.leg === "outbound") {
                    const destName = `${fn?.origin || ""} airport`;
                    const gmaps = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destName)}`;
                    const r2r = buildRome2RioUrl({ originName: "my location", destName: destName, lang: "pt-BR", currency: "BRL" });
                    const uber = `https://m.uber.com/ul/?action=setPickup&pickup=my_location`;
                    info.push(`Destino: ${destName}`);
                    info.push(`Google Maps: ${gmaps}`);
                    info.push(`Rome2Rio: ${r2r}`);
                    info.push(`Uber: ${uber}`);
                    info.push(`Chegar no aeroporto: 3h antes do voo.`);
                  }
                } else if (e.type === "transport") {
                  const seg = e.meta as TransportSegmentMeta;
                  const originAddr = (seg?.originAddress || "").trim();
                  const depPoint = (seg?.dep || "").trim();
                  if (originAddr || depPoint) {
                    const gmaps = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originAddr)}&destination=${encodeURIComponent(depPoint)}`;
                    const r2r = buildRome2RioUrl({ originName: originAddr, destName: depPoint, lang: "pt-BR", currency: "BRL" });
                    const uber = `https://m.uber.com/ul/?action=setPickup&pickup=my_location`;
                    info.push(`Origem: ${originAddr || "—"}`);
                    info.push(`Destino: ${depPoint || "—"}`);
                    info.push(`Google Maps: ${gmaps}`);
                    info.push(`Rome2Rio: ${r2r}`);
                    info.push(`Uber: ${uber}`);
                  }
                } else if (e.type === "stay") {
                  const m = e.meta as { city?: string; address?: string; kind?: string } | undefined;
                  if (m?.kind === "checkin") {
                    const q = (m.address || m.city || "").trim();
                    const gmaps = q ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}` : "";
                    const uber = `https://m.uber.com/ul/?action=setPickup&pickup=my_location`;
                    info.push(`Destino: ${q || "—"}`);
                    if (gmaps) info.push(`Google Maps: ${gmaps}`);
                    info.push(`Uber: ${uber}`);
                  }
                } else if (e.type === "activity" || e.type === "restaurant") {
                  const rec = e.meta as RecordItem;
                  const query = `${rec?.title || ""} ${rec?.cityName || ""}`.trim();
                  const gmaps = query ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}` : "";
                  const uber = `https://m.uber.com/ul/?action=setPickup&pickup=my_location`;
                  info.push(`Destino: ${query || "—"}`);
                  if (gmaps) info.push(`Google Maps: ${gmaps}`);
                  info.push(`Uber: ${uber}`);
                }
                const rich = isAndroid ? limit(info.join("\n"), 320) : limit(info.join("\n"), 600);
                lines.push(`DESCRIPTION:${escText(rich)}`);
              }
              lines.push("END:VEVENT");
              if (!minimalICS && extraCall) {
                const { callAt, callEnd, callTime, uberUrl, gmapsUrl } = extraCall;
                lines.push("BEGIN:VEVENT");
                const uid2 = `call-${idx}-${fmt(callAt)}@calentrip`;
                if (useTZID) {
                  lines.push(`DTSTART;TZID=${tzidHeader}:${fmt(callAt)}`);
                  lines.push(`DTEND;TZID=${tzidHeader}:${fmt(callEnd)}`);
                } else {
                  lines.push(`DTSTART:${fmtUTC(callAt)}`);
                  lines.push(`DTEND:${fmtUTC(callEnd)}`);
                }
                lines.push(`SUMMARY:Chamar Uber`);
                lines.push(`UID:${uid2}`);
                lines.push(`DTSTAMP:${fmtUTC(new Date())}`);
                lines.push("STATUS:CONFIRMED");
                lines.push("TRANSP:OPAQUE");
                lines.push("SEQUENCE:0");
                if (!minimalICS && !androidUltraMin) {
                  const descParts = [`Chamar Uber às: ${callTime}`];
                  if (uberUrl) descParts.push(`Uber: ${uberUrl}`);
                  if (gmapsUrl) descParts.push(`Google Maps: ${gmapsUrl}`);
                  lines.push(`DESCRIPTION:${escText(limit(descParts.join("\n"), 240))}`);
                }
                if (!isAndroid) {
                  lines.push("BEGIN:VALARM");
                  lines.push("ACTION:DISPLAY");
                  lines.push("DESCRIPTION:Lembrete de transporte");
                  lines.push("TRIGGER:-PT120M");
                  lines.push("END:VALARM");
                }
                lines.push("END:VEVENT");
              }
            });
            lines.push("END:VCALENDAR");
            const crlf = lines.map(foldLine).join("\r\n") + "\r\n";
            const blob = new Blob([crlf], { type: "text/calendar;charset=utf-8" });
            const file = new File([crlf], "calentrip.ics", { type: "text/calendar;charset=utf-8" });
            async function buildPerEventFiles() {
              const makeOne = (ev: typeof events[number], idx: number) => {
                const start = parseDT(ev.date, ev.time);
                const end = start ? new Date(start.getTime() + 60 * 60 * 1000) : null;
                const baseTitle = isAndroid ? limit(ev.label, 64) : limit(ev.label, 120);
                const title = isAndroid ? toAscii(baseTitle) : baseTitle;
                const L: string[] = [];
                L.push("BEGIN:VCALENDAR");
                L.push("VERSION:2.0");
                L.push("PRODID:-//CalenTrip//Calendar Export//PT");
                L.push("BEGIN:VEVENT");
                if (start) L.push(useTZID ? `DTSTART;TZID=${tzidHeader}:${fmt(start)}` : `DTSTART:${fmtUTC(start)}`);
                if (end) L.push(useTZID ? `DTEND;TZID=${tzidHeader}:${fmt(end)}` : `DTEND:${fmtUTC(end)}`);
                L.push(`SUMMARY:${escText(title)}`);
                let loc: string | null = null;
                if (ev.type === "flight") {
                  const fn = ev.meta as FlightNote | undefined;
                  if (fn?.leg === "outbound") loc = `${fn?.origin || ""} airport`;
                } else if (ev.type === "transport") {
                  const seg = ev.meta as TransportSegmentMeta;
                  const o = (seg?.originAddress || "").trim();
                  const d = (seg?.dep || "").trim();
                  if (o || d) loc = `${o || ""}${o || d ? " → " : ""}${d || ""}`.trim();
                } else if (ev.type === "stay") {
                  const m = ev.meta as { city?: string; address?: string; kind?: string } | undefined;
                  if (m?.kind === "checkin") loc = (m.address || m.city || "").trim();
                } else if (ev.type === "activity" || ev.type === "restaurant") {
                  const rec = ev.meta as RecordItem;
                  loc = `${rec?.title || ""} ${rec?.cityName || ""}`.trim();
                }
                if (loc) L.push(`LOCATION:${escText(loc)}`);
                L.push(`UID:ev-${idx}-${start ? fmt(start) : String(Date.now())}@calentrip`);
                L.push(`DTSTAMP:${fmtUTC(new Date())}`);
                L.push("STATUS:CONFIRMED");
                L.push("TRANSP:OPAQUE");
                L.push("SEQUENCE:0");
                const info: string[] = [];
                info.push(ev.label);
                if (ev.type === "flight") {
                  const fn = ev.meta as FlightNote | undefined;
                  if (fn?.leg === "outbound") {
                    const destName = `${fn?.origin || ""} airport`;
                    const gmaps = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destName)}`;
                    const r2r = buildRome2RioUrl({ originName: "my location", destName: destName, lang: "pt-BR", currency: "BRL" });
                    const uber = `https://m.uber.com/ul/?action=setPickup&pickup=my_location`;
                    info.push(`Destino: ${destName}`);
                    info.push(`Google Maps: ${gmaps}`);
                    info.push(`Rome2Rio: ${r2r}`);
                    info.push(`Uber: ${uber}`);
                    if (!isAndroid) info.push(`Chegar no aeroporto: 3h antes do voo.`);
                  }
                } else if (ev.type === "transport") {
                  const seg = ev.meta as TransportSegmentMeta;
                  const originAddr = (seg?.originAddress || "").trim();
                  const depPoint = (seg?.dep || "").trim();
                  if (originAddr || depPoint) {
                    const gmaps = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originAddr)}&destination=${encodeURIComponent(depPoint)}`;
                    const r2r = buildRome2RioUrl({ originName: originAddr, destName: depPoint, lang: "pt-BR", currency: "BRL" });
                    const uber = `https://m.uber.com/ul/?action=setPickup&pickup=my_location`;
                    info.push(`Origem: ${originAddr || "—"}`);
                    info.push(`Destino: ${depPoint || "—"}`);
                    info.push(`Google Maps: ${gmaps}`);
                    info.push(`Rome2Rio: ${r2r}`);
                    info.push(`Uber: ${uber}`);
                  }
                } else if (ev.type === "stay") {
                  const m = ev.meta as { city?: string; address?: string; kind?: string } | undefined;
                  if (m?.kind === "checkin") {
                    const q = (m.address || m.city || "").trim();
                    const gmaps = q ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}` : "";
                    const uber = `https://m.uber.com/ul/?action=setPickup&pickup=my_location`;
                    info.push(`Destino: ${q || "—"}`);
                    if (gmaps) info.push(`Google Maps: ${gmaps}`);
                    info.push(`Uber: ${uber}`);
                  }
                } else if (ev.type === "activity" || ev.type === "restaurant") {
                  const rec = ev.meta as RecordItem;
                  const query = `${rec?.title || ""} ${rec?.cityName || ""}`.trim();
                  const gmaps = query ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}` : "";
                  const uber = `https://m.uber.com/ul/?action=setPickup&pickup=my_location`;
                  info.push(`Destino: ${query || "—"}`);
                  if (gmaps) info.push(`Google Maps: ${gmaps}`);
                  info.push(`Uber: ${uber}`);
                }
                const rich = isAndroid ? limit(info.join("\n"), 280) : limit(info.join("\n"), 600);
                L.push(`DESCRIPTION:${escText(rich)}`);
                L.push("END:VEVENT");
                L.push("END:VCALENDAR");
                const content = L.map(foldLine).join("\r\n") + "\r\n";
                return new File([content], `calentrip-${String(idx + 1).padStart(2, "0")}.ics`, { type: "text/calendar;charset=utf-8" });
              };
              return events.map(makeOne);
            }
            try {
              const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean; share?: (data: ShareData) => Promise<void> };
              if (isAndroid && typeof nav.share === "function") {
                const perFiles = await buildPerEventFiles();
                const canShareMany = typeof nav.canShare === "function" && nav.canShare({ files: perFiles });
                if (canShareMany) {
                  await nav.share({ files: perFiles, title: "CalenTrip — eventos (Android)" });
                  show(t("eventsSentToCalendarAndroidMsg"), { variant: "success" });
                  return;
                } else {
                  for (const f of perFiles) {
                    await nav.share({ files: [f], title: f.name });
                  }
                  show(t("eventsSentIndividuallyAndroidMsg"), { variant: "success" });
                  return;
                }
              }
              const canShareFiles = typeof nav !== "undefined" && typeof nav.canShare === "function" && nav.canShare({ files: [file] });
              if (canShareFiles && typeof nav.share === "function") {
                await nav.share({ files: [file], title: "CalenTrip" });
                const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
                const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && typeof window !== "undefined" && "ontouchend" in window);
                const isAndroid = /Android/.test(ua);
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
            try {
              const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
              const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && typeof window !== "undefined" && "ontouchend" in window);
              const isAndroid = /Android/.test(ua);
              if (isIOS || isAndroid) {
                window.open(url, "_blank");
                setTimeout(() => { try { URL.revokeObjectURL(url); } catch {} }, 30000);
                if (isIOS) {
                  show(t("importOpenedIosMsg"), { variant: "success" });
                } else {
                  show(t("importOpenedAndroidMsg"), { variant: "success" });
                }
                return;
              }
            } catch {}
            const a = document.createElement("a");
            a.href = url;
            a.download = "calentrip.ics";
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            try { openDownloads(); } catch {}
            show(t("icsDownloadedAndroidHelp"), { variant: "info" });
            }}>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800">
              <span className="material-symbols-outlined text-[22px]">calendar_month</span>
            </span>
          {sideOpen ? <span className="text-sm font-medium">{t("saveToGoogleCalendarButton")}</span> : null}
          </button>
          <button type="button" className="flex w-full items-center gap-3 rounded-md px-3 h-10 hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={() => { try { window.location.href = "/profile"; } catch {} }}>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800">
              <span className="material-symbols-outlined text-[22px]">account_circle</span>
            </span>
            {sideOpen ? <span className="text-sm font-medium">{t("profile")}</span> : null}
          </button>
        </div>
      </div>
      {sideOpen ? (
        <div className="fixed top-0 right-0 bottom-0 left-56 z-30 bg-black/10" onClick={() => setSideOpen(false)} />
      ) : null}
      <div className="container-page">
        <h1 className="mb-1 text-2xl font-semibold text-[var(--brand)]">
          {t("calendarFinalTitle")}
          {currentSavedName ? (
            <span className="ml-2 text-xs rounded px-2 py-0.5 bg-zinc-100 text-zinc-700 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700">{currentSavedName}</span>
          ) : null}
        </h1>
        <p className="text-sm text-zinc-600">Veja todas as atividades em ordem cronológica.</p>
      </div>

      <div className="container-page">
        <div className="mb-2 flex items-center gap-2 flex-wrap">
          {(() => { const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : ""; const isAndroid = /Android/.test(ua); return isAndroid; })() ? (
            <Button type="button" variant="outline" className="px-2 py-1 text-xs rounded-md gap-1" onClick={() => { try { openGoogleCalendarInstall(); } catch {} }}>
              <span className="material-symbols-outlined text-[16px]">android</span>
              <span className="hidden sm:inline">Instalar GC</span>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="px-2 py-1 text-xs rounded-md gap-1"
            disabled={!premiumFlag}
            onClick={async () => {
              try {
                if (saveCalendarNamed()) setCalendarHelpOpen(true);
                await saveCalendarToFile();
              } catch {}
            }}
          >
            <span className="material-symbols-outlined text-[16px]">save</span>
            <span className="hidden sm:inline">{t("saveLabel")}</span>
          </Button>
          <Button type="button" variant="outline" className="px-2 py-1 text-xs rounded-md gap-1" onClick={() => { try { window.open("/calendar/month", "_blank"); } catch {} }}>
            <span className="material-symbols-outlined text-[16px]">calendar_month</span>
            <span className="hidden sm:inline">{t("calendarMonth")}</span>
          </Button>
          
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t("eventsTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {sorted.length ? (
              <ul className="space-y-3 text-sm">
                {sorted.map((ev, idx) => {
                  const accent = ev.type === "flight" ? "border-l-[#007AFF]" : ev.type === "stay" ? "border-l-[#febb02]" : ev.type === "transport" ? "border-l-[#007AFF]" : "border-l-[#34c759]";
                  const icon = ev.type === "flight" ? "local_airport" : ev.type === "stay" ? "home" : ev.type === "transport" ? "transfer_within_a_station" : "event";
                  return (
                    <li key={`ev-${idx}`} className={`rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 flex items-start justify-between gap-3 border-l-4 ${accent}`}>
                      <div className="leading-relaxed">
                        <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                          <span className="material-symbols-outlined text-[16px]">{icon}</span>
                          <span>{ev.date} {ev.time || ""}</span>
                        </div>
                        <div className="mt-1">{ev.label}</div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {ev.type === "flight" && (ev.meta as FlightNote)?.leg === "outbound" ? (
                          <Button type="button" variant="outline" className="px-2 py-1 text-xs rounded-md gap-1" onClick={() => openTransportDrawer(ev)}>
                            <span className="material-symbols-outlined text-[16px]">local_taxi</span>
                            <span>{t("airport")}</span>
                          </Button>
                        ) : null}
                        {ev.type === "flight" && (ev.meta as FlightNote)?.leg === "inbound" ? (
                          <Button type="button" variant="outline" className="px-2 py-1 text-xs rounded-md gap-1" onClick={() => openTransportDrawer(ev)}>
                            <span className="material-symbols-outlined text-[16px]">local_taxi</span>
                            <span>{t("airport")}</span>
                          </Button>
                        ) : null}
                        {ev.type === "flight" && (ev.meta as FlightNote)?.leg === "inbound" && `${(ev.meta as FlightNote).origin}|${(ev.meta as FlightNote).destination}|${ev.date}|${ev.time || ""}` === lastInboundSignature ? (
                          <Button type="button" variant="outline" className="px-2 py-1 text-xs rounded-md gap-1" onClick={() => openReturnAirportDrawer()}>
                            <span className="material-symbols-outlined text-[16px]">local_taxi</span>
                            <span>{t("returnAirportLabel")}</span>
                          </Button>
                        ) : null}
                        {ev.type === "flight" && (ev.meta as FlightNote)?.leg === "inbound" && `${(ev.meta as FlightNote).origin}|${(ev.meta as FlightNote).destination}|${ev.date}|${ev.time || ""}` === lastInboundSignature && returnFiles.length ? (
                          <Button type="button" variant="outline" className="px-2 py-1 text-xs rounded-md gap-1" onClick={async () => {
                            setDocTitle(returnInfo?.airportName || t("inboundFlight"));
                            const mod = await import("@/lib/attachments-store");
                            const resolved = await Promise.all(returnFiles.map(async (f) => {
                              if (!f.dataUrl && f.id) {
                                const url = await mod.getObjectUrl(f.id);
                                return { ...f, dataUrl: url || undefined };
                              }
                              return f;
                            }));
                            setDocFiles(resolved);
                            setDocOpen(true);
                          }}>
                            <span className="material-symbols-outlined text-[16px]">description</span>
                            <span>Docs</span>
                          </Button>
                        ) : null}
                        {ev.type === "transport" ? (
                          <>
                            <Button type="button" variant="outline" className="px-2 py-1 text-xs rounded-md gap-1" onClick={() => openDepartureDrawer(ev)}>
                              <span className="material-symbols-outlined text-[16px] text-[#febb02]">map</span>
                              <span>Detalhes</span>
                            </Button>
                            <Button type="button" variant="outline" className="px-2 py-1 text-xs rounded-md gap-1" onClick={async () => {
                              try {
                                const seg = ev.meta as TransportSegmentMeta;
                                const ref = `${(seg.originCity || "").trim()} -> ${(seg.arr || "").trim()} @ ${(ev.date || "").trim()}`;
                                if (!currentTripId) { setDocTitle("Documentos do transporte"); setDocFiles([]); setDocOpen(true); return; }
                                const files = await getRefAttachments(currentTripId!, "transport", ref);
                                const mod = await import("@/lib/attachments-store");
                                const resolved = await Promise.all((files || []).map(async (f: SavedFile) => {
                                  if (!f.dataUrl && f.id) {
                                    const url = await mod.getObjectUrl(f.id);
                                    return { ...f, dataUrl: url || undefined } as SavedFile;
                                  }
                                  return f;
                                }));
                                setDocTitle("Documentos do transporte");
                                setDocFiles(resolved as SavedFile[]);
                                setDocOpen(true);
                              } catch {
                                setDocTitle("Documentos do transporte");
                                setDocFiles([]);
                                setDocOpen(true);
                              }
                            }}>
                              <span className="material-symbols-outlined text-[16px]">description</span>
                              <span>Docs</span>
                            </Button>
                          </>
                        ) : null}
                        {ev.type === "stay" && (ev.meta as { kind?: string })?.kind === "checkin" ? (
                          <Button type="button" variant="outline" className="px-2 py-1 text-xs rounded-md gap-1" onClick={() => openCheckinDrawer(ev)}>
                            <span className="material-symbols-outlined text-[16px]">home</span>
                            <span>{t("accommodationDialogTitle")}</span>
                          </Button>
                        ) : null}
                        
                        {(ev.type === "activity" || ev.type === "restaurant") ? (
                          <>
                          <Button type="button" variant="outline" disabled={!premiumFlag} className="px-2 py-1 text-xs rounded-md gap-1" onClick={() => {
                            setEditIdx(idx);
                            setEditDate(ev.date);
                            setEditTime(ev.time || "");
                            setEditOpen(true);
                          }}>
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                            <span>{t("editLabel")}</span>
                          </Button>
                          <Button type="button" variant="outline" className="px-2 py-1 text-xs rounded-md gap-1" onClick={() => openGoDrawer(ev)}>
                            <span className="material-symbols-outlined text-[16px]">map</span>
                            <span>{t("goButton")}</span>
                          </Button>
                          </>
                        ) : null}
                        {((ev.type === "activity" || ev.type === "restaurant") && (ev.meta as RecordItem)?.files && (ev.meta as RecordItem)?.files!.length) ? (
                          <Button type="button" variant="outline" className="px-2 py-1 text-xs rounded-md gap-1" onClick={() => {
                            const m = ev.meta as RecordItem;
                            setDocTitle(m.title);
                            setDocFiles(m.files || []);
                            setDocOpen(true);
                          }}>
                            <span className="material-symbols-outlined text-[16px]">description</span>
                            <span>Docs</span>
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="text-sm text-zinc-600">Nenhum evento encontrado.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={calendarHelpOpen} onOpenChange={setCalendarHelpOpen} placement="bottom" disableBackdropClose>
        <DialogHeader>{t("saveToGoogleCalendarButton")}</DialogHeader>
        <div className="space-y-2 text-sm">
          <div className="font-semibold">Android</div>
          <div>• Verificamos o Google Calendar. Se não estiver instalado, abrimos a Play Store para instalar.</div>
          <div>• Geramos e baixamos o arquivo .ics para a pasta Download.</div>
          <div>• Abrimos o gerenciador de arquivos na pasta Download (quando possível).</div>
          <div>• Toque em calentrip.ics e escolha salvar no Google Calendar; selecione a conta e confirme.</div>
          <div className="mt-3">
            <Button type="button" disabled={!premiumFlag} onClick={() => { try { saveCalendarFull(); } catch {} }}>{t("saveToGoogleCalendarButton")}</Button>
            <Button type="button" variant="outline" className="ml-2" onClick={() => { try { openDownloads(); } catch {} }}>Abrir pasta Download</Button>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setCalendarHelpOpen(false)}>{t("close")}</Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen} placement="bottom">
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
                setEvents((prev) => prev.filter((_, i) => i !== editIdx));
                setEditOpen(false);
                setEditIdx(null);
                show(t("activityDeletedMsg"), { variant: "success" });
              } catch { show(t("deleteErrorMsg"), { variant: "error" }); }
            }}>Excluir</Button>
            <Button type="button" onClick={() => {
              try {
                if (editIdx === null) return;
                setEvents((prev) => prev.map((e, i) => {
                  if (i !== editIdx) return e;
                  const nextMeta = e.meta;
                  return { ...e, date: editDate, time: editTime, meta: nextMeta };
                }));
                setEditOpen(false);
                setEditIdx(null);
                show(t("activityUpdatedMsg"), { variant: "success" });
              } catch { show(t("saveErrorMsg"), { variant: "error" }); }
            }}>{t("saveLabel")}</Button>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>{t("close")}</Button>
        </DialogFooter>
      </Dialog>

  {drawerOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setDrawerOpen(false); setTransportInfo(null); }} />
          <div className="absolute bottom-0 left-0 right-0 z-10 w-full rounded-t-2xl border border-zinc-200 bg-white p-5 md:p-6 shadow-xl dark:border-zinc-800 dark:bg-black">
        <DialogHeader>{t("returnDrawerTitle")}</DialogHeader>
            <div className="space-y-3 text-sm">
              {loading ? (
                <div>Calculando…</div>
              ) : (
                <>
                  <div>Destino: {drawerData?.originIata || "—"}</div>
              <div>Distância (a partir da sua localização): {transportInfo?.distanceKm ? `${transportInfo.distanceKm} km` : "—"}</div>
              {!transportInfo?.distanceKm && locConsent !== "granted" ? (
                <div className="text-xs text-zinc-500">Ative a localização para calcular a distância.</div>
              ) : null}
                  <div>Tempo estimado (com trânsito): {transportInfo?.durationWithTrafficMin ? `${transportInfo.durationWithTrafficMin} min` : transportInfo?.durationMin ? `${transportInfo.durationMin} min` : "—"}</div>
                  <div className="mt-2">
                    <a className="underline" href={transportInfo?.gmapsUrl} target="_blank" rel="noopener noreferrer">Veja no Google Maps</a>
                  </div>
                  <div>
                <a className="underline flex items-center gap-1" href={transportInfo?.r2rUrl} target="_blank" rel="noopener noreferrer">
                  <span className="material-symbols-outlined text-[16px] text-[#febb02]">alt_route</span>
                  <span>Opções de rota (Rome2Rio)</span>
                </a>
                  </div>
                  <div>
                    <a className="underline" href={transportInfo?.uberUrl} target="_blank" rel="noopener noreferrer">Uber</a>
                  </div>
                  <div className="mt-2">Chegar no aeroporto: 3h antes do voo.</div>
                  {outboundFiles.length ? (
                    <div>
                      <Button type="button" variant="outline" onClick={async () => {
                        setDocTitle(transportInfo?.airportName || "Voo de ida");
                        const mod = await import("@/lib/attachments-store");
                        const resolved = await Promise.all(outboundFiles.map(async (f) => {
                          if (!f.dataUrl && f.id) {
                            const url = await mod.getObjectUrl(f.id);
                            return { ...f, dataUrl: url || undefined };
                          }
                          return f;
                        }));
                        setDocFiles(resolved);
                        setDocOpen(true);
                      }}>Documentos salvos</Button>
                    </div>
                  ) : null}
                  
                  <div>Chamar Uber às: {transportInfo?.callTime || "—"}</div>
                  <div>Notificação programada: {transportInfo?.notifyAt ? `às ${transportInfo.notifyAt}` : "—"}</div>
                  <div className="mt-3 flex justify-end">
                    <Button type="button" className="h-10 rounded-lg font-semibold tracking-wide" onClick={() => { setDrawerOpen(false); setTransportInfo(null); }}>{t("close")}</Button>
                  </div>
                </>
              )}
            </div>
      </div>
    </div>
  )}
  {savedDrawerOpen && (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={() => setSavedDrawerOpen(false)} />
      <div className="absolute bottom-0 left-0 right-0 z-10 w-full rounded-t-2xl border border-zinc-200 bg-white p-5 md:p-6 shadow-xl dark:border-zinc-800 dark:bg-black">
        <DialogHeader>Pesquisas e calendários salvos</DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="rounded border p-3">
            <div className="font-semibold mb-1">{t("savedCalendarsTitle")}</div>
            {savedCalendarsList.length ? (
              <ul className="space-y-2">
                {savedCalendarsList.map((c, idx) => (
                  <li key={`${c.name}-${idx}`} className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        <span>{c.name}</span>
                        {((((savedTripsList.find((t) => t.id === currentTripId)?.savedCalendarName) || currentSavedName) || "") === (c.name || "")) ? (
                          <span className="ml-1 rounded px-2 py-0.5 text-[11px] bg-[#007AFF]/10 text-[#007AFF] border border-[#007AFF]/30">Atual</span>
                        ) : null}
                      </div>
                      <div className="text-xs text-zinc-600">{(c.events || []).length} eventos</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" onClick={async () => {
                        try {
                          await initDatabaseDb();
                          try { await migrateFromLocalStorageDb(); } catch {}
                          const trips = await getSavedTripsDb();
                          const match = trips.find((t) => (t.savedCalendarName || "") === (c.name || ""));
                          if (match) {
                            const ok = await loadTripEventsFromDbById(match.id);
                            if (ok) { setSavedDrawerOpen(false); return; }
                          }
                        } catch {}
                        setEvents(c.events);
                        setSavedDrawerOpen(false);
                      }}>{t("loadLabel")}</Button>
                      <Button type="button" variant="outline" onClick={() => {
                        try {
                          const ok1 = confirm(`Deseja excluir o calendário "${c.name}"?`);
                          if (!ok1) return;
                          const ok2 = confirm("Tem certeza? Esta ação não pode ser desfeita.");
                          if (!ok2) return;
                          const rawList = typeof window !== "undefined" ? localStorage.getItem("calentrip:saved_calendars_list") : null;
                          const list = rawList ? (JSON.parse(rawList) as Array<{ name: string; events: EventItem[]; savedAt?: string }>) : [];
                          const next = list.filter((x) => (x?.name || "") !== (c?.name || ""));
                          localStorage.setItem("calentrip:saved_calendars_list", JSON.stringify(next));
                          setSavedCalendarsList(next);
                          try {
                            const rawOne = typeof window !== "undefined" ? localStorage.getItem("calentrip:saved_calendar") : null;
                            const one = rawOne ? JSON.parse(rawOne) as { name?: string; events?: EventItem[] } : null;
                            if ((one?.name || "") === (c?.name || "")) localStorage.removeItem("calentrip:saved_calendar");
                          } catch {}
                          show(t("calendarDeletedMsg"), { variant: "success" });
                        } catch { show(t("deleteErrorMsg"), { variant: "error" }); }
                      }}>{t("deleteLabel")}</Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-zinc-600">{t("noSavedCalendarsLabel")}</div>
            )}
          </div>
          <div className="rounded border p-3">
            <div className="font-semibold mb-1">{t("savedSearchesTitle")}</div>
            {savedTripsList.length ? (
              <ul className="space-y-2">
                {savedTripsList.map((trip) => (
                  <li key={trip.id} className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        <span>{trip.title}</span>
                        {trip.id === currentTripId ? (
                          <span className="ml-1 rounded px-2 py-0.5 text-[11px] bg-[#007AFF]/10 text-[#007AFF] border border-[#007AFF]/30">Atual</span>
                        ) : null}
                      </div>
                      <div className="text-xs text-zinc-600">
                        {trip.date} • {trip.passengers} pax{trip.savedCalendarName ? ` • ${trip.savedCalendarName}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" onClick={() => {
                        const legs = (trip.flightNotes || []).map((n) => `${n.leg === "outbound" ? "Ida" : "Volta"}: ${n.origin} → ${n.destination} • ${n.date} ${n.departureTime || ""}`);
                        alert(legs.join("\n"));
                      }}>{t("viewLabel")}</Button>
                      <Button type="button" variant="outline" onClick={async () => {
                        const ok = await loadTripEventsFromDbById(trip.id);
                        if (ok) setSavedDrawerOpen(false);
                      }}>{t("loadLabel")}</Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-zinc-600">{t("noSavedSearchesLabel")}</div>
            )}
          </div>
          <div className="mt-3 flex justify-end">
            <Button type="button" className="h-10 rounded-lg font-semibold tracking-wide" onClick={() => setSavedDrawerOpen(false)}>{t("close")}</Button>
          </div>
        </div>
      </div>
    </div>
  )}
  {filesDrawerOpen && (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={() => setFilesDrawerOpen(false)} />
      <div className="absolute bottom-0 left-0 right-0 z-10 w-full rounded-t-2xl border border-zinc-200 bg-white p-5 md:p-6 shadow-xl dark:border-zinc-800 dark:bg-black">
        <DialogHeader>{t("savedFilesTitle")}</DialogHeader>
        <div className="space-y-3 text-sm max-h-[60vh] overflow-y-auto">
          {filesList.length ? (
            <ul className="space-y-2">
              {filesList.map((f) => (
                <li key={f.name} className="flex items-center justify-between gap-2 rounded border p-2">
                  <div>
                    <div className="font-medium">{f.name}</div>
                    <div className="text-xs text-zinc-600">{f.size ? `${Math.round(f.size / 1024)} KB` : ""}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" onClick={() => loadFile(f.name)}>{t("loadLabel")}</Button>
                    <Button type="button" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => deleteFile(f.name)}>{t("deleteLabel")}</Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-zinc-600">{t("noSavedFilesLabel")}</div>
          )}
          <div className="mt-3 flex justify-end">
            <Button type="button" className="h-10 rounded-lg font-semibold tracking-wide" onClick={() => setFilesDrawerOpen(false)}>{t("close")}</Button>
          </div>
        </div>
      </div>
    </div>
  )}
  {arrivalDrawerOpen && (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={() => { setArrivalDrawerOpen(false); setArrivalInfo(null); }} />
      <div className="absolute bottom-0 left-0 right-0 z-10 w-full rounded-t-2xl border border-zinc-200 bg-white p-5 md:p-6 shadow-xl dark:border-zinc-800 dark:bg-black">
        <DialogHeader>Chegada e deslocamento até hospedagem</DialogHeader>
        <div className="space-y-3 text-sm">
          <div>{t("cityLabel")}: {arrivalInfo?.city || "—"}</div>
          <div>Destino: {arrivalInfo?.address || "—"}</div>
          <div>Distância (a partir da sua localização): {arrivalInfo?.distanceKm ? `${arrivalInfo.distanceKm} km` : "—"}</div>
          {!arrivalInfo?.distanceKm && locConsent !== "granted" ? (
            <div className="text-xs text-zinc-500">Ative a localização para calcular a distância.</div>
          ) : null}
          <div>
            <a className="underline" href={arrivalInfo?.gmapsUrl} target="_blank" rel="noopener noreferrer">Abrir rota no Google Maps</a>
          </div>
          <div>
            <a className="underline" href={arrivalInfo?.uberUrl} target="_blank" rel="noopener noreferrer">Chamar Uber</a>
          </div>
          {(() => {
            const files = summaryCities.find((c) => {
              const byName = c.name && arrivalInfo?.city && c.name === arrivalInfo.city;
              const byAddr = c.address && arrivalInfo?.address && c.address === arrivalInfo.address;
              return Boolean(byName || byAddr);
            })?.stayFiles || [];
            return files.length ? (
              <div>
                <Button type="button" variant="outline" onClick={async () => {
                  setDocTitle(arrivalInfo?.city || arrivalInfo?.address || t("accommodationDialogTitle"));
                  const mod = await import("@/lib/attachments-store");
                  const resolved = await Promise.all(files.map(async (f) => {
                    if (!f.dataUrl && f.id) {
                      const url = await mod.getObjectUrl(f.id);
                      return { ...f, dataUrl: url || undefined };
                    }
                    return f;
                  }));
                  setDocFiles(resolved);
                  setDocOpen(true);
                }}>Documentos anexos</Button>
              </div>
            ) : null;
          })()}
          <div className="mt-3 flex justify-end">
            <Button type="button" className="h-10 rounded-lg font-semibold tracking-wide" onClick={() => { setArrivalDrawerOpen(false); setArrivalInfo(null); }}>{t("close")}</Button>
          </div>
        </div>
      </div>
    </div>
  )}
  {goDrawerOpen && (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={() => { setGoDrawerOpen(false); setGoInfo(null); setGoRecord(null); }} />
      <div className="absolute bottom-0 left-0 right-0 z-10 w-full rounded-t-2xl border border-zinc-200 bg-white p-5 md:p-6 shadow-xl dark:border-zinc-800 dark:bg-black">
        <DialogHeader>Como ir até o destino</DialogHeader>
        <div className="space-y-3 text-sm">
          {goLoading ? (
            <div>Calculando…</div>
          ) : (
            <>
              <div>Destino: {goInfo?.destination || "—"}</div>
              <div>Distância (a partir da sua localização): {goInfo?.distanceKm ? `${goInfo.distanceKm} km` : "—"}</div>
              {!goInfo?.distanceKm && locConsent !== "granted" ? (
                <div className="text-xs text-zinc-500">Ative a localização para calcular a distância.</div>
              ) : null}
              <div>
                <a className="underline" href={goInfo?.gmapsUrl} target="_blank" rel="noopener noreferrer">Abrir rota no Google Maps</a>
              </div>
              <div>
                <a className="underline" href={goInfo?.uberUrl} target="_blank" rel="noopener noreferrer">Chamar Uber</a>
              </div>
              {goRecord?.files && goRecord.files.length ? (
                <div>
                  <Button type="button" variant="outline" onClick={async () => {
                    setDocTitle(goRecord!.title);
                    const mod = await import("@/lib/attachments-store");
                    const resolved = await Promise.all((goRecord!.files || []).map(async (f) => {
                      if (!f.dataUrl && f.id) {
                        const url = await mod.getObjectUrl(f.id);
                        return { ...f, dataUrl: url || undefined };
                      }
                      return f;
                    }));
                    setDocFiles(resolved);
                    setDocOpen(true);
                  }}>Arquivos salvos</Button>
                </div>
              ) : null}
              <div className="mt-3 flex justify-end">
                <Button type="button" className="h-10 rounded-lg font-semibold tracking-wide" onClick={() => { setGoDrawerOpen(false); setGoInfo(null); setGoRecord(null); }}>{t("close")}</Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )}
  {returnDrawerOpen && (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={() => { setReturnDrawerOpen(false); setReturnInfo(null); }} />
      <div className="absolute bottom-0 left-0 right-0 z-10 w-full rounded-t-2xl border border-zinc-200 bg-white p-5 md:p-6 shadow-xl dark:border-zinc-800 dark:bg-black">
        <DialogHeader>Transporte até o aeroporto final da viagem</DialogHeader>
        <div className="space-y-3 text-sm">
          {returnLoading ? (
            <div>Calculando…</div>
          ) : (
            <>
              <div>Destino: {returnInfo?.airportName || "—"}</div>
              <div>Origem: {returnInfo?.address || returnInfo?.city || "—"}</div>
              <div>Distância (a partir da sua localização): {returnInfo?.distanceKm ? `${returnInfo.distanceKm} km` : "—"}</div>
              {!returnInfo?.distanceKm && locConsent !== "granted" ? (
                <div className="text-xs text-zinc-500">Ative a localização para calcular a distância.</div>
              ) : null}
              <div>
                <a className="underline" href={returnInfo?.gmapsUrl} target="_blank" rel="noopener noreferrer">Abrir rota no Google Maps</a>
              </div>
              <div>
                <a className="underline flex items-center gap-1" href={returnInfo?.r2rUrl} target="_blank" rel="noopener noreferrer">
                  <span className="material-symbols-outlined text-[16px] text-[#febb02]">alt_route</span>
                  <span>Opções de rota (Rome2Rio)</span>
                </a>
              </div>
              <div>
                <a className="underline" href={returnInfo?.uberUrl} target="_blank" rel="noopener noreferrer">Chamar Uber</a>
              </div>
              <div className="mt-2">Chamar Uber às: {returnInfo?.callTime || "—"}</div>
              <div>Notificação programada: {returnInfo?.notifyAt ? `às ${returnInfo.notifyAt}` : "—"}</div>
              {returnFiles.length ? (
                <div>
                  <Button type="button" variant="outline" onClick={async () => {
                    setDocTitle(returnInfo?.airportName || t("inboundFlight"));
                    const mod = await import("@/lib/attachments-store");
                    const resolved = await Promise.all(returnFiles.map(async (f) => {
                      if (!f.dataUrl && f.id) {
                        const url = await mod.getObjectUrl(f.id);
                        return { ...f, dataUrl: url || undefined };
                      }
                      return f;
                    }));
                    setDocFiles(resolved);
                    setDocOpen(true);
                  }}>Visualizar documentos</Button>
                </div>
              ) : null}
              <div className="mt-3 flex justify-end">
                <Button type="button" className="h-10 rounded-lg font-semibold tracking-wide" onClick={() => { setReturnDrawerOpen(false); setReturnInfo(null); }}>{t("close")}</Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )}
      {stayDrawerOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setStayDrawerOpen(false); setStayInfo(null); }} />
          <div className="absolute bottom-0 left-0 right-0 z-10 w-full rounded-t-2xl border border-zinc-200 bg-white p-5 md:p-6 shadow-xl dark:border-zinc-800 dark:bg-black">
            <DialogHeader>Como chegar da hospedagem de checkout até o transporte para a próxima cidade</DialogHeader>
            <div className="space-y-3 text-sm">
              {stayLoading ? (
                <div>Calculando…</div>
              ) : (
                <>
                  <div>Origem: {stayInfo?.origin || "—"}</div>
                  <div>Destino: {stayInfo?.destination || "—"}</div>
                  {stayCandidates.length > 1 ? (
                    <div>
                      <div className="text-xs text-zinc-600">{(() => { const ev = editIdx !== null ? events[editIdx] : null; const seg = ev?.meta as TransportSegmentMeta | undefined; return seg?.mode === "train" ? "Escolha a estação de trem:" : seg?.mode === "air" ? "Escolha o aeroporto:" : "Escolha a rodoviária:"; })()}</div>
                      <Select className="mt-1" value={String(stayChosenIdx ?? 0)} onChange={async (e) => {
                        const i = Number((e.target as HTMLSelectElement).value);
                        const c = stayCandidates[i];
                        setStayChosenIdx(i);
                        try {
                          const pos = await new Promise<GeolocationPosition | null>((resolve) => {
                            try {
                              if (!ensureLocationConsent()) { resolve(null); return; }
                              navigator.geolocation.getCurrentPosition((p) => resolve(p), () => resolve(null), { enableHighAccuracy: true, maximumAge: 30000, timeout: 20000 });
                            } catch { resolve(null); }
                          });
                          let gmapsUrl: string | undefined;
                          let uberUrl: string | undefined;
                          let distanceKm: number | undefined;
                          let drivingMin: number | undefined;
                          let walkingMin: number | undefined;
                          const cityForSearch = (stayInfo?.origin || "").split(",")[0] || "";
                          if (pos) {
                            const cur = { lat: pos.coords.latitude, lon: pos.coords.longitude };
                            const osrmDrive = `https://router.project-osrm.org/route/v1/driving/${cur.lon},${cur.lat};${c.lon},${c.lat}?overview=false`;
                            const resD = await fetch(osrmDrive); const jsD = await resD.json(); const rD = jsD?.routes?.[0];
                            if (rD) { distanceKm = Math.round((rD.distance ?? 0) / 1000); drivingMin = Math.round((rD.duration ?? 0) / 60); }
                            try { const resW = await fetch(`https://router.project-osrm.org/route/v1/walking/${cur.lon},${cur.lat};${c.lon},${c.lat}?overview=false`); const jsW = await resW.json(); const rW = jsW?.routes?.[0]; if (rW) walkingMin = Math.round((rW.duration ?? 0) / 60); } catch {}
                            gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${cur.lat}%2C${cur.lon}&destination=${encodeURIComponent(c.name)}`;
                            uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup[latitude]=${cur.lat}&pickup[longitude]=${cur.lon}&dropoff[latitude]=${c.lat}&dropoff[longitude]=${c.lon}&dropoff[formatted_address]=${encodeURIComponent(c.name)}`;
                          } else {
                            gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(c.name)}`;
                            uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=${c.lat}&dropoff[longitude]=${c.lon}&dropoff[formatted_address]=${encodeURIComponent(c.name)}`;
                          }
                          const trafficFactor = 1.3;
                          const drivingWithTrafficMin = drivingMin ? Math.round(drivingMin * trafficFactor) : undefined;
                          let callTime: string | undefined; let notifyAt: string | undefined;
                          if (editIdx !== null) {
                            const ev = events[editIdx];
                            const [h, m] = (ev?.time || "00:00").split(":");
                            const depDT = new Date(`${ev?.date}T${h.padStart(2, "0")}:${m.padStart(2, "0")}:00`);
                            const bufferMin = 60;
                            const travelMs = ((drivingWithTrafficMin ?? drivingMin ?? 30) + bufferMin) * 60 * 1000;
                            const callAt = new Date(depDT.getTime() - travelMs);
                            const fmt = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
                            callTime = fmt(callAt);
                            notifyAt = `${callAt.toLocaleDateString()} ${fmt(callAt)}`;
                            try {
                              const evSeg = ev?.meta as TransportSegmentMeta | undefined;
                              const key = evSeg?.mode === "train" ? "calentrip:train_station_selection" : evSeg?.mode === "air" ? "calentrip:airport_selection" : "calentrip:bus_station_selection";
                              const raw = typeof window !== "undefined" ? localStorage.getItem(key) : null;
                              const map = raw ? (JSON.parse(raw) as Record<string, { name: string; lat: number; lon: number }>) : {};
                              map[cityForSearch] = { name: c.name, lat: c.lat, lon: c.lon };
                              if (typeof window !== "undefined") localStorage.setItem(key, JSON.stringify(map));
                            } catch {}
                          }
                          setStayInfo((prev) => ({ ...(prev || {}), destination: c.name, distanceKm, drivingMin: drivingWithTrafficMin ?? drivingMin, walkingMin, gmapsUrl, uberUrl, callTime, notifyAt }));
                        } catch {}
                      }}>
                        {stayCandidates.map((c, i) => (<option key={`opt-${i}`} value={String(i)}>{c.name}</option>))}
                      </Select>
                    </div>
                  ) : null}
                  <div>Distância (a partir da sua localização): {stayInfo?.distanceKm ? `${stayInfo.distanceKm} km` : "—"}</div>
                  {!stayInfo?.distanceKm && locConsent !== "granted" ? (
                    <div className="text-xs text-zinc-500">Ative a localização para calcular a distância.</div>
                  ) : null}
                  {stayInfo?.mapUrl ? (
                    <iframe title="map" src={stayInfo.mapUrl} className="mt-2 h-40 w-full rounded-md border" />
                  ) : null}
                  <div className="mt-2">
                    <a className="underline" href={stayInfo?.gmapsUrl} target="_blank" rel="noopener noreferrer">Abrir rota no Google Maps</a>
                  </div>
                  <div>
                    <a className="underline flex items-center gap-1" href={stayInfo?.r2rUrl} target="_blank" rel="noopener noreferrer">
                      <span className="material-symbols-outlined text-[16px] text-[#febb02]">alt_route</span>
                      <span>Opções de rota (Rome2Rio)</span>
                    </a>
                  </div>
                  <div>
                    <a className="underline" href={stayInfo?.uberUrl} target="_blank" rel="noopener noreferrer">Chamar Uber</a>
                  </div>
                  {(() => {
                    const ev = editIdx !== null ? events[editIdx] : null;
                    const seg = ev?.meta as TransportSegmentMeta | undefined;
                    const ref = seg ? `${(seg.originCity || "").trim()} -> ${(seg.arr || "").trim()} @ ${(ev?.date || "").trim()}` : undefined;
                    return currentTripId && ref ? (
                      <div>
                        <Button type="button" variant="outline" className="px-2 py-1 text-xs" onClick={async () => {
                          try {
                            const files = await getRefAttachments(currentTripId!, "transport", ref);
                            const mod = await import("@/lib/attachments-store");
                            const resolved = await Promise.all((files || []).map(async (f: SavedFile) => {
                              if (!f.dataUrl && f.id) {
                                const url = await mod.getObjectUrl(f.id);
                                return { ...f, dataUrl: url || undefined } as SavedFile;
                              }
                              return f;
                            }));
                            setDocTitle("Documentos do transporte");
                            setDocFiles(resolved as SavedFile[]);
                            setDocOpen(true);
                          } catch {
                            setDocTitle("Documentos do transporte");
                            setDocFiles([]);
                            setDocOpen(true);
                          }
                        }}>Documentos salvos</Button>
                      </div>
                    ) : null;
                  })()}
                  <div className="mt-2">Chamar Uber às: {stayInfo?.callTime || "—"}</div>
                  <div>Notificação programada: {stayInfo?.notifyAt ? `às ${stayInfo.notifyAt}` : "—"}</div>
                  <div className="mt-3 flex justify-end">
                    <Button type="button" className="h-10 rounded-lg font-semibold tracking-wide" onClick={() => { setStayDrawerOpen(false); setStayInfo(null); }}>{t("close")}</Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {docOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setDocOpen(false); setDocFiles([]); }} />
          <div className="absolute bottom-0 left-0 right-0 z-10 w-full rounded-t-2xl border border-zinc-200 bg-white p-5 md:p-6 shadow-xl dark:border-zinc-800 dark:bg-black">
            <DialogHeader>Documentos: {docTitle}</DialogHeader>
            <div className="space-y-3 text-sm max-h-[60vh] overflow-y-auto">
              {docFiles.length ? (
                <ul className="space-y-2">
                  {docFiles.map((f, i) => (
                    <li key={`df-${i}`} className="rounded border p-2">
                      <div className="font-medium">{f.name}</div>
                      <div className="text-xs">{f.type} • {Math.round(f.size / 1024)} KB</div>
                      {f.dataUrl && (
                        <div className="mt-2 space-y-2">
                          {f.type.startsWith("image/") ? (
                            <div className="relative h-48 w-full">
                              <Image src={f.dataUrl || ""} alt={f.name} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-contain rounded border" />
                            </div>
                          ) : f.type === "application/pdf" ? (
                            <iframe src={f.dataUrl} title={f.name} className="w-full h-48 rounded border" />
                          ) : (
                            <div className="text-xs text-zinc-600">Arquivo disponível no dispositivo.</div>
                          )}
                          <div>
                            <a className="underline" href={f.dataUrl}>Abrir no dispositivo</a>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-zinc-600">Nenhum documento salvo.</div>
              )}
              <div className="mt-3 flex justify-end">
                <Button type="button" className="h-10 rounded-lg font-semibold tracking-wide" onClick={() => { setDocOpen(false); setDocFiles([]); }}>{t("close")}</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
  type StoragePlugin = {
    save(args: { name: string; json: string }): Promise<{ ok?: boolean; error?: string }>; 
    list(): Promise<{ files?: Array<{ name: string; size?: number; modified?: number }> }>; 
    read(args: { name: string }): Promise<{ ok?: boolean; json?: string; error?: string }>; 
    delete(args: { name: string }): Promise<{ ok?: boolean; error?: string }>; 
  };
  const StorageFiles = registerPlugin<StoragePlugin>("StorageFiles");
