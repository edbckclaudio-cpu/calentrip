"use client";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useTrip } from "@/lib/trip-context";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarInput } from "@/components/ui/calendar";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { useRouter, usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { Capacitor } from "@capacitor/core";
 
import { useToast } from "@/components/ui/toast";
import { getSavedTrips, getRefAttachments, getTripEvents, saveCalendarEvents } from "@/lib/trips-db";

export default function AccommodationSearchPage() {
  const { tripSearch } = useTrip();
  const router = useRouter();
  const { t } = useI18n();
  const { show, dismiss } = useToast();
  const pathname = usePathname();
  const initialCity = useMemo(() => {
    if (!tripSearch) return "";
    if (tripSearch.mode === "same") return "";
    return "";
  }, [tripSearch]);
  const [city, setCity] = useState(initialCity);
  const lastToastId = useRef<number | null>(null);
  const linksToastShown = useRef(false);
  const showToast = useCallback((message: string, opts?: { variant?: "info" | "success" | "error"; duration?: number; sticky?: boolean; key?: string }) => {
    if (lastToastId.current) dismiss(lastToastId.current);
    const id = show(message, opts);
    lastToastId.current = id;
    return id;
  }, [show, dismiss]);
  
  const [cityCount, setCityCount] = useState(0);
  type TransportSegment = { mode: "air" | "train" | "bus" | "car"; dep: string; arr: string; depTime: string; arrTime: string; files: Array<{ name: string; type: string; size: number; id?: string; dataUrl?: string }>; route?: { distanceKm?: number; durationMin?: number; gmapsUrl?: string; r2rUrl?: string; osmUrl?: string } | null };
  type City = { name: string; checkin: string; checkout: string; address?: string; checked?: boolean; stayFiles?: Array<{ name: string; type: string; size: number; id?: string; dataUrl?: string }>; transportToNext?: TransportSegment };
  const [cities, setCities] = useState<City[]>([]);
  const [cityDetailIdx, setCityDetailIdx] = useState<number | null>(null);
  const [citySearchIdx, setCitySearchIdx] = useState<number | null>(null);
  const [citySearchQuery, setCitySearchQuery] = useState("");
  const [citySearchResults, setCitySearchResults] = useState<Array<{ city: string; name: string; country: string }>>([]);
  const [guideIdx, setGuideIdx] = useState<number | null>(null);
  const [guideStep, setGuideStep] = useState<"name" | "checkout" | "stay" | "address" | "check" | null>(null);
  const [citySearchLoading, setCitySearchLoading] = useState(false);
  const [proceedingEntertainment, setProceedingEntertainment] = useState(false);
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const [summaryHighlight, setSummaryHighlight] = useState(false);
  const [sameCityHighlight, setSameCityHighlight] = useState(() => !((initialCity || "").trim()));
  const [sameSearchHighlight, setSameSearchHighlight] = useState(() => Boolean((initialCity || "").trim()));
  const [proceedHighlight, setProceedHighlight] = useState(false);
  const [diffCityCountHighlight, setDiffCityCountHighlight] = useState(false);
  const [diffCheckHighlight, setDiffCheckHighlight] = useState(false);
  const [noteAnim, setNoteAnim] = useState<{ maxH: number; transition: string }>({ maxH: 240, transition: "opacity 250ms ease-out, max-height 250ms ease-out" });
  const [transportDocsCount, setTransportDocsCount] = useState<Record<number, number>>({});
  const [transportIdx, setTransportIdx] = useState<number | null>(null);
  const [showStayDocsIdx, setShowStayDocsIdx] = useState<number | null>(null);
  const [showTransportDocsIdx, setShowTransportDocsIdx] = useState<number | null>(null);
  const [transportDocsList, setTransportDocsList] = useState<Record<number, Array<{ name: string; size: number }>>>({});
  
  
  const isAndroidNative = useMemo(() => {
    try { return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android"; } catch { return false; }
  }, []);
  const ceRef = useRef<HTMLDivElement | null>(null);
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [addressDraft, setAddressDraft] = useState<Record<number, string>>({});
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const mountedRef = useRef(false);
  
  const summaryComplete = useMemo(() => {
    if (!cities.length) return false;
    const allStays = cities.every((c) => Boolean(c.name && c.address && c.checked));
    const allTransports = cities.length <= 1 || cities.slice(0, -1).every((c) => Boolean(c.transportToNext));
    return allStays && allTransports;
  }, [cities]);
  useEffect(() => {
    try {
      const mobile = typeof window !== "undefined" && window.matchMedia("(max-width: 480px)").matches;
      setNoteAnim({ maxH: mobile ? 160 : 240, transition: mobile ? "opacity 200ms ease-out, max-height 200ms ease-out" : "opacity 250ms ease-out, max-height 250ms ease-out" });
    } catch {}
  }, []);
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("calentrip_trip_summary") : null;
      const js: { cities?: City[] } | null = raw ? JSON.parse(raw) : null;
      const list: City[] = js?.cities || [];
      if (list.length) {
        setCities(list);
        setCityCount(list.length);
      }
    } catch {}
  }, [pathname]);
  
  useEffect(() => {
    (async () => {
      try {
        const trips = await getSavedTrips();
        const cur = trips.sort((a, b) => Number(b.savedAt || 0) - Number(a.savedAt || 0))[0];
        const map: Record<number, number> = {};
        for (let i = 0; i < cities.length - 1; i++) {
          const seg = cities[i]?.transportToNext;
          const localCount = Array.isArray(seg?.files) ? seg!.files!.length : 0;
          let dbCount = 0;
          if (cur) {
            const ref = `${cities[i]?.name || ""}->${cities[i+1]?.name || ""}`;
            const more = await getRefAttachments(cur.id, "transport", ref);
            dbCount = more.length;
          }
          map[i] = localCount + dbCount;
        }
        setTransportDocsCount(map);
        try {
          const raw = typeof window !== "undefined" ? localStorage.getItem("calentrip_trip_summary") : null;
          const js: { cities?: City[] } | null = raw ? JSON.parse(raw) : null;
          const list: City[] = js?.cities || [];
          if (list.length && cities.length === 0) {
            setCities(list);
            setCityCount(list.length);
          } else if (list.length && list.length === cities.length) {
            setCities((prev) => prev.map((x, i) => ({ ...x, transportToNext: list[i]?.transportToNext ?? x.transportToNext })));
          }
        } catch {}
      } catch {}
    })();
  }, [cities, t]);
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const mq = window.matchMedia("(max-width: 480px)");
      const handler = (e: MediaQueryListEvent) => {
        setNoteAnim({ maxH: e.matches ? 160 : 240, transition: e.matches ? "opacity 200ms ease-out, max-height 200ms ease-out" : "opacity 250ms ease-out, max-height 250ms ease-out" });
      };
      mq.addEventListener("change", handler);
      return () => {
        try { mq.removeEventListener("change", handler); } catch {}
      };
    } catch {}
  }, []);

  useEffect(() => {
    if (!tripSearch) return;
    if (tripSearch.mode === "different") {
      setDiffCityCountHighlight(true);
    }
  }, [tripSearch]);

  useEffect(() => {
    if (cities.length > 0) {
      setDiffCityCountHighlight(false);
      setDiffCheckHighlight(false);
    }
  }, [cities.length]);
        
        

  

  

  const arrivalDate = useMemo(() => {
    if (!tripSearch) return "";
    return tripSearch.mode === "same" ? (tripSearch.departDate ?? "") : (tripSearch.outbound.date ?? "");
  }, [tripSearch]);

  const returnDate = useMemo(() => {
    if (!tripSearch) return "";
    return tripSearch.mode === "same" ? (tripSearch.returnDate ?? "") : (tripSearch.inbound.date ?? "");
  }, [tripSearch]);

  

  

  function addDaysISO(d: string, days: number): string {
    if (!d) return "";
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return d;
    dt.setDate(dt.getDate() + days);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
  }
  const dates = (() => {
    if (!tripSearch) return { checkin: "", checkout: "" };
    const checkinBase = tripSearch.mode === "same" ? (tripSearch.departDate ?? "") : (tripSearch.outbound.date ?? "");
    const checkout = tripSearch.mode === "same" ? (tripSearch.returnDate ?? "") : (tripSearch.inbound.date ?? "");
    let bump = 0;
    try {
      const flag = localStorage.getItem("calentrip:arrivalNextDay_outbound") === "true";
      if (flag) bump = 1;
    } catch {}
    const checkin = bump ? addDaysISO(checkinBase, bump) : checkinBase;
    return { checkin, checkout };
  })();
  

  function handleSearch() {
    try { console.log("[ACCOM_FLOW] handleSearch start", { city, initialCity, dates }); } catch {}
    const chosen = city || initialCity;
    if (!chosen) { showToast(t("defineCityError")); return; }
    try {
      setCityDetailIdx(0);
      setGuideIdx(0);
      setGuideStep("address");
      setSameSearchHighlight(false);
      showToast(t("selectAccommodation"));
      console.log("[ACCOM_FLOW] dialog open cityDetailIdx=0");
    } catch {}
    setCities([{ name: chosen, checkin: dates.checkin || "", checkout: dates.checkout || "" }]);
    try { console.log("[ACCOM_FLOW] handleSearch end"); } catch {}
  }
  


  function onConfirmCityCount() {
    setDiffCityCountHighlight(false);
    setDiffCheckHighlight(false);
    if (!tripSearch || tripSearch.mode !== "different") return;
    const n = Math.max(0, Math.min(8, Number(cityCount) || 0));
    if (n === 0) { setCities([]); return; }
    const arr: Array<{ name: string; checkin: string; checkout: string; address?: string; checked?: boolean }> = [];
    for (let i = 0; i < n; i++) {
      const baseCi = i === 0 ? (arrivalDate || "") : (arr[i-1]?.checkout || "");
      let ci = baseCi;
      try {
        if (i === 0 && localStorage.getItem("calentrip:arrivalNextDay_outbound") === "true") {
          ci = addDaysISO(baseCi, 1);
        }
      } catch {}
      const co = i === n - 1 ? (returnDate || "") : "";
      arr.push({ name: "", checkin: ci, checkout: co });
    }
    setCities(arr);
    showToast(t("citiesConfigured"));
    setGuideIdx(0);
    setGuideStep("name");
    setDiffCityCountHighlight(false);
    setDiffCheckHighlight(false);
    showToast(t("fillFirstCityNameScrollHint"), { duration: 6000 });
  }

  async function searchCities(q: string) {
    setCitySearchQuery(q);
    if (!q) { setCitySearchResults([]); return; }
    setCitySearchLoading(true);
    try {
      const { searchAirportsAsync } = await import("@/lib/airports");
      const nq = q.trim();
      const alt = [nq];
      const low = nq.toLowerCase();
      if (low.startsWith("rom")) alt.push("roma", "rome");
      const baseLists = await Promise.all(alt.map((x) => searchAirportsAsync(x)));
      const base = ([] as typeof baseLists[number]).concat(...baseLists);
      const seen = new Set<string>();
      const preferredCountries: string[] = [];
      const itemsBase = base
        .map((a) => ({ city: a.city, name: `${a.city}, ${a.country} (${a.name})`, country: a.country }))
        .filter((x) => { const k = `${(x.city || "").toLowerCase()}|${(x.country || "").toLowerCase()}`; if (seen.has(k)) return false; seen.add(k); return Boolean(x.city); })
        .sort((a, b) => {
          const sa = preferredCountries.includes(a.country) ? -1 : 0;
          const sb = preferredCountries.includes(b.country) ? -1 : 0;
          return sa - sb;
        });
      setCitySearchResults(itemsBase);
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(nq)}&format=json&limit=30&addressdetails=1`;
      const res = await fetch(url, { headers: { "Accept": "application/json" } });
      const js = (await res.json()) as Array<{ display_name: string; class: string; type: string; address?: { city?: string; town?: string; village?: string; state?: string; country?: string } }>;
      const more = js
        .filter((x) => x.class === "place" && (x.type === "city" || x.type === "town" || x.type === "village"))
        .map((x) => {
          const city = x.address?.city || x.address?.town || x.address?.village || x.display_name.split(",")[0];
          const country = x.address?.country || x.display_name.split(",").slice(-1)[0];
          return { city, name: x.display_name, country };
        })
        .filter((x) => { const k = `${(x.city || "").toLowerCase()}|${(x.country || "").toLowerCase()}`; if (!x.city) return false; if (seen.has(k)) return false; seen.add(k); return true; })
        .sort((a, b) => {
          const sa = preferredCountries.includes(a.country) ? -1 : 0;
          const sb = preferredCountries.includes(b.country) ? -1 : 0;
          return sa - sb;
        });
      setCitySearchResults((prev) => [...prev, ...more]);
    } catch {
      // keep existing results
    } finally {
      setCitySearchLoading(false);
    }
  }

  useEffect(() => {
    if (guideIdx === null) return;
    if (guideStep === "checkout") {
      showToast(t("chooseCheckoutDateHint"), { duration: 5000 });
    } else if (guideStep === "stay") {
      showToast(t("clickBuyAccommodationHint"), { duration: 5000 });
    } else if (guideStep === "name") {
      showToast(t("typeCityNameScrollHint"), { duration: 6000 });
    }
  }, [guideIdx, guideStep, showToast, t]);

  useEffect(() => {
    if (cityDetailIdx === null) return;
    if (!linksToastShown.current) {
      showToast(t("useLinksSaveDocsHint"), { key: "useLinksSaveDocsHint" });
      linksToastShown.current = true;
    }
  }, [cityDetailIdx, showToast, t]);

  useEffect(() => {
    if (guideStep) {
      setDiffCityCountHighlight(false);
      setDiffCheckHighlight(false);
    }
  }, [guideStep]);

  function onPickCity(idx: number, c: string) {
    setCities((prev) => prev.map((x, i) => (i === idx ? { ...x, name: c } : x)));
    setCitySearchIdx(null);
    if (idx === cities.length - 1) {
      setGuideStep("stay");
      showToast(t("lastCitySelectedGoToPurchase"), { duration: 7000 });
    }
  }

  function onCityCheck(idx: number) {
    const cur = cities[idx];
    if (!cur?.address) { showToast(t("provideStayAddressError"), { variant: "error" }); return; }
    setCities((prev) => prev.map((x, i) => (i === idx ? { ...x, checked: true } : x)));
    if (idx < cities.length - 1) {
      showToast(t("fillNextCityAndProceedHint"), { duration: 7000 });
    }
    const allChecked = cities.every((c, i) => (i === idx ? true : c.checked));
    if (tripSearch?.mode === "same" && allChecked) {
      setProceedHighlight(true);
    }
    if (allChecked && cities.length > 1) {
      showToast(t("chooseTransportFirstSecondCity"), { duration: 6000 });
      try { router.push(`/transport/plan?i=0`); } catch {}
    }
    const next = idx + 1;
    if (next < cities.length) {
      setGuideIdx(next);
      setGuideStep("name");
    } else {
      setGuideIdx(null);
      setGuideStep(null);
    }
  }

  

  function proceedToEntertainment() {
    if (proceedingEntertainment) return;
    setProceedingEntertainment(true);
    try {
      const summary = { cities: cities.map((c) => ({
        name: c.name,
        checkin: c.checkin,
        checkout: c.checkout,
        address: c.address,
        transportToNext: c.transportToNext ? {
          mode: c.transportToNext.mode,
          dep: c.transportToNext.dep,
          arr: c.transportToNext.arr,
          depTime: c.transportToNext.depTime,
          arrTime: c.transportToNext.arrTime,
        } : undefined,
      })) };
      if (typeof window !== "undefined") localStorage.setItem("calentrip_trip_summary", JSON.stringify(summary));
    } catch {}
    try { router.push("/entertainment/reservations"); } catch {}
    try {
      setTimeout(() => {
        try {
          if (typeof window !== "undefined") {
            const same = (window.location.pathname || "").includes("/entertainment/reservations");
            if (!same) window.location.href = "/entertainment/reservations";
          }
        } catch {}
      }, 600);
    } catch {}
    (async () => {
      try {
        const modDb = await import("@/lib/trips-db");
        const trips = await modDb.getSavedTrips();
        const cur = trips.sort((a, b) => Number(b.savedAt || 0) - Number(a.savedAt || 0))[0];
        if (cur) {
          for (const c of cities) {
            const files = (c.stayFiles || []).filter((f) => f.id).map((f) => ({ name: f.name, type: f.type, size: f.size, id: f.id! }));
            if (files.length) {
              const ref = `${c.name || ""}|${c.address || ""}`;
              await modDb.saveRefAttachments(cur.id, "stay", ref, files);
            }
          }
          for (let i = 0; i < cities.length - 1; i++) {
            const seg = cities[i]?.transportToNext;
            if (seg && Array.isArray(seg.files) && seg.files.length) {
              const files = (seg.files || []).filter((f) => ("id" in f) && Boolean((f as { id?: string }).id)).map((f) => ({ name: f.name, type: f.type, size: f.size, id: (f as { id?: string }).id || "" }));
              const ref = `${cities[i]?.name || ""}->${cities[i+1]?.name || ""}`;
              await modDb.saveRefAttachments(cur.id, "transport", ref, files);
            }
          }
        }
      } catch {}
    })();
    try { setTimeout(() => setProceedingEntertainment(false), 2500); } catch {}
  }

  useEffect(() => {
    if (proceedingEntertainment) {
      try {
        const ok = (pathname || "").includes("/entertainment/reservations");
        if (ok) setProceedingEntertainment(false);
      } catch {}
    }
  }, [pathname, proceedingEntertainment]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  
  useEffect(() => {
    try {
      if (!cities.length) return;
      const payload = { cities };
      if (typeof window !== "undefined") localStorage.setItem("calentrip_trip_summary", JSON.stringify(payload));
    } catch {}
    if (!mountedRef.current || isEditingAddress) return;
    try { if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current); } catch {}
    saveDebounceRef.current = (typeof window !== "undefined" ? window.setTimeout : setTimeout)(async () => {
      try { console.log("[ACCOM_DB] effect start", { citiesCount: cities.length }); } catch {}
      try {
        if (!cities.length) return;
        const trips = await getSavedTrips();
        let cur = trips.sort((a, b) => Number(b.savedAt || 0) - Number(a.savedAt || 0))[0] || null;
        try {
          const raw = typeof window !== "undefined" ? localStorage.getItem("calentrip:tripSearch") : null;
          const ts = raw ? JSON.parse(raw) as { mode: "same" | "different"; origin?: string; destination?: string; departDate?: string; passengers?: { adults?: number; children?: number; infants?: number }; outbound?: { origin?: string; destination?: string; date?: string }; } : null;
          if (ts) {
            const isSame = ts.mode === "same";
            const origin = isSame ? ts.origin : ts.outbound?.origin;
            const destination = isSame ? ts.destination : ts.outbound?.destination;
            const date = isSame ? ts.departDate : ts.outbound?.date;
            const pax = (() => { const p = ts.passengers || {}; return Number(p.adults || 0) + Number(p.children || 0) + Number(p.infants || 0); })();
            const title = origin && destination ? `${origin} → ${destination}` : "";
            const found = trips.find((t) => t.title === title && t.date === date && Number(t.passengers || 0) === pax) || null;
            if (found) cur = found;
          }
        } catch {}
        if (!cur) return;
        const ready = cities.some((c) => Boolean(c.address) || Boolean(c.checked) || Boolean(c.transportToNext));
        if (!ready) return;
        const existing = await getTripEvents(cur.id);
        const keep = (existing || []).filter((e) => e.type !== "stay" && e.type !== "transport");
        const next = [...keep];
        for (let i = 0; i < cities.length; i++) {
          const c = cities[i];
          const cityName = c.name || `Cidade ${i + 1}`;
          const addr = c.address || "(endereço não informado)";
          if (c.checkin) {
            let ciTime = i === 0 ? "23:59" : "17:00";
            try { if (i === 0 && typeof window !== "undefined" && localStorage.getItem("calentrip:arrivalNextDay_outbound") === "true") ciTime = "14:00"; } catch {}
            next.push({ name: "Check-in hospedagem", label: `Check-in hospedagem: ${cityName} • Endereço: ${addr}`, date: c.checkin, time: ciTime, type: "stay" });
          }
          if (c.checkout) {
            next.push({ name: "Checkout hospedagem", label: `Checkout hospedagem: ${cityName} • Endereço: ${addr}`, date: c.checkout, time: "08:00", type: "stay" });
          }
        }
        for (let i = 0; i < cities.length - 1; i++) {
          const c = cities[i];
          const n = cities[i + 1];
          const seg = c.transportToNext;
          if (seg) {
            const label = `${t("transport")}: ${(c.name || `${t("cityGeneric")} ${i + 1}`)} → ${(n?.name || `${t("cityGeneric")} ${i + 2}`)} • ${(seg.mode || "").toUpperCase()}`;
            const date = c.checkout || n?.checkin || "";
            const time = seg.depTime || "11:00";
            next.push({ name: t("transport"), label, date, time, type: "transport" });
          }
        }
        const seen = new Set<string>();
        const merged = next.filter((e) => {
          const key = `${e.type}|${e.label}|${(e.date || "").trim()}|${(e.time || "").trim()}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        try { console.log("[ACCOM_DB] saving calendar events", { eventsCount: merged.length }); } catch {}
        await saveCalendarEvents(cur.id, merged);
        try {
          const payload = { name: cur.savedCalendarName || "", events: merged };
          if (typeof window !== "undefined") localStorage.setItem("calentrip:saved_calendar", JSON.stringify(payload));
        } catch {}
      } catch {}
      try { console.log("[ACCOM_DB] effect end"); } catch {}
    }, 700);
  }, [cities, t, isEditingAddress]);

  useEffect(() => {
    try {
      const flag = typeof window !== "undefined" ? localStorage.getItem("calentrip:show_summary") : null;
      if (flag === "1") {
        setSummaryHighlight(true);
        setTimeout(() => setSummaryHighlight(false), 4000);
        if (summaryRef.current) {
          try { summaryRef.current.scrollIntoView({ behavior: "smooth", block: "center" }); } catch {}
        }
        if (typeof window !== "undefined") localStorage.removeItem("calentrip:show_summary");
      }
    } catch {}
  }, []);

  

  if (!tripSearch) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="mb-3">{t("noTrips")}</p>
          <Button onClick={() => router.push("/flights/search")}>{t("searchFlights")}</Button>
        </div>
      </div>
    );
  }

  const isSame = tripSearch.mode === "same";

  


  return (
    <div className="min-h-screen px-4 py-6 space-y-6">
      <div className="container-page grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base">hotel</span>
              <span>{t("advanceToStay")}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isSame ? (
              <div className="space-y-3 max-w-md">
                {(() => {
                  try {
                    const on = localStorage.getItem("calentrip:arrivalNextDay_outbound") === "true";
                    return (
                      <div
                        className="mt-2 flex items-start gap-2 rounded-md border border-amber-500 bg-amber-50 p-2 text-xs text-amber-900"
                        style={{ maxHeight: on ? noteAnim.maxH : 0, opacity: on ? 1 : 0, transition: noteAnim.transition, overflow: "hidden" }}
                        aria-hidden={!on}
                      >
                        <span className="material-symbols-outlined text-amber-700">warning</span>
                        <span>{t("stayCheckinNextDayNote")}</span>
                      </div>
                    );
                  } catch {
                    return null;
                  }
                })()}
                <label className="mb-1 block text-sm">Cidade para a hospedagem</label>
                <Input
                  placeholder={t("stayCityInputPlaceholder")}
                  value={city}
                  className={sameCityHighlight ? "ring-4 ring-amber-500 animate-pulse" : undefined}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCity(v);
                    if (tripSearch?.mode === "same") {
                      if ((v || "").trim()) {
                        setSameCityHighlight(false);
                        setSameSearchHighlight(true);
                      } else {
                        setSameCityHighlight(true);
                        setSameSearchHighlight(false);
                      }
                    }
                  }}
                />
                <div>
                  <Button type="button" className={(sameSearchHighlight ? "ring-4 ring-amber-500 animate-pulse " : "") + "w-full sm:w-auto"} onClick={() => {
                    try { console.log("[ACCOM_FLOW] click searchAccommodationButton", { city, initialCity, dates }); } catch {}
                    setTimeout(() => { try { handleSearch(); } catch {} }, 0);
                  }}>{t("searchAccommodationButton")}</Button>
                </div>
                
              </div>
            ) : (
              <div className="space-y-3 max-w-md">
                <div className="rounded-lg border p-3 text-sm">
                  <div><span className="font-semibold">Data de chegada</span>: {arrivalDate || "—"}</div>
                  <div><span className="font-semibold">Data de retorno</span>: {returnDate || "—"}</div>
                </div>
                <label className="mb-1 block text-sm">Quantidade de cidades</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={8}
                    value={cityCount || ""}
                    className={diffCityCountHighlight ? "ring-4 ring-amber-500" : undefined}
                    onChange={(e) => {
                      const v = Number(e.target.value) || 0;
                      setCityCount(v);
                      if (tripSearch?.mode === "different") {
                        if (v > 0) { setDiffCityCountHighlight(false); setDiffCheckHighlight(true); }
                        else { setDiffCityCountHighlight(true); setDiffCheckHighlight(false); }
                      }
                    }}
                  />
                  <Button
                    type="button"
                    role="button"
                    className={diffCheckHighlight ? "ring-4 ring-amber-500 animate-pulse" : undefined}
                    style={{ touchAction: "manipulation" }}
                    onClick={() => { setDiffCityCountHighlight(false); setDiffCheckHighlight(false); onConfirmCityCount(); }}
                    onTouchStart={() => { setDiffCityCountHighlight(false); setDiffCheckHighlight(false); onConfirmCityCount(); }}
                    onTouchEnd={() => { setDiffCityCountHighlight(false); setDiffCheckHighlight(false); onConfirmCityCount(); }}
                    onPointerUp={() => { setDiffCityCountHighlight(false); setDiffCheckHighlight(false); onConfirmCityCount(); }}
                  >
                    Check
                  </Button>
                </div>
                {cities.length > 0 && (
                  <div className="space-y-3">
                    {cities.map((c, idx) => (
                      <div key={idx} className="rounded-lg border p-3">
                        <div className="mb-2 text-sm font-semibold">Cidade {idx + 1}</div>
                        {(() => { return null; })()}
                        {null}
                        {(() => {
                          const enabled = idx === 0 || Boolean(cities[idx - 1]?.checked && cities[idx - 1]?.address);
                          return (
                            <>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <div className="sm:col-span-1">
                            <label className="mb-1 block text-sm">Nome da cidade</label>
                            <div className="flex items-center gap-2">
                              <Input
                                placeholder={t("stayCityInputPlaceholder")}
                                value={c.name}
                                disabled={!enabled}
                                className={guideIdx === idx && guideStep === "name" ? "ring-4 ring-amber-500 animate-pulse" : undefined}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setCities((prev) => prev.map((x, i) => (i === idx ? { ...x, name: v } : x)));
                                  if (enabled && v.trim().length >= 3) {
                                    setCitySearchIdx(idx);
                                    searchCities(v.trim());
                                  }
                                  if (guideIdx === idx && v.trim()) setGuideStep(idx === cities.length - 1 ? "stay" : "checkout");
                                }}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="mb-1 block text-sm">Check-in</label>
                            <CalendarInput
                              value={c.checkin}
                              min={arrivalDate || undefined}
                              max={returnDate || undefined}
                              disabled={!enabled}
                              onFocus={() => { if (!c.checkin && arrivalDate) setCities((prev) => prev.map((x, i) => (i === idx ? { ...x, checkin: arrivalDate } : x))); }}
                              onChange={(e) => setCities((prev) => prev.map((x, i) => (i === idx ? { ...x, checkin: e.target.value } : x)))}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-sm">Check-out</label>
                              <CalendarInput
                                value={c.checkout}
                                min={c.checkin || arrivalDate || undefined}
                                max={returnDate || undefined}
                                disabled={!enabled || idx === cities.length - 1}
                                className={guideIdx === idx && guideStep === "checkout" ? "ring-4 ring-amber-500 animate-pulse" : undefined}
                                onFocus={() => { const def = c.checkin || arrivalDate; if (!c.checkout && def) setCities((prev) => prev.map((x, i) => (i === idx ? { ...x, checkout: def } : x))); }}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setCities((prev) => prev.map((x, i) => (i === idx ? { ...x, checkout: v } : x)));
                                  const nextIdx = idx + 1;
                                  if (nextIdx < cities.length) setCities((prev) => prev.map((x, i) => (i === nextIdx ? { ...x, checkin: v || x.checkin } : x)));
                                  if (guideIdx === idx && v) setGuideStep("stay");
                                }}
                              />
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <Button type="button" disabled={!enabled || !(c.name && (idx === cities.length - 1 || c.checkout))} className={guideIdx === idx && guideStep === "stay" ? "ring-4 ring-amber-500 animate-pulse" : undefined} onClick={() => { showToast("Escolha a acomodação"); setCityDetailIdx(idx); setGuideStep("address"); }}>
                            Comprar hospedagem
                          </Button>
                          {idx >= 1 ? (
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={!(
                                (cities[idx - 1]?.name && cities[idx]?.name && cities[idx - 1]?.checkout && cities[idx]?.checkin && cities[idx - 1]?.checked && cities[idx]?.checked)
                              )}
                              onClick={() => {
                                try { setTransportIdx(idx - 1); } catch {}
                              }}
                            >
                              Transporte
                            </Button>
                          ) : null}
                        </div>
                            </>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                )}
                <Dialog open={citySearchIdx !== null} onOpenChange={() => setCitySearchIdx(null)}>
                  <div className="fixed inset-0 z-50 w-full md:inset-y-0 md:right-0 md:max-w-md rounded-none md:rounded-l-lg bg-white shadow-lg dark:bg-black border border-zinc-200 dark:border-zinc-800 flex flex-col h-screen">
                    <div className="p-4">
                      <DialogHeader>{t("searchCityTitle")}</DialogHeader>
                      <Input placeholder={t("typeCity")} value={citySearchQuery} onChange={(e) => searchCities(e.target.value)} />
                    </div>
                    <div className="px-4 pb-4 flex-1 overflow-y-auto">
                      {citySearchLoading ? (
                        <div className="text-sm text-zinc-600">{t("loading")}</div>
                      ) : citySearchResults.length === 0 ? (
                        <div className="text-sm text-zinc-600">{t("noSuggestionsFound")}</div>
                      ) : (
                        <ul className="max-h-64 overflow-auto divide-y">
                          {citySearchResults.map((r, i) => (
                            <li key={`${r.city}-${i}`}>
                              <button type="button" className="w-full px-3 py-2 text-left hover:bg-zinc-50" onClick={() => onPickCity(Number(citySearchIdx), r.city)}>
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="text-sm font-medium">{r.city}</div>
                                    <div className="text-xs text-zinc-600">{r.country}</div>
                                  </div>
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="sticky bottom-0 p-4 border-t bg-white dark:bg-black">
                      <Button type="button" variant="secondary" disabled={!citySearchQuery.trim()} onClick={() => { const v = citySearchQuery.trim(); if (!v) return; onPickCity(Number(citySearchIdx), v); showToast(t("cityDefinedManually")); }}>{t("useTypedCityButton")}</Button>
                    </div>
                  </div>
                </Dialog>
                {transportIdx !== null ? (
                  <Dialog open onOpenChange={() => setTransportIdx(null)}>
                    <div className="fixed inset-0 z-50 w-full md:inset-y-0 md:right-0 md:max-w-md rounded-none md:rounded-l-lg bg-white shadow-lg dark:bg-black border border-zinc-200 dark:border-zinc-800 flex flex-col h-screen">
                      <div className="p-4">
                        <DialogHeader>{t("transportBetween")} {t("and")}</DialogHeader>
                      </div>
                      <div className="px-4 pb-4 flex-1 overflow-y-auto text-sm">
                        {(() => {
                          const i = transportIdx!;
                          const from = cities[i]?.name || `Cidade ${i + 1}`;
                          const to = cities[i + 1]?.name || `Cidade ${i + 2}`;
                          const date = cities[i]?.checkout || "";
                          const gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(from)}&destination=${encodeURIComponent(to)}`;
                          const p = new URLSearchParams({ lang: "pt-BR", currency: "BRL" });
                          if (date) p.set("date", date);
                          const r2rBase = `https://www.rome2rio.com/s/${encodeURIComponent(from)}/${encodeURIComponent(to)}`;
                          const r2rUrl = p.toString() ? `${r2rBase}?${p.toString()}` : r2rBase;
                          const seg = cities[i]?.transportToNext || { mode: "air", dep: "", arr: "", depTime: "", arrTime: "", files: [] };
                          const setSeg = (partial: Partial<TransportSegment>) => {
                            setCities((prev) => prev.map((x, idx2) => (idx2 === i ? { ...x, transportToNext: { ...(x.transportToNext || { mode: "air", dep: "", arr: "", depTime: "", arrTime: "", files: [] }), ...partial } } : x)));
                          };
                          return (
                            <div className="space-y-3">
                              <div className="font-medium">{from} → {to}</div>
                              <div className="text-zinc-600">Data de busca: {date || "—"}</div>
                              <div className="rounded-md border p-2 text-xs">Clique no link abaixo e escolha e compre como você vai da cidade {i + 1} para a cidade {i + 2}.</div>
                              <ul className="space-y-1">
                                <li>
                                  <a className="text-[#febb02] underline decoration-2 underline-offset-2 font-semibold hover:text-amber-700 flex items-center gap-1" href={r2rUrl} target="_blank" rel="noopener noreferrer">
                                    <span className="material-symbols-outlined text-[16px]">alt_route</span>
                                    <span>Opções de rota (Rome2Rio)</span>
                                  </a>
                                </li>
                                <li><a className="text-[#febb02] underline decoration-2 underline-offset-2 font-semibold hover:text-amber-700" href={gmapsUrl} target="_blank" rel="noopener noreferrer">Google Maps</a></li>
                              </ul>
                              <div className="mt-2 rounded-lg border p-3">
                                <div className="font-semibold mb-2">Dados do seu transporte comprado</div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div>
                                    <label className="mb-1 block text-sm">Modal</label>
                                    <select className="w-full border rounded-md h-9 px-2" value={seg.mode} onChange={(e) => setSeg({ mode: e.target.value as TransportSegment["mode"] })}>
                                      <option value="air">Avião</option>
                                      <option value="train">Trem</option>
                                      <option value="bus">Ônibus</option>
                                      <option value="car">Carro</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="mb-1 block text-sm">Hora de partida</label>
                                    <Input type="tel" inputMode="numeric" pattern="[0-9]*" defaultValue={seg.depTime || ""} onChange={(e) => setSeg({ depTime: e.target.value })} disabled={seg.mode === "car"} />
                                  </div>
                                  <div>
                                    <label className="mb-1 block text-sm">Hora de chegada</label>
                                    <Input type="tel" inputMode="numeric" pattern="[0-9]*" defaultValue={seg.arrTime || ""} onChange={(e) => setSeg({ arrTime: e.target.value })} disabled={seg.mode === "car"} />
                                  </div>
                                </div>
                                {seg.mode === "air" ? (
                                  <>
                                    <div className="mt-3">
                                      <label className="mb-1 block text-sm">{t("origin")}</label>
                                      <Input defaultValue={seg.dep || ""} onChange={(e) => setSeg({ dep: e.target.value })} placeholder="Digite a origem" />
                                    </div>
                                    <div className="mt-3">
                                      <label className="mb-1 block text-sm">{t("destination")}</label>
                                      <Input defaultValue={seg.arr || ""} onChange={(e) => setSeg({ arr: e.target.value })} placeholder="Digite o destino" />
                                    </div>
                                  </>
                                ) : seg.mode === "train" ? (
                                  <>
                                    <div className="mt-3">
                                      <label className="mb-1 block text-sm">Estação de trem de origem</label>
                                      <Input defaultValue={seg.dep || ""} onChange={(e) => setSeg({ dep: e.target.value })} placeholder="Digite a origem" />
                                    </div>
                                    <div className="mt-3">
                                      <label className="mb-1 block text-sm">Estação de trem de destino</label>
                                      <Input defaultValue={seg.arr || ""} onChange={(e) => setSeg({ arr: e.target.value })} placeholder="Digite o destino" />
                                    </div>
                                  </>
                                ) : seg.mode === "bus" ? (
                                  <>
                                    <div className="mt-3">
                                      <label className="mb-1 block text-sm">Rodoviária de origem</label>
                                      <Input defaultValue={seg.dep || ""} onChange={(e) => setSeg({ dep: e.target.value })} placeholder="Digite a origem" />
                                    </div>
                                    <div className="mt-3">
                                      <label className="mb-1 block text-sm">Rodoviária de destino</label>
                                      <Input defaultValue={seg.arr || ""} onChange={(e) => setSeg({ arr: e.target.value })} placeholder="Digite o destino" />
                                    </div>
                                  </>
                                ) : null}
                                <div className="mt-3">
                                  <Button type="button" onClick={async () => {
                                    const input = document.createElement("input");
                                    input.type = "file";
                                    input.accept = "image/*,application/pdf";
                                    input.multiple = true;
                                    input.onchange = async (ev) => {
                                      const files = Array.from((ev.target as HTMLInputElement).files || []);
                                      const mod = await import("@/lib/attachments-store");
                                      const list = await Promise.all(files.map(async (f) => {
                                        const saved = await mod.saveFromFile(f);
                                        return { name: saved.name, type: saved.type, size: saved.size, id: saved.id };
                                      }));
                                      setSeg({ files: [...(seg.files || []), ...list] });
                                    };
                                    input.click();
                                  }} disabled={seg.mode === "car"} className="px-2 py-1 text-xs rounded-md gap-1">
                                    <span className="material-symbols-outlined text-[16px]">attach_file</span>
                                    <span>{t("attachProofButton")}</span>
                                  </Button>
                                </div>
                              </div>
                              <div className="mt-3 flex justify-end">
                                <Button type="button" onClick={() => {
                                  const params: Partial<TransportSegment> = { mode: seg.mode, dep: seg.dep, arr: seg.arr, depTime: seg.depTime, arrTime: seg.arrTime };
                                  setSeg(params as TransportSegment);
                                  try {
                                    const payload = { cities };
                                    if (typeof window !== "undefined") localStorage.setItem("calentrip_trip_summary", JSON.stringify(payload));
                                  } catch {}
                                  const hasNext = i + 1 < cities.length - 1;
                                  if (hasNext) {
                                    showToast("Abrindo o transporte da próxima viagem para comprar e preencher.", { duration: 7000 });
                                    setTransportIdx(i + 1);
                                  } else {
                                    showToast("Indo para o resumo. Verifique as informações.", { duration: 3000 });
                                    setTransportIdx(null);
                                    setSummaryHighlight(true);
                                    try { if (typeof window !== "undefined") localStorage.setItem("calentrip:show_summary", "1"); } catch {}
                                    try {
                                      setTimeout(() => {
                                        try {
                                          if (summaryRef.current) summaryRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
                                        } catch {}
                                      }, 300);
                                    } catch {}
                                  }
                                }}>Salvar transporte</Button>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </Dialog>
                ) : null}
                
              </div>
            )}
          </CardContent>
        </Card>
        {cityDetailIdx !== null && (
          <Dialog open onOpenChange={() => setCityDetailIdx(null)}>
            <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md rounded-l-lg bg-white p-4 shadow-lg dark:bg-black border border-zinc-200 dark:border-zinc-800">
              <DialogHeader>{t("accommodationDialogTitle")}</DialogHeader>
              <div className="p-1 space-y-2 text-sm">
                <div className="font-semibold">{cities[cityDetailIdx!]?.name || `${t("cityGeneric")} ${(cityDetailIdx ?? 0) + 1}`}</div>
                <div>{t("checkinLabel")}: {cities[cityDetailIdx!]?.checkin || "—"}</div>
                <div>{t("checkoutLabel")}: {cities[cityDetailIdx!]?.checkout || "—"}</div>
                <div className="mt-2 font-bold text-[#febb02]">{t("accommodationLinksTitle")}</div>
                <ul className="space-y-1">
                  {(() => {
                    const c = encodeURIComponent(cities[cityDetailIdx!]?.name || "");
                    const ci = cities[cityDetailIdx!]?.checkin || "";
                    const co = cities[cityDetailIdx!]?.checkout || "";
                    return [
                      { name: "Booking", href: `https://www.booking.com/searchresults.html?ss=${c}&checkin=${ci}&checkout=${co}` },
                      { name: "Airbnb", href: `https://www.airbnb.com/s/${c}/homes?checkin=${ci}&checkout=${co}` },
                      { name: "Trivago", href: `https://www.trivago.com/?s=${c}&checkIn=${ci}&checkOut=${co}` },
                    ];
                  })().map((l) => (
                    <li key={l.name}><a className="text-[#febb02] underline decoration-2 underline-offset-2 font-semibold hover:text-amber-700" href={l.href} target="_blank" rel="noopener noreferrer">{l.name}</a></li>
                  ))}
                </ul>
                <div className="mt-3">
                  <label className="mb-1 block text-sm">{t("stayAddressLabel")}</label>
                  {isAndroidNative ? (
                    <textarea
                      rows={1}
                      inputMode="text"
                      enterKeyHint="done"
                      name="stay-address"
                      autoCorrect="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      key={`addr-ta-${cityDetailIdx}`}
                      className={(guideIdx === cityDetailIdx && guideStep === "address" ? "ring-4 ring-amber-500 animate-pulse " : "") + "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"}
                      style={{ touchAction: "manipulation" }}
                      value={addressDraft[cityDetailIdx!] ?? (cities[cityDetailIdx!]?.address || "")}
                      onFocus={() => { try { setIsEditingAddress(true); } catch {} }}
                      onInput={(e) => {
                        const v = (e.currentTarget as HTMLTextAreaElement).value;
                        setAddressDraft((prev) => ({ ...prev, [cityDetailIdx!]: v }));
                        if (guideIdx === cityDetailIdx && v.trim()) setGuideStep("check");
                      }}
                      onBlur={(e) => {
                        try {
                          const v = e.currentTarget.value.trim();
                          setIsEditingAddress(false);
                          setCities((prev) => prev.map((x, i) => (i === cityDetailIdx ? { ...x, address: v } : x)));
                        } catch {}
                      }}
                    />
                  ) : (
                    <input
                      type="text"
                      inputMode="text"
                      enterKeyHint="done"
                      name="stay-address"
                      autoComplete="street-address"
                      spellCheck={false}
                      style={{ touchAction: "manipulation", transform: "translateZ(0)", willChange: "transform" }}
                      placeholder={t("stayAddressPlaceholder")}
                      value={addressDraft[cityDetailIdx!] ?? (cities[cityDetailIdx!]?.address || "")}
                      autoFocus
                      key={`addr-${cityDetailIdx}`}
                      className={(guideIdx === cityDetailIdx && guideStep === "address" ? "ring-4 ring-amber-500 animate-pulse " : "") + "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"}
                      onFocus={() => { try { console.log("[ACCOM_FLOW] focus address input"); setIsEditingAddress(true); } catch {} }}
                      onInput={(e) => {
                        const v = (e.target as HTMLInputElement).value;
                        setAddressDraft((prev) => ({ ...prev, [cityDetailIdx!]: v }));
                        if (guideIdx === cityDetailIdx && v.trim()) setGuideStep("check");
                      }}
                      onBlur={(e) => {
                        try {
                          const v = e.currentTarget.value.trim();
                          setIsEditingAddress(false);
                          setCities((prev) => prev.map((x, i) => (i === cityDetailIdx ? { ...x, address: v } : x)));
                        } catch {}
                      }}
                    />
                  )}
                  <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-300 dark:bg-amber-900/20 dark:text-amber-200">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-amber-300 bg-amber-100">
                        <span className="material-symbols-outlined text-[14px] text-amber-800">info</span>
                      </span>
                      <span>{t("stayAddressInfo")}</span>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="mb-1 font-semibold">{t("stayDocsTitle")}</div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold bg-[#febb02] text-black hover:bg-[#ffcc3f]"
                        onClick={() => {
                          const input = document.createElement("input");
                          input.type = "file";
                          input.accept = "image/*";
                          (input as unknown as { capture?: string }).capture = "environment";
                          input.multiple = true;
                          input.onchange = async (e) => {
                            const files = Array.from((e.target as HTMLInputElement).files || []);
                            const mod = await import("@/lib/attachments-store");
                            const list = await Promise.all(files.map(async (f) => {
                              const saved = await mod.saveFromFile(f);
                              return { name: saved.name, type: saved.type, size: saved.size, id: saved.id };
                            }));
                            setCities((prev) => prev.map((x, i) => (i === cityDetailIdx ? { ...x, stayFiles: [...(x.stayFiles || []), ...list] } : x)));
                          };
                          input.click();
                        }}
                      >
                        {t("useCamera")}
                      </Button>
                      <Button
                        type="button"
                        className="inline-flex items-center justify-center rounded-md px-2 py-1 text-xs gap-1 bg-[#febb02] text-black hover:bg-[#ffcc3f]"
                        onClick={() => {
                          const input = document.createElement("input");
                          input.type = "file";
                          input.accept = "image/*,application/pdf";
                          input.multiple = true;
                          input.onchange = async (e) => {
                            const files = Array.from((e.target as HTMLInputElement).files || []);
                            const mod = await import("@/lib/attachments-store");
                            const list = await Promise.all(files.map(async (f) => {
                              const saved = await mod.saveFromFile(f);
                              return { name: saved.name, type: saved.type, size: saved.size, id: saved.id };
                            }));
                            setCities((prev) => prev.map((x, i) => (i === cityDetailIdx ? { ...x, stayFiles: [...(x.stayFiles || []), ...list] } : x)));
                          };
                          input.click();
                        }}
                      >
                        <span className="material-symbols-outlined text-[16px]">attach_file</span>
                        <span>{t("attachProofButton")}</span>
                      </Button>
                    </div>
                    {cities[cityDetailIdx!]?.stayFiles && cities[cityDetailIdx!]!.stayFiles!.length ? (
                <ul className="mt-2 text-xs text-zinc-700 dark:text-zinc-300">
                      {cities[cityDetailIdx].stayFiles!.map((f, idx) => (
                        <li key={`sf-${idx}`}>{f.name} • {Math.round(f.size / 1024)} KB</li>
                      ))}
                    </ul>
                    ) : null}
                  </div>
                  <div className="mt-2 flex justify-end">
                    <Button type="button" className={guideIdx === cityDetailIdx && guideStep === "check" ? "ring-4 ring-amber-500 pulse-ring" : undefined} onClick={() => { onCityCheck(cityDetailIdx!); setCityDetailIdx(null); }}>{t("check")}</Button>
                  </div>
                </div>
              </div>
            </div>
          </Dialog>
        )}
        
        
          <Card className={summaryComplete ? "border-2 border-[#34c759]" : undefined}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>{t("staysTransportsSummaryTitle")}</span>
              {summaryComplete ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs text-green-700">
                  <span className="material-symbols-outlined text-[14px]">task_alt</span>
                  {t("reservedLabel")}
                </span>
              ) : null}
              <span className="ml-auto" />
              <Button type="button" variant="outline" title={t("editLabel")} aria-label={t("editLabel")} onClick={() => router.push("/transport/plan")}>
                <span className="material-symbols-outlined text-[16px] mr-1">edit</span>
                <span>{t("editTransportLabel")}</span>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div ref={summaryRef} className={(summaryHighlight ? "ring-4 ring-amber-500 animate-pulse " : "") + "rounded-lg"}>
              <ul className="space-y-2 text-sm p-3">
                {cities.map((c, i) => (
                  <li
                    key={`stay-${i}`}
                    className={
                      c.checked && c.address
                        ? "rounded border border-green-200 bg-green-50 p-2 text-zinc-900 dark:bg-green-900 dark:border-green-800 dark:text-green-100"
                        : undefined
                    }
                  >
                    <span className="inline-flex items-center gap-1">
                      {c.checked && c.address ? <span className="material-symbols-outlined text-[16px] text-green-700 dark:text-green-300">task_alt</span> : null}
                      <span className="inline-flex items-center gap-1">
                        {t("accommodationDialogTitle")}: {c.name || `${t("cityLabel")} ${i + 1}`} • {c.checkin || "—"} → {c.checkout || "—"} • {c.address || t("addressNotProvided")}
                        <span className="material-symbols-outlined text-[14px] text-zinc-500">edit</span>
                      </span>
                      <Button type="button" variant="outline" title={t("editLabel")} aria-label={t("editLabel")} className="ml-2 h-7 px-2" onClick={() => { setCityDetailIdx(i); setGuideIdx(i); setGuideStep("address"); }}>
                        <span className="material-symbols-outlined text-[16px] mr-1">edit</span>
                        <span>{t("editLabel")}</span>
                      </Button>
                      {Array.isArray(c.stayFiles) && c.stayFiles.length ? (
                        <Button type="button" variant="outline" className="ml-1 h-7 px-2" onClick={() => setShowStayDocsIdx(showStayDocsIdx === i ? null : i)}>
                          <span className="material-symbols-outlined text-[16px] mr-1">attach_file</span>
                          <span>Ver documentos</span>
                        </Button>
                      ) : null}
                    </span>
                    {showStayDocsIdx === i && Array.isArray(c.stayFiles) && c.stayFiles.length ? (
                      <ul className="mt-1 text-xs text-zinc-700 dark:text-zinc-300">
                        {c.stayFiles.map((f, idx2) => (
                          <li key={`stay-doc-${i}-${idx2}`}>{f.name} • {Math.round((f.size || 0) / 1024)} KB</li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
                {cities.map((c, i) => (
                  i < cities.length - 1 ? (
                    <li
                      key={`tr-${i}`}
                      className={
                        c.transportToNext
                          ? "rounded border border-green-200 bg-green-50 p-2 text-zinc-900 dark:bg-green-900 dark:border-green-800 dark:text-green-100"
                          : undefined
                      }
                    >
                      <span className="inline-flex items-center gap-1">
                        {c.transportToNext ? <span className="material-symbols-outlined text-[16px] text-green-700 dark:text-green-300">task_alt</span> : null}
                         <span className="inline-flex items-center gap-1">
                           Transporte: {c.name || `Cidade ${i + 1}`} → {cities[i + 1]?.name || `Cidade ${i + 2}`} • {(c.transportToNext?.mode || "").toUpperCase()}
                           {c.transportToNext?.mode === "car" ? "" : ` • ${c.transportToNext?.depTime || "—"} → ${c.transportToNext?.arrTime || "—"}`}
                           {` • Anexos: ${transportDocsCount[i] ?? (c.transportToNext?.files || []).length}`}
                           <span className="material-symbols-outlined text-[14px] text-zinc-500">edit</span>
                         </span>
                      <Button type="button" variant="outline" title={t("editLabel")} aria-label={t("editLabel")} className="ml-2 h-7 px-2" onClick={() => router.push(`/transport/plan?i=${i}`)}>
                          <span className="material-symbols-outlined text-[16px] mr-1">edit</span>
                          <span>{t("editLabel")}</span>
                        </Button>
                        {(transportDocsCount[i] ?? (c.transportToNext?.files || []).length) ? (
                          <Button type="button" variant="outline" className="ml-1 h-7 px-2" onClick={async () => {
                            if (showTransportDocsIdx === i) { setShowTransportDocsIdx(null); return; }
                            setShowTransportDocsIdx(i);
                            try {
                              const trips = await getSavedTrips();
                              const cur = trips.sort((a, b) => Number(b.savedAt || 0) - Number(a.savedAt || 0))[0];
                              const seg = c.transportToNext;
                              const local = Array.isArray(seg?.files) ? seg!.files!.map((f) => ({ name: f.name, size: f.size })) : [];
                              let dbList: Array<{ name: string; size: number }> = [];
                              if (cur) {
                                const ref = `${c.name || ""}->${cities[i + 1]?.name || ""}`;
                                const more = await getRefAttachments(cur.id, "transport", ref);
                                dbList = more.map((m) => ({ name: m.name, size: Number(m.size || 0) }));
                              }
                              setTransportDocsList((prev) => ({ ...prev, [i]: [...local, ...dbList] }));
                            } catch {}
                          }}>
                            <span className="material-symbols-outlined text-[16px] mr-1">attach_file</span>
                            <span>Ver documentos</span>
                          </Button>
                        ) : null}
                      </span>
                      {showTransportDocsIdx === i && (transportDocsList[i]?.length || 0) ? (
                        <ul className="mt-1 text-xs text-zinc-700 dark:text-zinc-300">
                          {transportDocsList[i]!.map((f, idx3) => (
                            <li key={`tr-doc-${i}-${idx3}`}>{f.name} • {Math.round((f.size || 0) / 1024)} KB</li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ) : null
                ))}
              </ul>
              <div className="mt-3 flex justify-end p-3 pt-0">
                <Button
                  type="button"
                  role="button"
                  className={proceedHighlight ? "ring-4 ring-amber-500 pulse-ring" : undefined}
                  style={{ touchAction: "manipulation" }}
                  disabled={proceedingEntertainment}
                  onClick={proceedToEntertainment}
                >
                  {proceedingEntertainment ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 rounded-full border-2 border-zinc-300 border-t-[var(--brand)] animate-spin" aria-label="Carregando" />
                      <span>{t("proceedToEntertainment")}</span>
                    </span>
                  ) : (
                    t("proceedToEntertainment")
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
