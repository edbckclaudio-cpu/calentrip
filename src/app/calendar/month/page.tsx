"use client";
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useNativeAuth } from "@/lib/native-auth";
import { isTripPremium } from "@/lib/premium";
import Image from "next/image";
import { useI18n } from "@/lib/i18n";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { TripItem, FlightNote, getSavedTrips, getTripEvents, updateTrip, migrateFromLocalStorage } from "@/lib/trips-db";
import { alarmForEvent } from "@/lib/ics";
import { findAirportByIata, searchAirportsAsync } from "@/lib/airports";
import { Capacitor } from "@capacitor/core";
      {premiumGateOpen && (
        <Dialog open={premiumGateOpen} onOpenChange={setPremiumGateOpen} placement="center" disableBackdropClose>
          <div className="max-w-md w-full bg-white dark:bg-black rounded-xl p-5 space-y-3">
            <DialogHeader>Recurso exclusivo para assinantes</DialogHeader>
            <div className="text-sm text-zinc-700 dark:text-zinc-300">
              Para salvar, enviar por e-mail ou exportar o calendário (.ics), é necessário ter uma assinatura ativa.
              Entre na sua conta e ative a assinatura mensal para liberar estes recursos.
            </div>
            <div className="flex gap-2 mt-2">
              <Button type="button" onClick={() => { try { setPremiumGateOpen(false); router.push("/profile"); } catch {} }}>Entrar e assinar</Button>
              <Button type="button" variant="outline" onClick={() => { try { setPremiumGateOpen(false); router.push("/subscription/checkout"); } catch {} }}>Ver planos</Button>
              <Button type="button" variant="outline" onClick={() => setPremiumGateOpen(false)}>Mais tarde</Button>
            </div>
          </div>
        </Dialog>
      )}
type RecordItem = { kind: "activity" | "restaurant"; cityIdx: number; cityName: string; date: string; time?: string; title: string; address?: string; files?: Array<{ name: string; type: string; size: number; dataUrl?: string }> };
type TransportSegmentMeta = { mode: "air" | "train" | "bus" | "car"; dep: string; arr: string; depTime?: string; arrTime?: string; originAddress?: string; originCity?: string };
type EventItem = { type: "flight" | "activity" | "restaurant" | "transport" | "stay"; label: string; date: string; time?: string; meta?: FlightNote | RecordItem | TransportSegmentMeta | { city?: string; address?: string; kind: "checkin" | "checkout" } };

