"use client";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import Image from "next/image";
import { useI18n } from "@/lib/i18n";
import { isTripPremium, setTripPremium, computeExpiryFromData } from "@/lib/premium";
 
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DialogHeader } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { getTrips, TripItem, FlightNote } from "@/lib/trips-store";
import { findAirportByIata } from "@/lib/airports";

type SavedFile = { name: string; type: string; size: number; id?: string; dataUrl?: string };
type RecordItem = { kind: "activity" | "restaurant"; cityIdx: number; cityName: string; date: string; time?: string; title: string; files?: SavedFile[] };

type EventItem = { type: "flight" | "activity" | "restaurant" | "transport" | "stay"; label: string; date: string; time?: string; meta?: FlightNote | RecordItem | TransportSegmentMeta | { city?: string; address?: string; kind: "checkin" | "checkout" } };
type TransportSegmentMeta = { mode: "air" | "train" | "bus" | "car"; dep: string; arr: string; depTime?: string; arrTime?: string; originAddress?: string; originCity?: string };
type CityPersist = { name?: string; checkin?: string; checkout?: string; address?: string; transportToNext?: TransportSegmentMeta; stayFiles?: SavedFile[] };

export default function FinalCalendarPage() {
  
  const [events, setEvents] = useState<EventItem[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerData, setDrawerData] = useState<{ originIata: string; departureDate: string; departureTime: string } | null>(null);
  const [transportInfo, setTransportInfo] = useState<{ distanceKm?: number; durationMin?: number; durationWithTrafficMin?: number; gmapsUrl?: string; r2rUrl?: string; uberUrl?: string; airportName?: string; callTime?: string; notifyAt?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [stayDrawerOpen, setStayDrawerOpen] = useState(false);
  const [stayLoading, setStayLoading] = useState(false);
  const [stayInfo, setStayInfo] = useState<{ origin?: string; destination?: string; distanceKm?: number; drivingMin?: number; walkingMin?: number; busMin?: number; trainMin?: number; uberUrl?: string; gmapsUrl?: string; r2rUrl?: string; mapUrl?: string; callTime?: string; notifyAt?: string } | null>(null);
  const arrivalWatchIds = useRef<Record<string, number>>({});
  const arrivalNotified = useRef<Record<string, boolean>>({});
  const [arrivalDrawerOpen, setArrivalDrawerOpen] = useState(false);
  const [arrivalInfo, setArrivalInfo] = useState<{ city?: string; address?: string; distanceKm?: number; walkingMin?: number; drivingMin?: number; busMin?: number; trainMin?: number; priceEstimate?: number; uberUrl?: string; gmapsUrl?: string } | null>(null);
  const { show } = useToast();
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
  const [returnInfo, setReturnInfo] = useState<{ city?: string; address?: string; airportName?: string; distanceKm?: number; walkingMin?: number; drivingMin?: number; busMin?: number; trainMin?: number; priceEstimate?: number; uberUrl?: string; gmapsUrl?: string; callTime?: string; notifyAt?: string } | null>(null);
  const [returnFiles, setReturnFiles] = useState<Array<{ name: string; type: string; size: number; id?: string; dataUrl?: string }>>([]);
  const returnTimer = useRef<number | null>(null);
  const [sideOpen, setSideOpen] = useState(false);
  const [savedDrawerOpen, setSavedDrawerOpen] = useState(false);
  const [savedCalendar, setSavedCalendar] = useState<{ events?: EventItem[] } | null>(null);
  const [savedTripsList, setSavedTripsList] = useState<TripItem[]>([]);
  const { data: session, status } = useSession();
  const { lang } = useI18n();
  const [gating, setGating] = useState<{ show: boolean; reason: "anon" | "noPremium"; tripId?: string } | null>(null);

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
      const trips: TripItem[] = getTrips();
      const idx = trips.findIndex((t) => t.title === title && t.date === date && t.passengers === pax);
      if (idx < 0) return;
      const next = [...trips];
      next[idx] = { ...next[idx], reachedFinalCalendar: true };
      if (typeof window !== "undefined") localStorage.setItem("calentrip:trips", JSON.stringify(next));
    } catch {}
  }, []);

  const sorted = useMemo(() => {
    const parse = (d: string, t?: string) => {
      const dd = (d || "").replace(/\//g, "-");
      const tt = (t || "00:00").padStart(5, "0");
      const iso = `${dd}T${tt}:00`;
      const dt = new Date(iso);
      return isNaN(dt.getTime()) ? new Date(0) : dt;
    };
    return [...events].sort((a, b) => parse(a.date, a.time).getTime() - parse(b.date, b.time).getTime());
  }, [events]);

  useEffect(() => {
    try {
      const trips: TripItem[] = getTrips();
      const current = trips.length ? trips[0] : null;
      if (!current) return;
      const premium = isTripPremium(current.id);
      if (status !== "authenticated") setGating({ show: true, reason: "anon", tripId: current.id });
      else if (!premium) setGating({ show: true, reason: "noPremium", tripId: current.id });
      else setGating(null);
    } catch {}
  }, [status]);

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

  useEffect(() => {
    try {
      const trips: TripItem[] = getTrips();
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
            const addDays = (d: string, days: number) => {
              const dt = new Date(`${d}T00:00:00`);
              if (Number.isNaN(dt.getTime())) return d;
              dt.setDate(dt.getDate() + days);
              const p = (n: number) => String(n).padStart(2, "0");
              return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
            };
            // Removemos a criação de eventos de chegada para evitar duplicação visual
          });
        } else {
          list.push({ type: "flight", label: t.title, date: t.date });
        }
      });
      const rawSummary = typeof window !== "undefined" ? localStorage.getItem("calentrip_trip_summary") : null;
      const summary = rawSummary ? (JSON.parse(rawSummary) as { cities?: CityPersist[] }) : null;
      const cities = Array.isArray(summary?.cities) ? (summary!.cities as CityPersist[]) : [];
      setSummaryCities(cities as Array<{ name?: string; checkin?: string; checkout?: string; address?: string; transportToNext?: TransportSegmentMeta; stayFiles?: SavedFile[] }>);
      cities.forEach((c, i) => {
        const cityName = c.name || `Cidade ${i + 1}`;
        const addr = c.address || "(endereço não informado)";
        if (c.checkin) {
          let ciTime = "23:59";
          try { if (localStorage.getItem("calentrip:arrivalNextDay_outbound") === "true") ciTime = "14:00"; } catch {}
          list.push({ type: "stay", label: `Check-in hospedagem: ${cityName} • Endereço: ${addr}`, date: c.checkin, time: ciTime, meta: { city: cityName, address: addr, kind: "checkin" } });
        }
        if (c.checkout) {
          list.push({ type: "stay", label: `Checkout hospedagem: ${cityName} • Endereço: ${addr}`, date: c.checkout, time: "09:00", meta: { city: cityName, address: addr, kind: "checkout" } });
        }
      });
      for (let i = 0; i < cities.length - 1; i++) {
        const c = cities[i];
        const n = cities[i + 1];
        const seg = c.transportToNext;
        if (seg) {
          const label = `Transporte: ${(c.name || `Cidade ${i + 1}`)} → ${(n?.name || `Cidade ${i + 2}`)} • ${(seg.mode || "").toUpperCase()}`;
          const date = c.checkout || n?.checkin || "";
          const time = seg.depTime || "10:00";
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
    if (!fn || !fn.origin || !fn.date || !fn.departureTime) return;
    setDrawerData({ originIata: fn.origin, departureDate: fn.date, departureTime: fn.departureTime });
    setDrawerOpen(true);
    setLoading(true);
    try {
      const airport = await findAirportByIata(fn.origin);
      const originQ = airport ? `${airport.name} (${airport.iata})` : `${fn.origin} airport`;
      const pos = await new Promise<GeolocationPosition | null>((resolve) => {
        if (!navigator.geolocation) resolve(null);
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
        uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=${d.lat}&dropoff[longitude]=${d.lon}&dropoff[formatted_address]=${encodeURIComponent(originQ)}`;
      }
      const gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${pos ? `${pos.coords.latitude},${pos.coords.longitude}` : ""}&destination=${encodeURIComponent(originQ)}`;
      const r2rUrl = `https://www.rome2rio.com/s/${encodeURIComponent("my location")}/${encodeURIComponent(originQ)}`;
      const trafficFactor = 1.3;
      const durationWithTrafficMin = durationMin ? Math.round(durationMin * trafficFactor) : undefined;
      let callTime: string | undefined;
      let notifyAt: string | undefined;
      if (fn.departureTime && fn.date) {
        const [h, m] = (fn.departureTime || "00:00").split(":");
        const dt = new Date(`${fn.date}T${h.padStart(2, "0")}:${m.padStart(2, "0")}:00`);
        const arriveTarget = new Date(dt.getTime() - 3 * 60 * 60 * 1000);
        const travelMs = (durationWithTrafficMin ?? durationMin ?? 60) * 60 * 1000;
        const callAt = new Date(arriveTarget.getTime() - travelMs);
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
                  new Notification("Lembrete de transporte", { body: `Chame o Uber às ${callTime}.` });
                }, delay);
              }
            }
          }
        } catch {}
      }
      setTransportInfo({ distanceKm, durationMin, durationWithTrafficMin, gmapsUrl, r2rUrl, uberUrl, airportName: originQ, callTime, notifyAt });
    } catch {
      setTransportInfo({ distanceKm: undefined, durationMin: undefined, durationWithTrafficMin: undefined });
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
      const d = await geocode(depPoint + (seg.originCity ? ` ${seg.originCity}` : ""));
      let distanceKm: number | undefined;
      let drivingMin: number | undefined;
      let walkingMin: number | undefined;
      let uberUrl: string | undefined;
      let gmapsUrl: string | undefined;
      let r2rUrl: string | undefined;
      let mapUrl: string | undefined;
      if (o && d) {
        const osrmDrive = `https://router.project-osrm.org/route/v1/driving/${o.lon},${o.lat};${d.lon},${d.lat}?overview=false`;
        const resD = await fetch(osrmDrive);
        const jsD = await resD.json();
        const rD = jsD?.routes?.[0];
        if (rD) {
          distanceKm = Math.round((rD.distance ?? 0) / 1000);
          drivingMin = Math.round((rD.duration ?? 0) / 60);
        }
        const osrmWalk = `https://router.project-osrm.org/route/v1/walking/${o.lon},${o.lat};${d.lon},${d.lat}?overview=false`;
        try {
          const resW = await fetch(osrmWalk);
          const jsW = await resW.json();
          const rW = jsW?.routes?.[0];
          if (rW) walkingMin = Math.round((rW.duration ?? 0) / 60);
        } catch {}
        const bbox = [Math.min(o.lon, d.lon), Math.min(o.lat, d.lat), Math.max(o.lon, d.lon), Math.max(o.lat, d.lat)];
        mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox.join("%2C")}&layer=mapnik`;
        uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=${d.lat}&dropoff[longitude]=${d.lon}&dropoff[formatted_address]=${encodeURIComponent(depPoint)}`;
        gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originAddr)}&destination=${encodeURIComponent(depPoint)}`;
        r2rUrl = `https://www.rome2rio.com/s/${encodeURIComponent(originAddr)}/${encodeURIComponent(depPoint)}`;
      }
      const trafficFactor = 1.3;
      const drivingWithTrafficMin = drivingMin ? Math.round(drivingMin * trafficFactor) : undefined;
      const busMin = drivingWithTrafficMin ? Math.round(drivingWithTrafficMin * 1.8) : undefined;
      const trainMin = drivingWithTrafficMin ? Math.round(drivingWithTrafficMin * 1.2) : undefined;
      let callTime: string | undefined;
      let notifyAt: string | undefined;
      if (item.date && item.time) {
        const [h, m] = (item.time || "00:00").split(":");
        const depDT = new Date(`${item.date}T${h.padStart(2, "0")}:${m.padStart(2, "0")}:00`);
        const bufferMin = 20;
        const travelMs = ((drivingWithTrafficMin ?? drivingMin ?? 30) + bufferMin) * 60 * 1000;
        const callAt = new Date(depDT.getTime() - travelMs);
        const notifyAtDate = new Date(callAt.getTime() - 60 * 60 * 1000);
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
      setStayInfo({ origin: originAddr, destination: depPoint, distanceKm, drivingMin: drivingWithTrafficMin ?? drivingMin, walkingMin, busMin, trainMin, uberUrl, gmapsUrl, r2rUrl, mapUrl, callTime, notifyAt });
    } catch {
      setStayInfo(null);
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
    if (!dest) { setArrivalInfo({ city: m.city, address: m.address }); return; }
    const getPos = () => new Promise<GeolocationPosition | null>((resolve) => {
      try { navigator.geolocation.getCurrentPosition((p) => resolve(p), () => resolve(null), { enableHighAccuracy: true, maximumAge: 30000, timeout: 20000 }); } catch { resolve(null); }
    });
    try {
      const pos = await getPos();
      if (!pos) { setArrivalInfo({ city: m.city, address: m.address }); return; }
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
      const uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=${dest.lat}&dropoff[longitude]=${dest.lon}&dropoff[formatted_address]=${encodeURIComponent(m.address || m.city || "")}`;
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
      setArrivalInfo({ city: m.city, address: m.address });
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
        uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=${dest.lat}&dropoff[longitude]=${dest.lon}&dropoff[formatted_address]=${encodeURIComponent(query)}`;
        setGoInfo({ destination: query, distanceKm, walkingMin, drivingMin: driveWithTraffic ?? drivingMin, busMin, trainMin, priceEstimate, uberUrl, gmapsUrl });
      } else {
        setGoInfo({ destination: query });
      }
    } catch {
      setGoInfo(null);
    } finally {
      setGoLoading(false);
    }
  }

  const lastCheckoutIdx = useMemo(() => {
    let idx = -1;
    events.forEach((e, i) => {
      const m = e.meta as { kind?: string } | undefined;
      if (e.type === "stay" && m?.kind === "checkout") idx = i;
    });
    return idx;
  }, [events]);

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
      if (o && d) {
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
        uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup[latitude]=${o.lat}&pickup[longitude]=${o.lon}&dropoff[latitude]=${d.lat}&dropoff[longitude]=${d.lon}&dropoff[formatted_address]=${encodeURIComponent(airport ? `${airport.name} (${airport.iata})` : `${fn.origin} airport`)}`;
        if (fn.departureTime && fn.date) {
          const [h, m] = (fn.departureTime || "00:00").split(":");
          const dt = new Date(`${fn.date}T${h.padStart(2, "0")}:${m.padStart(2, "0")}:00`);
          const mins = 240 + (driveWithTraffic ?? drivingMin ?? 60);
          const notify = new Date(dt.getTime() - mins * 60 * 1000);
          notifyAt = `${String(notify.getHours()).padStart(2, "0")}:${String(notify.getMinutes()).padStart(2, "0")}`;
          callTime = notifyAt;
        }
      }
      setReturnInfo({ city: last.name, address: last.address, airportName: airport ? `${airport.name} (${airport.iata})` : `${fn.origin} airport`, distanceKm, walkingMin, drivingMin, busMin, trainMin, priceEstimate, uberUrl, gmapsUrl, callTime, notifyAt });
    } catch {
      setReturnInfo({ city: summaryCities[summaryCities.length - 1]?.name, address: summaryCities[summaryCities.length - 1]?.address });
    } finally {
      setReturnLoading(false);
    }
  }, [summaryCities]);

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
            try { show("Opções de deslocamento disponíveis", { variant: "info" }); } catch {}
          }, delay);
          returnTimer.current = id;
        }
      }
    })();
    return () => {
      if (returnTimer.current) { try { clearTimeout(returnTimer.current); } catch {} returnTimer.current = null; }
    };
  }, [summaryCities, show, openReturnAirportDrawer]);

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
      const thresholdKm = 20;
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
              try { show("Opções de deslocamento disponíveis", { variant: "info" }); } catch {}
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
  }, [events, show]);

  return (
    <div className="min-h-screen pl-14 pr-4 py-6 space-y-6">
      {gating?.show ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="max-w-md w-full bg-white rounded-xl p-5 space-y-3">
            <DialogHeader>{gating.reason === "anon" ? "Faça login para desbloquear" : "Assinatura necessária"}</DialogHeader>
            <div className="text-sm text-zinc-700">
              {gating.reason === "anon" ? (
                <div>
                  Entre para continuar e desbloquear recursos premium. Você pode usar Google ou conta demo.
                </div>
              ) : (
                <div>
                  Assinatura única de R$ 15 por viagem. Válida até o último dia da viagem; depois, você continua consultando o calendário. Para nova viagem, é necessário assinar novamente.
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-2">
              {gating.reason === "anon" ? (
                <>
                  <Button type="button" onClick={() => signIn("google")}>Entrar com Google</Button>
                  <Button type="button" variant="secondary" onClick={() => signIn("credentials", { email: "demo@calentrip.com", password: "demo", callbackUrl: "/calendar/final" })}>Entrar Demo</Button>
                </>
              ) : (
                <Button
                  type="button"
                  onClick={() => {
                    try {
                      const trips: TripItem[] = getTrips();
                      const current = trips.find((t) => t.id === gating?.tripId);
                      const rawSummary = typeof window !== "undefined" ? localStorage.getItem("calentrip_trip_summary") : null;
                      const summary = rawSummary ? (JSON.parse(rawSummary) as { cities?: { checkout?: string }[] }) : null;
                      const lastCheckout = Array.isArray(summary?.cities) ? (summary!.cities!.map((c) => c.checkout).filter(Boolean).slice(-1)[0] || undefined) : undefined;
                      const returnDate = (() => {
                        const notes = current?.flightNotes || [];
                        const ret = notes.filter((n) => n.leg === "inbound").map((n) => n.date).filter(Boolean).slice(-1)[0];
                        return ret;
                      })();
                      const expiresAt = computeExpiryFromData({ tripDate: current?.date, returnDate, lastCheckout });
                      if (current) setTripPremium(current.id, expiresAt);
                      setGating(null);
                    } catch {}
                  }}
                >
                  Assinar agora (R$ 15)
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
                    <div className="mt-2 flex items-center gap-2">
                      <button type="button" className="underline text-xs" onClick={() => { try { window.location.href = "/profile"; } catch {} }}>Ver perfil</button>
                      <button type="button" className="text-xs" onClick={() => signOut()}>Sair</button>
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
          
          <button type="button" className="flex w-full items-center gap-3 rounded-md px-3 h-10 hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={() => {
            try {
              const raw = typeof window !== "undefined" ? localStorage.getItem("calentrip:saved_calendar") : null;
              const sc = raw ? JSON.parse(raw) as { events?: EventItem[] } : null;
              setSavedCalendar(sc);
            } catch { setSavedCalendar(null); }
            try {
              const trips = getTrips();
              setSavedTripsList(trips);
            } catch { setSavedTripsList([]); }
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
          <button type="button" className="flex w-full items-center gap-3 rounded-md px-3 h-10 hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={() => { try { window.location.href = "/calendar/month"; } catch {} }}>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800">
              <span className="material-symbols-outlined text-[22px] text-[#007AFF]">calendar_month</span>
            </span>
            {sideOpen ? <span className="text-sm font-medium">Calendário mensal</span> : null}
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-md px-3 h-10 hover:bg-zinc-50 dark:hover:bg-zinc-900"
            onClick={() => {
              try {
                if (typeof window !== "undefined") {
                  localStorage.removeItem("calentrip_trip_summary");
                  localStorage.removeItem("calentrip:entertainment:records");
                  localStorage.removeItem("calentrip:saved_calendar");
                  localStorage.removeItem("calentrip:tripSearch");
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
              const payload = { events };
              if (typeof window !== "undefined") localStorage.setItem("calentrip:saved_calendar", JSON.stringify(payload));
              show("Salvo em suas viagens", { variant: "success" });
            } catch { show("Erro ao salvar", { variant: "error" }); }
          }}>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800">
              <span className="material-symbols-outlined text-[22px] text-[#007AFF]">bookmark_add</span>
            </span>
            {sideOpen ? <span className="text-sm font-medium">Salvar calendário</span> : null}
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
            show("Abrindo e-mail", { variant: "info" });
          }}>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800">
              <span className="material-symbols-outlined text-[22px] text-[#007AFF]">mail</span>
            </span>
            {sideOpen ? <span className="text-sm font-medium">Enviar por e-mail</span> : null}
          </button>
          <button type="button" className="flex w-full items-center gap-3 rounded-md px-3 h-10 hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={async () => {
            const text = events.map((e) => `${e.date} ${e.time || ""} • ${e.label}`).join("\n");
            try {
              if (navigator.share) { await navigator.share({ title: "Calendário", text }); show("Compartilhado", { variant: "success" }); return; }
              await navigator.clipboard.writeText(text);
              show("Calendário copiado", { variant: "success" });
            } catch { show("Erro ao compartilhar", { variant: "error" }); }
          }}>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800">
              <span className="material-symbols-outlined text-[22px] text-[#007AFF]">share</span>
            </span>
            {sideOpen ? <span className="text-sm font-medium">Compartilhar calendário</span> : null}
          </button>
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
            function parseDT(date: string, time?: string) {
              const s = `${date || ""} ${time || "00:00"}`.trim().replace(/\//g, "-");
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
                uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup[latitude]=${o.lat}&pickup[longitude]=${o.lon}&dropoff[latitude]=${d.lat}&dropoff[longitude]=${d.lon}&dropoff[formatted_address]=${encodeURIComponent(airport ? `${airport.name} (${airport.iata})` : `${fn.origin} airport`)}`;
                if (fn.departureTime && fn.date) {
                  const [h, m] = (fn.departureTime || "00:00").split(":");
                  const dt = new Date(`${fn.date}T${h.padStart(2, "0")}:${m.padStart(2, "0")}:00`);
                  const mins = 240 + (driveWithTraffic ?? drivingMin ?? 60);
                  const notify = new Date(dt.getTime() - mins * 60 * 1000);
                  notifyAt = `${String(notify.getHours()).padStart(2, "0")}:${String(notify.getMinutes()).padStart(2, "0")}`;
                  callTime = notifyAt;
                }
              }
              return { airportName: airport ? `${airport.name} (${airport.iata})` : `${fn.origin} airport`, distanceKm, walkingMin, drivingMin, busMin, trainMin, priceEstimate, gmapsUrl, uberUrl, callTime, notifyAt };
            }
            const lines: string[] = [];
            lines.push("BEGIN:VCALENDAR");
            lines.push("VERSION:2.0");
            lines.push("PRODID:-//CalenTrip//Calendar Export//PT");
            const returnDetails = await computeReturnDetails();
            events.forEach((e, idx) => {
              const start = parseDT(e.date, e.time);
              const end = start ? new Date(start.getTime() + 60 * 60 * 1000) : null;
              const desc = e.label;
              lines.push("BEGIN:VEVENT");
              if (start) lines.push(`DTSTART:${fmt(start)}`);
              if (end) lines.push(`DTEND:${fmt(end)}`);
              lines.push(`SUMMARY:${e.label}`);
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
                if (extra?.gmapsUrl) info.push(`Google Maps: ${extra.gmapsUrl}`);
                if (extra?.uberUrl) info.push(`Uber: ${extra.uberUrl}`);
                if (extra?.callTime) info.push(`Chamar Uber às: ${extra.callTime}`);
                if (extra?.notifyAt) info.push(`Notificação programada: ${extra.notifyAt}`);
                lines.push(`DESCRIPTION:${info.join("\\n")}`);
              } else {
                lines.push(`DESCRIPTION:${desc}`);
              }
              lines.push("END:VEVENT");
            });
            lines.push("END:VCALENDAR");
            const blob = new Blob([lines.join("\n")], { type: "text/calendar;charset=utf-8" });
            const file = new File([blob], "calentrip.ics", { type: "text/calendar" });
            try {
              const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean; share?: (data: ShareData) => Promise<void> };
              const canShareFiles = typeof nav !== "undefined" && typeof nav.canShare === "function" && nav.canShare({ files: [file] });
              if (canShareFiles && typeof nav.share === "function") {
                await nav.share({ files: [file], title: "CalenTrip" });
                const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
                const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && typeof window !== "undefined" && "ontouchend" in window);
                const isAndroid = /Android/.test(ua);
                if (isIOS) {
                  show("Calendário enviado. No iPhone, toque 'Adicionar à Agenda' e confirme.", { variant: "success" });
                } else if (isAndroid) {
                  show("Calendário enviado. No Android, escolha 'Calendário' e toque em 'Salvar/Adicionar'.", { variant: "success" });
                } else {
                  show("Calendário enviado ao sistema. Abra no seu app de calendário.", { variant: "success" });
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
                  show("Importação aberta. No iPhone, toque 'Adicionar à Agenda' e confirme.", { variant: "success" });
                } else {
                  show("Importação aberta. No Android, escolha 'Calendário' e toque em 'Salvar/Adicionar'.", { variant: "success" });
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
            show("Arquivo .ics baixado. Abra com Google/Outlook/Apple Calendar para importar.", { variant: "info" });
            }}>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800">
              <span className="material-symbols-outlined text-[22px]">calendar_month</span>
            </span>
            {sideOpen ? <span className="text-sm font-medium">Salvar no calendário do dispositivo</span> : null}
          </button>
          <button type="button" className="flex w-full items-center gap-3 rounded-md px-3 h-10 hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={() => { try { window.location.href = "/profile"; } catch {} }}>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800">
              <span className="material-symbols-outlined text-[22px]">account_circle</span>
            </span>
            {sideOpen ? <span className="text-sm font-medium">Perfil</span> : null}
          </button>
        </div>
      </div>
      {sideOpen ? (
        <div className="fixed top-0 right-0 bottom-0 left-56 z-30 bg-black/10" onClick={() => setSideOpen(false)} />
      ) : null}
      <div className="container-page">
        <h1 className="mb-1 text-2xl font-semibold text-[var(--brand)]">Calendário final</h1>
        <p className="text-sm text-zinc-600">Veja todas as atividades em ordem cronológica. Configure o transporte para o aeroporto.</p>
      </div>

      <div className="container-page">
        <Card>
          <CardHeader>
            <CardTitle>Eventos</CardTitle>
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
                        {ev.type === "flight" && (ev.meta as FlightNote)?.leg === "outbound" && (ev.meta as FlightNote)?.departureTime ? (
                          <Button type="button" variant="outline" className="px-2 py-1 text-xs rounded-md gap-1" onClick={() => openTransportDrawer(ev)}>
                            <span className="material-symbols-outlined text-[16px]">local_taxi</span>
                            <span>Aeroporto</span>
                          </Button>
                        ) : null}
                        {ev.type === "flight" && (ev.meta as FlightNote)?.leg === "inbound" && `${(ev.meta as FlightNote).origin}|${(ev.meta as FlightNote).destination}|${ev.date}|${ev.time || ""}` === lastInboundSignature ? (
                          <Button type="button" variant="outline" className="px-2 py-1 text-xs rounded-md gap-1" onClick={() => openReturnAirportDrawer()}>
                            <span className="material-symbols-outlined text-[16px]">local_taxi</span>
                            <span>Aeroporto</span>
                          </Button>
                        ) : null}
                        {ev.type === "transport" ? (
                          <Button type="button" variant="outline" className="px-2 py-1 text-xs rounded-md gap-1" onClick={() => openDepartureDrawer(ev)}>
                            <span className="material-symbols-outlined text-[16px]">directions</span>
                            <span>Rota</span>
                          </Button>
                        ) : null}
                        {ev.type === "stay" && (ev.meta as { kind?: string })?.kind === "checkin" ? (
                          <Button type="button" variant="outline" className="px-2 py-1 text-xs rounded-md gap-1" onClick={() => openCheckinDrawer(ev)}>
                            <span className="material-symbols-outlined text-[16px]">home</span>
                            <span>Hospedagem</span>
                          </Button>
                        ) : null}
                        {ev.type === "stay" && (ev.meta as { kind?: string })?.kind === "checkout" && idx === lastCheckoutIdx ? (
                          <Button type="button" variant="outline" className="px-2 py-1 text-xs rounded-md gap-1" onClick={() => openReturnAirportDrawer()}>
                            <span className="material-symbols-outlined text-[16px]">local_airport</span>
                            <span>Aeroporto final</span>
                          </Button>
                        ) : null}
                        {(ev.type === "activity" || ev.type === "restaurant") ? (
                          <Button type="button" variant="outline" className="px-2 py-1 text-xs rounded-md gap-1" onClick={() => openGoDrawer(ev)}>
                            <span className="material-symbols-outlined text-[16px]">map</span>
                            <span>Ir</span>
                          </Button>
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

  {drawerOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setDrawerOpen(false); setTransportInfo(null); }} />
          <div className="absolute bottom-0 left-0 right-0 z-10 w-full rounded-t-2xl border border-zinc-200 bg-white p-5 md:p-6 shadow-xl dark:border-zinc-800 dark:bg-black">
            <DialogHeader>Transporte até o aeroporto</DialogHeader>
            <div className="space-y-3 text-sm">
              {loading ? (
                <div>Calculando…</div>
              ) : (
                <>
                  <div>Destino: {transportInfo?.airportName || drawerData?.originIata}</div>
                  <div>Distância: {transportInfo?.distanceKm ? `${transportInfo.distanceKm} km` : "—"}</div>
                  <div>Tempo estimado (com trânsito): {transportInfo?.durationWithTrafficMin ? `${transportInfo.durationWithTrafficMin} min` : transportInfo?.durationMin ? `${transportInfo.durationMin} min` : "—"}</div>
                  <div className="mt-2">
                    <a className="underline" href={transportInfo?.gmapsUrl} target="_blank" rel="noopener noreferrer">Abrir rota no Google Maps</a>
                  </div>
                  <div>
                    <a className="underline" href={transportInfo?.r2rUrl} target="_blank" rel="noopener noreferrer">Ver opções em Rome2Rio</a>
                  </div>
                  <div>
                    <a className="underline" href={transportInfo?.uberUrl} target="_blank" rel="noopener noreferrer">Abrir Uber com destino preenchido</a>
                  </div>
                  <div className="mt-2">Chegar no aeroporto: 3h antes do voo.</div>
                  <div>Chamar Uber às: {transportInfo?.callTime || "—"}</div>
                  <div>Notificação programada: {transportInfo?.notifyAt ? `às ${transportInfo.notifyAt}` : "—"}</div>
                  <div className="mt-3 flex justify-end">
                    <Button type="button" className="h-10 rounded-lg font-semibold tracking-wide" onClick={() => { setDrawerOpen(false); setTransportInfo(null); }}>Fechar</Button>
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
            <div className="font-semibold mb-1">Calendário salvo</div>
            {savedCalendar?.events && savedCalendar.events.length ? (
              <div className="space-y-2">
                <div>{savedCalendar.events.length} eventos</div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" onClick={() => { setEvents(savedCalendar!.events!); setSavedDrawerOpen(false); }}>Carregar calendário</Button>
                </div>
              </div>
            ) : (
              <div className="text-zinc-600">Nenhum calendário salvo.</div>
            )}
          </div>
          <div className="rounded border p-3">
            <div className="font-semibold mb-1">Pesquisas salvas</div>
            {savedTripsList.length ? (
              <ul className="space-y-2">
                {savedTripsList.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">{t.title}</div>
                      <div className="text-xs text-zinc-600">{t.date} • {t.passengers} pax</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" onClick={() => {
                        const legs = (t.flightNotes || []).map((n) => `${n.leg === "outbound" ? "Ida" : "Volta"}: ${n.origin} → ${n.destination} • ${n.date} ${n.departureTime || ""}`);
                        alert(legs.join("\n"));
                      }}>Ver</Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-zinc-600">Nenhuma pesquisa salva.</div>
            )}
          </div>
          <div className="mt-3 flex justify-end">
            <Button type="button" className="h-10 rounded-lg font-semibold tracking-wide" onClick={() => setSavedDrawerOpen(false)}>Fechar</Button>
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
          <div>Cidade: {arrivalInfo?.city || "—"}</div>
          <div>Destino: {arrivalInfo?.address || "—"}</div>
          <div>Distância: {arrivalInfo?.distanceKm ? `${arrivalInfo.distanceKm} km` : "—"}</div>
            <div className="grid grid-cols-2 gap-2">
              <div>A pé: {arrivalInfo?.walkingMin ? `${arrivalInfo.walkingMin} min` : "—"}</div>
              <div>Ônibus: {arrivalInfo?.busMin ? `${arrivalInfo.busMin} min (estimado)` : "—"}</div>
              <div>Trem/Metro: {arrivalInfo?.trainMin ? `${arrivalInfo.trainMin} min (estimado)` : "—"}</div>
              <div>Uber/Táxi: {arrivalInfo?.drivingMin ? `${arrivalInfo.drivingMin} min` : "—"}{arrivalInfo?.priceEstimate !== undefined ? ` • R$${arrivalInfo.priceEstimate}` : ""}</div>
          </div>
          <div>
            <a className="underline" href={arrivalInfo?.gmapsUrl} target="_blank" rel="noopener noreferrer">Abrir rota no Google Maps</a>
          </div>
          <div>
            <a className="underline" href={arrivalInfo?.uberUrl} target="_blank" rel="noopener noreferrer">Abrir Uber com destino preenchido</a>
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
                  setDocTitle(arrivalInfo?.city || arrivalInfo?.address || "Hospedagem");
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
                }}>Arquivos salvos</Button>
              </div>
            ) : null;
          })()}
          <div className="mt-3 flex justify-end">
            <Button type="button" className="h-10 rounded-lg font-semibold tracking-wide" onClick={() => { setArrivalDrawerOpen(false); setArrivalInfo(null); }}>Fechar</Button>
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
              <div>Distância: {goInfo?.distanceKm ? `${goInfo.distanceKm} km` : "—"}</div>
              <div className="grid grid-cols-2 gap-2">
                <div>A pé: {goInfo?.walkingMin ? `${goInfo.walkingMin} min` : "—"}</div>
                <div>Ônibus: {goInfo?.busMin ? `${goInfo.busMin} min (estimado)` : "—"}</div>
                <div>Trem/Metro: {goInfo?.trainMin ? `${goInfo.trainMin} min (estimado)` : "—"}</div>
                <div>Uber/Táxi: {goInfo?.drivingMin ? `${goInfo.drivingMin} min` : "—"}{goInfo?.priceEstimate !== undefined ? ` • R$${goInfo.priceEstimate}` : ""}</div>
              </div>
              <div>
                <a className="underline" href={goInfo?.gmapsUrl} target="_blank" rel="noopener noreferrer">Abrir rota no Google Maps</a>
              </div>
              <div>
                <a className="underline" href={goInfo?.uberUrl} target="_blank" rel="noopener noreferrer">Abrir Uber com destino preenchido</a>
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
                <Button type="button" className="h-10 rounded-lg font-semibold tracking-wide" onClick={() => { setGoDrawerOpen(false); setGoInfo(null); setGoRecord(null); }}>Fechar</Button>
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
              <div>Distância: {returnInfo?.distanceKm ? `${returnInfo.distanceKm} km` : "—"}</div>
              <div className="grid grid-cols-2 gap-2">
                <div>A pé: {returnInfo?.walkingMin ? `${returnInfo.walkingMin} min` : "—"}</div>
                <div>Ônibus: {returnInfo?.busMin ? `${returnInfo.busMin} min (estimado)` : "—"}</div>
                <div>Trem/Metro: {returnInfo?.trainMin ? `${returnInfo.trainMin} min (estimado)` : "—"}</div>
                <div>Uber/Táxi: {returnInfo?.drivingMin ? `${returnInfo.drivingMin} min` : "—"}{returnInfo?.priceEstimate !== undefined ? ` • R$${returnInfo.priceEstimate}` : ""}</div>
              </div>
              <div>
                <a className="underline" href={returnInfo?.gmapsUrl} target="_blank" rel="noopener noreferrer">Abrir rota no Google Maps</a>
              </div>
              <div>
                <a className="underline" href={returnInfo?.uberUrl} target="_blank" rel="noopener noreferrer">Abrir Uber com destino preenchido</a>
              </div>
              <div className="mt-2">Chamar Uber às: {returnInfo?.callTime || "—"}</div>
              <div>Notificação programada: {returnInfo?.notifyAt ? `às ${returnInfo.notifyAt}` : "—"}</div>
              {returnFiles.length ? (
                <div>
                  <Button type="button" variant="outline" onClick={async () => {
                    setDocTitle(returnInfo?.airportName || "Voo de volta");
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
                <Button type="button" className="h-10 rounded-lg font-semibold tracking-wide" onClick={() => { setReturnDrawerOpen(false); setReturnInfo(null); }}>Fechar</Button>
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
                  <div>Distância: {stayInfo?.distanceKm ? `${stayInfo.distanceKm} km` : "—"}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>A pé: {stayInfo?.walkingMin ? `${stayInfo.walkingMin} min` : "—"}</div>
                    <div>Ônibus: {stayInfo?.busMin ? `${stayInfo.busMin} min (estimado)` : "—"}</div>
                    <div>Trem/Metro: {stayInfo?.trainMin ? `${stayInfo.trainMin} min (estimado)` : "—"}</div>
                    <div>Uber/Táxi: {stayInfo?.drivingMin ? `${stayInfo.drivingMin} min` : "—"}</div>
                  </div>
                  {stayInfo?.mapUrl ? (
                    <iframe title="map" src={stayInfo.mapUrl} className="mt-2 h-40 w-full rounded-md border" />
                  ) : null}
                  <div className="mt-2">
                    <a className="underline" href={stayInfo?.gmapsUrl} target="_blank" rel="noopener noreferrer">Abrir rota no Google Maps</a>
                  </div>
                  <div>
                    <a className="underline" href={stayInfo?.r2rUrl} target="_blank" rel="noopener noreferrer">Ver opções em Rome2Rio</a>
                  </div>
                  <div>
                    <a className="underline" href={stayInfo?.uberUrl} target="_blank" rel="noopener noreferrer">Abrir Uber com destino preenchido</a>
                  </div>
                  <div className="mt-2">Chamar Uber às: {stayInfo?.callTime || "—"}</div>
                  <div>Notificação programada: {stayInfo?.notifyAt ? `às ${stayInfo.notifyAt}` : "—"}</div>
                  <div className="mt-3 flex justify-end">
                    <Button type="button" className="h-10 rounded-lg font-semibold tracking-wide" onClick={() => { setStayDrawerOpen(false); setStayInfo(null); }}>Fechar</Button>
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
                <Button type="button" className="h-10 rounded-lg font-semibold tracking-wide" onClick={() => { setDocOpen(false); setDocFiles([]); }}>Fechar</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