export default function MonthCalendarPage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [sideOpen, setSideOpen] = useState(false);
  const [dayOpen, setDayOpen] = useState<string | null>(null);
  const { data: session, status } = useSession();
  const { loginWithGoogle } = useNativeAuth();
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerData, setDrawerData] = useState<{ originIata: string; departureDate: string; departureTime: string } | null>(null);
  const [premiumGateOpen, setPremiumGateOpen] = useState(false);
  const [transportInfo, setTransportInfo] = useState<{ distanceKm?: number; durationMin?: number; durationWithTrafficMin?: number; gmapsUrl?: string; r2rUrl?: string; uberUrl?: string; airportName?: string; arrivalByTime?: string; callTime?: string; notifyAt?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [stayDrawerOpen, setStayDrawerOpen] = useState(false);
  const [stayLoading, setStayLoading] = useState(false);
  const [stayInfo, setStayInfo] = useState<{ origin?: string; destination?: string; distanceKm?: number; drivingMin?: number; walkingMin?: number; busMin?: number; trainMin?: number; uberUrl?: string; gmapsUrl?: string; r2rUrl?: string; mapUrl?: string; callTime?: string; notifyAt?: string } | null>(null);
  const [arrivalDrawerOpen, setArrivalDrawerOpen] = useState(false);
  const [arrivalInfo, setArrivalInfo] = useState<{ city?: string; address?: string; distanceKm?: number; walkingMin?: number; drivingMin?: number; busMin?: number; trainMin?: number; priceEstimate?: number; uberUrl?: string; gmapsUrl?: string } | null>(null);
  const [goDrawerOpen, setGoDrawerOpen] = useState(false);
  const [goLoading, setGoLoading] = useState(false);
  const [goInfo, setGoInfo] = useState<{ destination?: string; distanceKm?: number; walkingMin?: number; drivingMin?: number; busMin?: number; trainMin?: number; priceEstimate?: number; uberUrl?: string; gmapsUrl?: string } | null>(null);
  const [docOpen, setDocOpen] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docFiles, setDocFiles] = useState<Array<{ name: string; type: string; size: number; dataUrl?: string }>>([]);
  const [locConsent, setLocConsent] = useState<"granted" | "denied" | "skipped" | "default">("default");
  const [locModalOpen, setLocModalOpen] = useState(false);
  const [stayCandidates, setStayCandidates] = useState<Array<{ name: string; lat: number; lon: number }>>([]);
  const [stayChosenIdx, setStayChosenIdx] = useState<number | null>(null);
  const [stayMode, setStayMode] = useState<"air" | "train" | "bus" | "car" | null>(null);
  const [stayCityForSearch, setStayCityForSearch] = useState<string>("");
  const [nameDrawerOpen, setNameDrawerOpen] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const toastOnce = useRef<Set<string>>(new Set());
  const showOnce = useCallback((message: string, opts?: { variant?: "info" | "success" | "error"; duration?: number; sticky?: boolean }) => {
    if (toastOnce.current.has(message)) return 0;
    toastOnce.current.add(message);
    const id = show(message, opts);
    try { setTimeout(() => { try { toastOnce.current.delete(message); } catch {} }, 15000); } catch {}
    return id;
  }, [show]);
  const ensureLocationConsent = useCallback(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("calentrip:locConsent") : null;
      const s = raw === "granted" ? "granted" : raw === "denied" ? "denied" : raw === "skipped" ? "skipped" : "default";
      const s2 = s as "granted" | "denied" | "skipped" | "default";
      setLocConsent(s2);
      if (s === "default") { setLocModalOpen(true); return false; }
      return s === "granted";
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (gating?.show) setPremiumGateOpen(true);
  }, [gating]);

  function ensureSubscriber(): boolean {
    const ok = (status === "authenticated") && premiumFlag;
    if (!ok) {
      setPremiumGateOpen(true);
      try { showOnce("Recurso exclusivo para assinantes", { variant: "info" }); } catch {}
    }
    return ok;
  }

  function openExternal(url: string | undefined, type: "maps" | "uber") {
    if (!url) return;
    try {
      const isAndroid = Capacitor.getPlatform() === "android";
      if (isAndroid) {
        if (type === "maps") {
          const u = new URL(url);
          const intentUrl = `intent://maps.google.com/maps?${u.searchParams.toString()}#Intent;scheme=https;package=com.google.android.apps.maps;end`;
          window.location.href = intentUrl;
          return;
        }
        if (type === "uber") {
          const u = new URL(url);
          const intentUrl = `intent://m.uber.com/ul/?${u.searchParams.toString()}#Intent;scheme=https;package=com.ubercab;end`;
          window.location.href = intentUrl;
          return;
        }
      }
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      try { window.open(url, "_blank", "noopener,noreferrer"); } catch {}
    }
  }

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
      }
      setTransportInfo({ distanceKm, durationMin, durationWithTrafficMin, gmapsUrl, r2rUrl, uberUrl, airportName: originQ, arrivalByTime: arriveBy, callTime, notifyAt });
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
    setStayDrawerOpen(true);
    setStayLoading(true);
    try {
      const geocode = async (q: string) => {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        const js = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
        return js[0] ? { lat: Number(js[0].lat), lon: Number(js[0].lon), display: js[0].display_name } : null;
      };
      const o = originAddr ? await geocode(originAddr) : null;
      setStayCandidates([]);
      setStayChosenIdx(null);
      setStayMode(seg.mode);
      const cityForSearch = (seg.originCity || "").trim();
      setStayCityForSearch(cityForSearch);
      let destLabel: string | undefined;
      let destLatLon: { lat: number; lon: number } | null = null;
      if (cityForSearch) {
        if (seg.mode === "bus") {
          try {
            const fetchList = async (q: string) => {
              const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=8`;
              const res = await fetch(url, { headers: { Accept: "application/json" } });
              const js = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
              return js.map((r) => ({ name: r.display_name, lat: Number(r.lat), lon: Number(r.lon) }));
            };
            const list1 = await fetchList(`rodoviária ${cityForSearch}`);
            const list2 = await fetchList(`bus station ${cityForSearch}`);
            const list3 = await fetchList(`terminal ônibus ${cityForSearch}`);
            const seen = new Set<string>();
            const merged: Array<{ name: string; lat: number; lon: number }> = [];
            [...list1, ...list2, ...list3].forEach((it) => {
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
              const rawSel = typeof window !== "undefined" ? localStorage.getItem("calentrip:bus_station_selection") : null;
              const map = rawSel ? JSON.parse(rawSel) as Record<string, { name: string; lat: number; lon: number }> : {};
              const saved = map[cityForSearch];
              const idxSaved = saved ? merged.findIndex((c) => Math.abs(c.lat - saved.lat) < 0.001 && Math.abs(c.lon - saved.lon) < 0.001) : -1;
              const chosen = idxSaved >= 0 ? merged[idxSaved] : merged[0];
              destLabel = chosen.name;
              destLatLon = { lat: chosen.lat, lon: chosen.lon };
              setStayChosenIdx(idxSaved >= 0 ? idxSaved : 0);
            }
          } catch {}
        } else if (seg.mode === "train") {
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
              const rawSel = typeof window !== "undefined" ? localStorage.getItem("calentrip:train_station_selection") : null;
              const map = rawSel ? (JSON.parse(rawSel) as Record<string, { name: string; lat: number; lon: number }>) : {};
              const saved = map[cityForSearch];
              const idxSaved = saved ? merged.findIndex((c) => Math.abs(c.lat - saved.lat) < 0.001 && Math.abs(c.lon - saved.lon) < 0.001) : -1;
              const chosen = idxSaved >= 0 ? merged[idxSaved] : merged[0];
              destLabel = chosen.name;
              destLatLon = { lat: chosen.lat, lon: chosen.lon };
              setStayChosenIdx(idxSaved >= 0 ? idxSaved : 0);
            }
          } catch {}
        } else if (seg.mode === "air") {
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
              const merged = geos.map((g) => ({ name: g.name, lat: g.lat, lon: g.lon }));
              setStayCandidates(merged.slice(0, 6));
              const rawSel = typeof window !== "undefined" ? localStorage.getItem("calentrip:airport_selection") : null;
              const map = rawSel ? (JSON.parse(rawSel) as Record<string, { name: string; lat: number; lon: number }>) : {};
              const saved = map[cityForSearch];
              const idxSaved = saved ? merged.findIndex((c) => Math.abs(c.lat - saved.lat) < 0.001 && Math.abs(c.lon - saved.lon) < 0.001) : -1;
              const chosen = idxSaved >= 0 ? merged[idxSaved] : merged[0];
              destLabel = chosen.name;
              destLatLon = { lat: chosen.lat, lon: chosen.lon };
              setStayChosenIdx(idxSaved >= 0 ? idxSaved : 0);
            }
          } catch {}
        }
      }
      const d = destLatLon ? { lat: destLatLon.lat, lon: destLatLon.lon, display: destLabel || depPoint } : await geocode(depPoint + (seg.originCity ? ` ${seg.originCity}` : ""));
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
          uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup[latitude]=${cur.lat}&pickup[longitude]=${cur.lon}&dropoff[latitude]=${d.lat}&dropoff[longitude]=${d.lon}&dropoff[formatted_address]=${encodeURIComponent(depPoint)}`;
          gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${cur.lat}%2C${cur.lon}&destination=${encodeURIComponent(depPoint)}`;
        } else {
          uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=${d?.lat}&dropoff[longitude]=${d?.lon}&dropoff[formatted_address]=${encodeURIComponent(depPoint)}`;
          gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(depPoint)}`;
        }
        if (o && d) {
          const bbox = [Math.min(o.lon, d.lon), Math.min(o.lat, d.lat), Math.max(o.lon, d.lon), Math.max(o.lat, d.lat)];
          mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox.join("%2C")}&layer=mapnik`;
        }
        r2rUrl = `https://www.rome2rio.com/s/${encodeURIComponent(originAddr)}/${encodeURIComponent(depPoint)}`;
      }
      const trafficFactor = 1.3;
      const drivingWithTrafficMin = drivingMin ? Math.round(drivingMin * trafficFactor) : undefined;
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
      }
      setStayInfo({ origin: originAddr, destination: depPoint, distanceKm, drivingMin: drivingWithTrafficMin ?? drivingMin, walkingMin, busMin: drivingWithTrafficMin ? Math.round(drivingWithTrafficMin * 1.8) : undefined, trainMin: drivingWithTrafficMin ? Math.round(drivingWithTrafficMin * 1.2) : undefined, uberUrl, gmapsUrl, r2rUrl, mapUrl, callTime, notifyAt });
    } catch {
      const gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originAddr)}&destination=${encodeURIComponent(depPoint)}`;
      const r2rUrl = `https://www.rome2rio.com/s/${encodeURIComponent(originAddr)}/${encodeURIComponent(depPoint)}`;
      const uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=${encodeURIComponent(depPoint)}`;
      setStayInfo({ origin: originAddr, destination: depPoint, gmapsUrl, r2rUrl, uberUrl });
      try { show("Erro ao calcular rota detalhada. Usando links básicos.", { variant: "info" }); } catch {}
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
      const q = (m.address || m.city || "").trim();
      const gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${cur.lat}%2C${cur.lon}&destination=${encodeURIComponent(q)}`;
      const uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup[latitude]=${cur.lat}&pickup[longitude]=${cur.lon}&dropoff[latitude]=${dest.lat}&dropoff[longitude]=${dest.lon}&dropoff[formatted_address]=${encodeURIComponent(q)}`;
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
      const query = `${rec.address || `${rec.title} ${rec.cityName}`}`.trim();
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
        try { show("Sem localização atual. Links básicos foram gerados.", { variant: "info" }); } catch {}
      } else {
        gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
        uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=${encodeURIComponent(query)}`;
        setGoInfo({ destination: query, gmapsUrl, uberUrl });
        try { showOnce("Destino não geocodificado. Usando busca genérica.", { variant: "info" }); } catch {}
      }
    } catch {
      const q = `${(item.meta as RecordItem).title} ${(item.meta as RecordItem).cityName}`.trim();
      const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
      const uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=${encodeURIComponent(q)}`;
      setGoInfo({ destination: q, gmapsUrl, uberUrl });
      try { showOnce("Erro ao calcular rota. Usando links básicos.", { variant: "info" }); } catch {}
    } finally {
      setGoLoading(false);
    }
  }

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
        const cityName = c.name || `${t("cityGeneric")} ${i + 1}`;
        const addr = c.address || t("addressNotProvided");
        if (c.checkin) list.push({ type: "stay", label: `${t("checkinLabel")} ${t("accommodationDialogTitle")}: ${cityName} • ${t("addressWord")}: ${addr}`, date: c.checkin, time: "14:00", meta: { city: cityName, address: addr, kind: "checkin" } });
        if (c.checkout) list.push({ type: "stay", label: `${t("checkoutLabel")} ${t("accommodationDialogTitle")}: ${cityName} • ${t("addressWord")}: ${addr}`, date: c.checkout, time: "11:00", meta: { city: cityName, address: addr, kind: "checkout" } });
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
      show(t("storageReloadedMsg"), { variant: "success" });
    } catch {
      show(t("storageReloadErrorMsg"), { variant: "error" });
    }
  }
  async function exportICS() {
    if (!ensureSubscriber()) return;
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

  {premiumGateOpen && (
    <Dialog open={premiumGateOpen} onOpenChange={setPremiumGateOpen} placement="center" disableBackdropClose>
      <div className="max-w-md w-full bg-white dark:bg-black rounded-xl p-5 space-y-3">
        <DialogHeader>Recurso exclusivo para assinantes</DialogHeader>
        <div className="text-sm text-zinc-700 dark:text-zinc-300">
          Para salvar, enviar por e-mail ou exportar o calendário (.ics), é necessário ter uma assinatura ativa.
          Entre na sua conta e ative a assinatura mensal para liberar estes recursos.
        </div>
        <div className="flex gap-2 mt-2">
          <Button type="button" onClick={() => { try { setPremiumGateOpen(false); router.push("/profile"); } catch {} }}>Entrar e assinar</Button>
          <Button type="button" variant="outline" onClick={() => { try { setPremiumGateOpen(false); router.push("/subscription/checkout"); } catch {} }}>Ver planos</Button>
          <Button type="button" variant="outline" onClick={() => setPremiumGateOpen(false)}>Mais tarde</Button>
        </div>
      </div>
    </Dialog>
  )}

  useEffect(() => {
    (async () => { try { await migrateFromLocalStorage(); } catch {} })();
  }, []);

  useEffect(() => {
    try {
      const flag = typeof window !== "undefined" ? localStorage.getItem("calentrip:inspiration_mode") : null;
      if (flag === "1") {
        setPremiumFlag(true);
        setGating(null);
        try { localStorage.removeItem("calentrip:inspiration_mode"); } catch {}
      }
    } catch {}
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
        tripsForList.forEach((trip) => {
          if (trip.flightNotes && trip.flightNotes.length) {
            trip.flightNotes.forEach((fn) => {
              const legLabel = fn.leg === "outbound" ? t("outboundFlight") : t("inboundFlight");
              list.push({ type: "flight", label: `${legLabel}: ${fn.origin} → ${fn.destination}`, date: fn.date, time: fn.departureTime || undefined, meta: fn });
              if (fn.arrivalTime) {
                const arrDate = fn.arrivalNextDay ? addDays(fn.date, 1) : fn.date;
                const arrLabel = fn.leg === "outbound" ? t("arrivalOutboundLabel") : t("arrivalInboundLabel");
                list.push({ type: "flight", label: `${arrLabel}: ${fn.destination}`, date: arrDate, time: fn.arrivalTime || undefined, meta: fn });
              }
            });
          } else {
            list.push({ type: "flight", label: trip.title, date: trip.date });
          }
        });
        const rawSummary = typeof window !== "undefined" ? localStorage.getItem("calentrip_trip_summary") : null;
        const summary = rawSummary ? (JSON.parse(rawSummary) as { cities?: Array<{ name?: string; checkin?: string; checkout?: string; address?: string; transportToNext?: TransportSegmentMeta }> }) : null;
        const cities = Array.isArray(summary?.cities) ? summary!.cities! : [];
        cities.forEach((c, i) => {
          const cityName = c.name || `${t("cityGeneric")} ${i + 1}`;
          const addr = c.address || t("addressNotProvided");
          if (c.checkin) list.push({ type: "stay", label: `${t("checkinLabel")} ${t("accommodationDialogTitle")}: ${cityName} • ${t("addressWord")}: ${addr}`, date: c.checkin, time: "14:00", meta: { city: cityName, address: addr, kind: "checkin" } });
          if (c.checkout) list.push({ type: "stay", label: `${t("checkoutLabel")} ${t("accommodationDialogTitle")}: ${cityName} • ${t("addressWord")}: ${addr}`, date: c.checkout, time: "11:00", meta: { city: cityName, address: addr, kind: "checkout" } });
        });
        for (let i = 0; i < cities.length - 1; i++) {
          const c = cities[i];
          const n = cities[i + 1];
          const seg = c.transportToNext;
          if (seg) {
            const label = `${t("transport")}: ${(c.name || `${t("cityGeneric")} ${i + 1}`)} → ${(n?.name || `${t("cityGeneric")} ${i + 2}`)} • ${(seg.mode || "").toUpperCase()}`;
            const date = c.checkout || n?.checkin || "";
            const time = seg.depTime || "11:00";
            list.push({ type: "transport", label, date, time, meta: { ...seg, originAddress: c.address, originCity: c.name } });
          }
        }
        const rawRecs = typeof window !== "undefined" ? localStorage.getItem("calentrip:entertainment:records") : null;
        const recs: RecordItem[] = rawRecs ? (JSON.parse(rawRecs) as RecordItem[]) : [];
        (recs || []).forEach((r) => list.push({ type: r.kind, label: r.kind === "activity" ? `${t("activityWord")}: ${r.title} (${r.cityName})` : `${t("restaurantWord")}: ${r.title} (${r.cityName})`, date: r.date, time: r.time, meta: r }));
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
  }, [status, loadedFromSaved, t]);

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
    if (!dayOpen) return t("dayActivitiesLabel");
    const loc = lang === "pt" ? "pt-BR" : lang === "es" ? "es-ES" : "en-US";
    const d = new Date(`${dayOpen}T00:00:00`);
    if (Number.isNaN(d.getTime())) return t("dayActivitiesLabel");
    const dayNum = String(d.getDate());
    const dow = new Intl.DateTimeFormat(loc, { weekday: "long" }).format(d);
    return `${t("dayActivitiesLabel")}: ${dayNum} • ${dow}`;
  }, [dayOpen, lang, t]);

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
                  <button type="button" className="text-xs" onClick={() => { try { if (Capacitor.getPlatform() === "android") { loginWithGoogle(); } else { router.push("/profile"); } } catch {} }}>{t("signInWithGoogle")}</button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        <button type="button" className="flex w-full items-center gap-3 rounded-md px-3 h-10 hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={() => { try { localStorage.setItem("calentrip:saved_calendar", JSON.stringify({ events })); localStorage.setItem("calentrip:auto_load_saved", "1"); } catch {} try { router.push("/calendar/final"); } catch {} }}>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800">
            <span className="material-symbols-outlined text-[22px] text-[#007AFF]">list_alt</span>
          </span>
          {sideOpen ? <span className="text-sm font-medium">{t("calendarList")}</span> : null}
        </button>
        <button type="button" className="flex w-full items-center gap-3 rounded-md px-3 h-10 hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={reloadFromStorage}>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800">
            <span className="material-symbols-outlined text-[22px] text-[#007AFF]">refresh</span>
          </span>
          {sideOpen ? <span className="text-sm font-medium">{t("reloadStorageButton")}</span> : null}
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-md px-3 h-10 hover:bg-zinc-50 dark:hover:bg-zinc-900"
          onClick={() => { if (!ensureSubscriber()) return; setNameInput(""); setNameDrawerOpen(true); }}
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
          <Button type="button" variant="outline" className="px-2 py-1 text-xs rounded-md" onClick={() => { try { localStorage.setItem("calentrip:saved_calendar", JSON.stringify({ events })); localStorage.setItem("calentrip:auto_load_saved", "1"); } catch {} try { router.push("/calendar/final"); } catch {} }}>
            <span className="material-symbols-outlined text-[18px] mr-1">list_alt</span>
            {t("backToListButton")}
          </Button>
          <Button type="button" className="px-2 py-1 text-xs rounded-md" onClick={exportICS}>
            <span className="material-symbols-outlined text-[18px] mr-1">download</span>
            {t("exportIcsButton")}
          </Button>
        </div>
        <h1 className="mb-1 text-2xl font-semibold text-[var(--brand)]">{t("tripCalendarTitle")}</h1>
        <div className="text-sm text-zinc-700 dark:text-zinc-300">{monthLabel}</div>
        
        <div className="mt-2 flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <span className="material-symbols-outlined text-[18px] text-[#febb02]">sticky_note_2</span>
          <span>
            {t("monthHelpText")}
          </span>
        </div>
      </div>

      <div className="container-page">
        <div className="mb-2 flex items-center gap-3 text-xs">
          <div className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-[#007AFF]"></span><span>{t("flightWord")}</span></div>
          <div className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-[#febb02]"></span><span>{t("accommodationDialogTitle")}</span></div>
          <div className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-[#34c759]"></span><span>{t("activitiesWord")}</span></div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t("sameTripLabel")}</CardTitle>
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
                                  {e.type === "flight" ? (
                                    <Button type="button" variant="outline" className="px-2 py-1 text-xs rounded-md gap-1" onClick={() => openTransportDrawer(e)}>
                                      <span className="material-symbols-outlined text-[16px]">local_taxi</span>
                                    </Button>
                                  ) : null}
                                  {e.type === "transport" ? (
                                    <Button type="button" variant="outline" className="px-2 py-1 text-xs rounded-md gap-1" onClick={() => openDepartureDrawer(e)}>
                                      <span className="material-symbols-outlined text-[16px] text-[#febb02]">map</span>
                                    </Button>
                                  ) : null}
                                  {e.type === "stay" && (e.meta as { kind?: string } | undefined)?.kind === "checkin" ? (
                                    <Button type="button" variant="outline" className="px-2 py-1 text-xs rounded-md gap-1" onClick={() => openCheckinDrawer(e)}>
                                      <span className="material-symbols-outlined text-[16px]">home</span>
                                    </Button>
                                  ) : null}
                                  {isRec ? (
                                    <>
                                      <Button type="button" variant="outline" className="px-2 py-1 text-xs rounded-md gap-1" onClick={() => { if (!ensureSubscriber()) return; setEditIdx(idxE); setEditDate(e.date); setEditTime(e.time || ""); setEditOpen(true); }}>
                                        <span className="material-symbols-outlined text-[16px]">edit</span>
                                        <span>{t("editLabel")}</span>
                                      </Button>
                                      <Button type="button" variant="outline" className="px-2 py-1 text-xs rounded-md gap-1" onClick={() => openGoDrawer(e)}>
                                        <span className="material-symbols-outlined text-[16px]">directions_car</span>
                                      </Button>
                                      {((e.meta as RecordItem)?.files || []).length ? (
                                        <Button type="button" variant="outline" className="px-2 py-1 text-xs rounded-md gap-1" onClick={() => { const m = e.meta as RecordItem; setDocTitle(m.title); setDocFiles(m.files || []); setDocOpen(true); }}>
                                          <span className="material-symbols-outlined text-[16px]">description</span>
                                          <span>Docs</span>
                                        </Button>
                                      ) : null}
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
                <Button type="button" variant="outline" className="px-2 py-1 text-xs rounded-md" onClick={() => { try { localStorage.setItem("calentrip:saved_calendar", JSON.stringify({ events })); localStorage.setItem("calentrip:auto_load_saved", "1"); } catch {} try { router.push("/calendar/final"); } catch {} }}>Calendário em lista</Button>
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
          {nameDrawerOpen ? (
            <div className="fixed inset-0 z-50">
              <div className="absolute inset-0 bg-black/40" onClick={() => setNameDrawerOpen(false)} />
              <div className="absolute bottom-0 left-0 right-0 z-10 w-full rounded-t-2xl border border-zinc-200 bg-white p-5 md:p-6 shadow-xl dark:border-zinc-800 dark:bg-black">
                <DialogHeader>Qual o nome do calendário?</DialogHeader>
                <div className="space-y-3 text-sm">
                  <div>
                    <label className="mb-1 block text-sm">Nome</label>
                    <Input value={nameInput} onChange={(e) => setNameInput(e.target.value)} />
                  </div>
                  <div className="mt-1">
                    <Button type="button" onClick={async () => {
                      try {
                        const raw = nameInput || "";
                        let name = raw.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, "").slice(0, 9).trim();
                        if (!name) {
                          try {
                            const rawTs = typeof window !== "undefined" ? (sessionStorage.getItem("calentrip:tripSearch") || localStorage.getItem("calentrip:tripSearch")) : null;
                            const ts = rawTs ? JSON.parse(rawTs) : null;
                            if (ts) {
                              const isSame = ts.mode === "same";
                              const origin = isSame ? (ts.origin || "") : (ts.outbound?.origin || "");
                              const destination = isSame ? (ts.destination || "") : (ts.outbound?.destination || "");
                              const fallback = `${String(origin)}${String(destination)}`.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, "").toUpperCase().slice(0, 9);
                              name = fallback || "CALENDAR";
                            } else {
                              name = "CALENDAR";
                            }
                          } catch { name = "CALENDAR"; }
                        }
                        try {
                          if (typeof window !== "undefined") {
                            localStorage.setItem("calentrip:saved_calendar", JSON.stringify({ events }));
                            const rawList = localStorage.getItem("calentrip:saved_calendars_list");
                            const list = rawList ? (JSON.parse(rawList) as Array<{ name: string; events: EventItem[]; savedAt?: string }>) : [];
                            const entry = { name, events, savedAt: new Date().toISOString() };
                            const idx = list.findIndex((c) => (c?.name || "") === name);
                            if (idx >= 0) list[idx] = entry; else list.push(entry);
                            localStorage.setItem("calentrip:saved_calendars_list", JSON.stringify(list));
                          }
                        } catch {}
                        try {
                          const rawTrip = typeof window !== "undefined" ? localStorage.getItem("calentrip:tripSearch") : null;
                          const ts = rawTrip ? JSON.parse(rawTrip) : null;
                          if (ts) {
                            const isSame = ts.mode === "same";
                            const origin = isSame ? ts.origin : ts.outbound?.origin;
                            const destination = isSame ? ts.destination : ts.outbound?.destination;
                            const date = isSame ? ts.departDate : ts.outbound?.date;
                            if (origin && destination && date) {
                              if (currentTripId) { await updateTrip(currentTripId, { reachedFinalCalendar: true, savedCalendarName: name }); }
                            }
                          }
                        } catch {}
                        setNameDrawerOpen(false);
                        show(`salvo com o nome ${name}`, { variant: "success", duration: 3000, sticky: false });
                        try { localStorage.setItem("calentrip:auto_load_saved", "1"); } catch {}
                        try { router.push("/calendar/final"); } catch {}
                      } catch { show(t("saveErrorMsg"), { variant: "error" }); }
                    }}>{t("saveLabel")}</Button>
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <Button type="button" className="px-2 py-1 text-xs rounded-md" onClick={() => setNameDrawerOpen(false)}>{t("close")}</Button>
                </div>
              </div>
            </div>
          ) : null}
          {locModalOpen ? (
            <div className="fixed inset-0 z-50">
              <div className="absolute inset-0 bg-black/40" onClick={() => setLocModalOpen(false)} />
              <div className="absolute bottom-0 left-0 right-0 z-10 w-full rounded-t-2xl border border-zinc-200 bg-white p-5 md:p-6 shadow-xl dark:border-zinc-800 dark:bg-black">
                <DialogHeader>Permitir localização</DialogHeader>
                <div className="text-sm text-zinc-700">
                  A localização é usada para estimar rotas, tempo e opções de transporte até sua hospedagem e aeroporto.
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => { try { localStorage.setItem("calentrip:locConsent", "skipped"); } catch {} setLocConsent("skipped"); setLocModalOpen(false); }}>Pular</Button>
                  <Button type="button" onClick={() => {
                    try {
                      if (!navigator.geolocation) {
                        try { localStorage.setItem("calentrip:locConsent", "denied"); } catch {}
                        setLocConsent("denied");
                        setLocModalOpen(false);
                        return;
                      }
                      navigator.geolocation.getCurrentPosition(
                        () => { try { localStorage.setItem("calentrip:locConsent", "granted"); } catch {} setLocConsent("granted"); setLocModalOpen(false); },
                        () => { try { localStorage.setItem("calentrip:locConsent", "denied"); } catch {} setLocConsent("denied"); setLocModalOpen(false); },
                        { enableHighAccuracy: true, timeout: 10000 }
                      );
                    } catch {
                      try { localStorage.setItem("calentrip:locConsent", "denied"); } catch {}
                      setLocConsent("denied");
                      setLocModalOpen(false);
                    }
                  }}>Permitir</Button>
                </div>
              </div>
            </div>
          ) : null}
          {drawerOpen ? (
            <div className="fixed inset-0 z-50">
              <div className="absolute inset-0 bg-black/40" onClick={() => { setDrawerOpen(false); setTransportInfo(null); }} />
              <div className="absolute bottom-0 left-0 right-0 z-10 w-full rounded-t-2xl border border-zinc-200 bg-white p-5 md:p-6 shadow-xl dark:border-zinc-800 dark:bg-black">
                <DialogHeader>Transporte até o aeroporto</DialogHeader>
                <div className="space-y-3 text-sm">
                  {loading ? (
                    <div>Calculando…</div>
                  ) : (
                    <>
                      <div>Destino: {drawerData?.originIata || "—"}</div>
                      <div>Distância (a partir da sua localização): {transportInfo?.distanceKm ? `${transportInfo.distanceKm} km` : "—"}</div>
                      {!transportInfo?.distanceKm && locConsent !== "granted" ? <div className="text-xs text-zinc-500">Ative a localização para calcular a distância.</div> : null}
                      <div>Tempo estimado (com trânsito): {transportInfo?.durationWithTrafficMin ? `${transportInfo.durationWithTrafficMin} min` : transportInfo?.durationMin ? `${transportInfo.durationMin} min` : "—"}</div>
                      <div className="mt-2">
                        <button type="button" className="underline" onClick={() => openExternal(transportInfo?.gmapsUrl, "maps")}>Veja no Google Maps</button>
                      </div>
                      <div>
                        <a className="underline flex items-center gap-1" href={transportInfo?.r2rUrl} target="_blank" rel="noopener noreferrer">
                          <span className="material-symbols-outlined text-[16px] text-[#febb02]">alt_route</span>
                          <span>Opções de rota (Rome2Rio)</span>
                        </a>
                      </div>
                      <div>
                        <button type="button" className="underline" onClick={() => openExternal(transportInfo?.uberUrl, "uber")}>Uber</button>
                      </div>
                      <div className="mt-2">Chegar no aeroporto: 3h antes do voo.</div>
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
          ) : null}
          {stayDrawerOpen ? (
            <div className="fixed inset-0 z-50">
              <div className="absolute inset-0 bg-black/40" onClick={() => { setStayDrawerOpen(false); setStayInfo(null); }} />
              <div className="absolute bottom-0 left-0 right-0 z-10 w-full rounded-t-2xl border border-zinc-200 bg-white p-5 md:p-6 shadow-xl dark:border-zinc-800 dark:bg-black">
                <DialogHeader>Como chegar ao ponto de partida</DialogHeader>
                <div className="space-y-3 text-sm">
                  {stayLoading ? (
                    <div>Calculando…</div>
                  ) : (
                    <>
                      <div>Origem: {stayInfo?.origin || "—"}</div>
                      <div>Destino: {stayInfo?.destination || "—"}</div>
                      {stayCandidates.length > 1 ? (
                        <div>
                          <div className="text-xs text-zinc-600">{stayMode === "train" ? "Escolha a estação de trem:" : stayMode === "air" ? "Escolha o aeroporto:" : "Escolha a rodoviária:"}</div>
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
                              try {
                                const key = stayMode === "train" ? "calentrip:train_station_selection" : stayMode === "air" ? "calentrip:airport_selection" : "calentrip:bus_station_selection";
                                const rawSel = typeof window !== "undefined" ? localStorage.getItem(key) : null;
                                const map = rawSel ? (JSON.parse(rawSel) as Record<string, { name: string; lat: number; lon: number }>) : {};
                                if (stayCityForSearch) map[stayCityForSearch] = { name: c.name, lat: c.lat, lon: c.lon };
                                if (typeof window !== "undefined") localStorage.setItem(key, JSON.stringify(map));
                              } catch {}
                              setStayInfo((prev) => ({ ...(prev || {}), destination: c.name, distanceKm, drivingMin: drivingWithTrafficMin ?? drivingMin, walkingMin, gmapsUrl, uberUrl }));
                            } catch {}
                          }}>
                            {stayCandidates.map((c, i) => (<option key={`opt-${i}`} value={String(i)}>{c.name}</option>))}
                          </Select>
                        </div>
                      ) : null}
                      <div>Distância: {stayInfo?.distanceKm ? `${stayInfo.distanceKm} km` : "—"}</div>
                      <div>Carro: {stayInfo?.drivingMin ? `${stayInfo.drivingMin} min` : "—"}</div>
                      <div>Ônibus: {stayInfo?.busMin ? `${stayInfo.busMin} min` : "—"}</div>
                      <div>Trem/Metro: {stayInfo?.trainMin ? `${stayInfo.trainMin} min` : "—"}</div>
                      <div>
                        <button type="button" className="underline" onClick={() => openExternal(stayInfo?.gmapsUrl, "maps")}>Abrir rota no Google Maps</button>
                      </div>
                      <div>
                        <button type="button" className="underline" onClick={() => openExternal(stayInfo?.uberUrl, "uber")}>Chamar Uber</button>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <Button type="button" className="h-10 rounded-lg font-semibold tracking-wide" onClick={() => { setStayDrawerOpen(false); setStayInfo(null); }}>{t("close")}</Button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : null}
          {arrivalDrawerOpen ? (
            <div className="fixed inset-0 z-50">
              <div className="absolute inset-0 bg-black/40" onClick={() => { setArrivalDrawerOpen(false); setArrivalInfo(null); }} />
              <div className="absolute bottom-0 left-0 right-0 z-10 w-full rounded-t-2xl border border-zinc-200 bg-white p-5 md:p-6 shadow-xl dark:border-zinc-800 dark:bg-black">
                <DialogHeader>Chegada e deslocamento até hospedagem</DialogHeader>
                <div className="space-y-3 text-sm">
                  <div>Destino: {arrivalInfo?.address || arrivalInfo?.city || "—"}</div>
                  <div>Distância (a partir da sua localização): {arrivalInfo?.distanceKm ? `${arrivalInfo.distanceKm} km` : "—"}</div>
                  {!arrivalInfo?.distanceKm && locConsent !== "granted" ? <div className="text-xs text-zinc-500">Ative a localização para calcular a distância.</div> : null}
                  <div>
                    <button type="button" className="underline" onClick={() => openExternal(arrivalInfo?.gmapsUrl, "maps")}>Abrir rota no Google Maps</button>
                  </div>
                  <div>
                    <button type="button" className="underline" onClick={() => openExternal(arrivalInfo?.uberUrl, "uber")}>Chamar Uber</button>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button type="button" className="h-10 rounded-lg font-semibold tracking-wide" onClick={() => { setArrivalDrawerOpen(false); setArrivalInfo(null); }}>{t("close")}</Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          {goDrawerOpen ? (
            <div className="fixed inset-0 z-50">
              <div className="absolute inset-0 bg-black/40" onClick={() => { setGoDrawerOpen(false); setGoInfo(null); }} />
              <div className="absolute bottom-0 left-0 right-0 z-10 w-full rounded-t-2xl border border-zinc-200 bg-white p-5 md:p-6 shadow-xl dark:border-zinc-800 dark:bg-black">
                <DialogHeader>Como ir até o destino</DialogHeader>
                <div className="space-y-3 text-sm">
                  {goLoading ? (
                    <div>Calculando…</div>
                  ) : (
                    <>
                      <div>Destino: {goInfo?.destination || "—"}</div>
                      <div>Distância (a partir da sua localização): {goInfo?.distanceKm ? `${goInfo.distanceKm} km` : "—"}</div>
                      {!goInfo?.distanceKm && locConsent !== "granted" ? <div className="text-xs text-zinc-500">Ative a localização para calcular a distância.</div> : null}
                      <div>
                        <button type="button" className="underline" onClick={() => openExternal(goInfo?.gmapsUrl, "maps")}>Abrir rota no Google Maps</button>
                      </div>
                      <div>
                        <button type="button" className="underline" onClick={() => openExternal(goInfo?.uberUrl, "uber")}>Chamar Uber</button>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <Button type="button" className="h-10 rounded-lg font-semibold tracking-wide" onClick={() => { setGoDrawerOpen(false); setGoInfo(null); }}>{t("close")}</Button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : null}
          {docOpen ? (
            <div className="fixed inset-0 z-50">
              <div className="absolute inset-0 bg-black/40" onClick={() => setDocOpen(false)} />
              <div className="absolute bottom-0 left-0 right-0 z-10 w-full rounded-t-2xl border border-zinc-200 bg-white p-5 md:p-6 shadow-xl dark:border-zinc-800 dark:bg-black">
                <DialogHeader>{docTitle || "Documentos"}</DialogHeader>
                <div className="space-y-3 text-sm max-h-[60vh] overflow-y-auto">
                  {docFiles.length ? (
                    <ul className="space-y-2">
                      {docFiles.map((f) => (
                        <li key={f.name} className="flex items-center justify-between gap-2 rounded border p-2">
                          <div>
                            <div className="font-medium">{f.name}</div>
                            <div className="text-xs text-zinc-600">{f.size ? `${Math.round(f.size / 1024)} KB` : ""}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            {f.dataUrl ? (
                              <a className="underline" href={f.dataUrl} target="_blank" rel="noopener noreferrer">Abrir</a>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-zinc-600">Nenhum documento.</div>
                  )}
                  <div className="mt-3 flex justify-end">
                    <Button type="button" className="h-10 rounded-lg font-semibold tracking-wide" onClick={() => setDocOpen(false)}>{t("close")}</Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
