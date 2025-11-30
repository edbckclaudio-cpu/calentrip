"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { useTrip } from "@/lib/trip-context";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarInput } from "@/components/ui/calendar";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { findAirportByIata, getCountryByIata } from "@/lib/airports";
import { getTrips } from "@/lib/trips-store";
import { useToast } from "@/components/ui/toast";

export default function AccommodationSearchPage() {
  const { tripSearch } = useTrip();
  const router = useRouter();
  const { t } = useI18n();
  const { show } = useToast();
  const initialCity = useMemo(() => {
    if (!tripSearch) return "";
    if (tripSearch.mode === "same") return tripSearch.destination ?? "";
    return "";
  }, [tripSearch]);
  const [city, setCity] = useState(initialCity);
  
  const [cityCount, setCityCount] = useState(0);
  type TransportSegment = { mode: "air" | "train" | "bus" | "car"; dep: string; arr: string; depTime: string; arrTime: string; files: Array<{ name: string; type: string; size: number; id?: string; dataUrl?: string }>; route?: { distanceKm?: number; durationMin?: number; gmapsUrl?: string; r2rUrl?: string; osmUrl?: string } | null };
  const [cities, setCities] = useState<Array<{ name: string; checkin: string; checkout: string; address?: string; checked?: boolean; stayFiles?: Array<{ name: string; type: string; size: number; id?: string; dataUrl?: string }>; transportToNext?: TransportSegment }>>([]);
  const [cityDetailIdx, setCityDetailIdx] = useState<number | null>(null);
  const [citySearchIdx, setCitySearchIdx] = useState<number | null>(null);
  const [citySearchQuery, setCitySearchQuery] = useState("");
  const [citySearchResults, setCitySearchResults] = useState<Array<{ city: string; name: string; country: string }>>([]);
  const [guideIdx, setGuideIdx] = useState<number | null>(null);
  const [guideStep, setGuideStep] = useState<"name" | "checkout" | "stay" | "address" | "check" | null>(null);
  const [citySearchLoading, setCitySearchLoading] = useState(false);
  const [transportOpenIdx, setTransportOpenIdx] = useState<number | null>(null);
  const [transportRoute, setTransportRoute] = useState<{ distanceKm?: number; durationMin?: number; gmapsUrl?: string; r2rUrl?: string; osmUrl?: string } | null>(null);
  const [transportMode, setTransportMode] = useState<"air" | "train" | "bus" | "car">("train");
  const [transportDep, setTransportDep] = useState("");
  const [transportArr, setTransportArr] = useState("");
  const [transportDepOpts, setTransportDepOpts] = useState<string[]>([]);
  const [transportArrOpts, setTransportArrOpts] = useState<string[]>([]);
  const [transportDepTime, setTransportDepTime] = useState("");
  const [transportArrTime, setTransportArrTime] = useState("");
  const [transportFiles, setTransportFiles] = useState<Array<{ name: string; type: string; size: number; dataUrl?: string }>>([]);
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const [transportNotice, setTransportNotice] = useState<string | null>(null);
  const [transportHighlight, setTransportHighlight] = useState(false);
  const [summaryHighlight, setSummaryHighlight] = useState(false);
  const [sameCityHighlight, setSameCityHighlight] = useState(() => !((initialCity || "").trim()));
  const [sameSearchHighlight, setSameSearchHighlight] = useState(() => Boolean((initialCity || "").trim()));
  const [proceedHighlight, setProceedHighlight] = useState(false);
  const [diffCityCountHighlight, setDiffCityCountHighlight] = useState(false);
  const [diffCheckHighlight, setDiffCheckHighlight] = useState(false);
  const [noteAnim, setNoteAnim] = useState<{ maxH: number; transition: string }>({ maxH: 240, transition: "opacity 250ms ease-out, max-height 250ms ease-out" });
  useEffect(() => {
    try {
      const mobile = typeof window !== "undefined" && window.matchMedia("(max-width: 480px)").matches;
      setNoteAnim({ maxH: mobile ? 160 : 240, transition: mobile ? "opacity 200ms ease-out, max-height 200ms ease-out" : "opacity 250ms ease-out, max-height 250ms ease-out" });
    } catch {}
  }, []);
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

  function totalPassengers(p: { adults?: number; children?: number; infants?: number } | number | undefined) {
    if (typeof p === "number") return p;
    const o = p ?? { adults: 1, children: 0, infants: 0 };
    return Number(o.adults ?? 0) + Number(o.children ?? 0) + Number(o.infants ?? 0);
  }

  

  const arrival = useMemo(() => {
    if (!tripSearch) return "";
    if (tripSearch.mode === "same") return tripSearch.destination ?? "";
    return tripSearch.outbound.destination ?? "";
  }, [tripSearch]);

  const arrivalDate = useMemo(() => {
    if (!tripSearch) return "";
    return tripSearch.mode === "same" ? (tripSearch.departDate ?? "") : (tripSearch.outbound.date ?? "");
  }, [tripSearch]);

  const returnDate = useMemo(() => {
    if (!tripSearch) return "";
    return tripSearch.mode === "same" ? (tripSearch.returnDate ?? "") : (tripSearch.inbound.date ?? "");
  }, [tripSearch]);

  

  useEffect(() => {
    if (!tripSearch) return;
    if (tripSearch.mode !== "same") return;
    const dest = tripSearch.destination ?? "";
    const looksIata = /^[A-Za-z]{3}$/.test(dest);
    if (!looksIata) return;
    if (city && city !== dest) return;
    findAirportByIata(dest).then((a) => {
      if (a && a.city) setCity(a.city);
    });
  }, [tripSearch, city]);

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
  

  


  function onConfirmCityCount() {
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
    show("Cidades configuradas");
    setGuideIdx(0);
    setGuideStep("name");
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
      try {
        if (tripSearch) {
          if (tripSearch.mode === "same") {
            const c = await getCountryByIata(tripSearch.destination);
            if (c) preferredCountries.push(c);
          } else {
            const c1 = await getCountryByIata(tripSearch.outbound.destination);
            const c2 = await getCountryByIata(tripSearch.inbound.destination);
            if (c1) preferredCountries.push(c1);
            if (c2) preferredCountries.push(c2);
          }
        }
      } catch {}
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

  function onPickCity(idx: number, c: string) {
    setCities((prev) => prev.map((x, i) => (i === idx ? { ...x, name: c } : x)));
    setCitySearchIdx(null);
    if (idx === cities.length - 1) {
      setGuideStep("stay");
      show("Última cidade selecionada, direcionando para compra de hospedagem", { duration: 5000 });
    }
  }

  function onCityCheck(idx: number) {
    const cur = cities[idx];
    if (!cur?.address) { show("Informe o endereço da hospedagem antes de concluir", { variant: "error" }); return; }
    setCities((prev) => prev.map((x, i) => (i === idx ? { ...x, checked: true } : x)));
    if (idx < cities.length - 1) {
      const next = idx + 1;
      const isLastNext = next === cities.length - 1;
      if (idx === 0) {
        show(isLastNext ? `Escolha a cidade 2 e compre a hospedagem (sem checkout)` : `Escolha a cidade 2 e a data de checkout`, { duration: 6000 });
      } else {
        show(isLastNext ? `Complete o nome da cidade ${idx + 2} e compre a hospedagem (sem checkout)` : `Complete o nome da cidade ${idx + 2} e busque a acomodação`);
      }
    }
    const allChecked = cities.every((c, i) => (i === idx ? true : c.checked));
    if (tripSearch?.mode === "same" && allChecked) {
      setProceedHighlight(true);
    }
    if (allChecked && cities.length > 1) {
      setTransportOpenIdx(0);
      show("Agora escolha transporte entre a cidade 1 e a cidade 2");
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

  async function fetchTransportSuggestions(city: string, typed: string, mode: "air" | "train" | "bus"): Promise<string[]> {
    const baseCity = (city || "").trim();
    const q = (typed || "").trim();
    if (!baseCity) return [];
    try {
      if (mode === "air") {
        const { searchAirportsAsync } = await import("@/lib/airports");
        const list = await searchAirportsAsync(q || baseCity);
        const cityLow = baseCity.toLowerCase();
        const seen = new Set<string>();
        return list
          .filter((a) => (a.city || "").toLowerCase() === cityLow)
          .map((a) => `${a.city} – ${a.name} (${a.iata})`)
          .filter((s) => { if (seen.has(s)) return false; seen.add(s); return true; })
          .slice(0, 12);
      }
      const type = mode;
      const q1 = `${baseCity} ${type} station`;
      const q2 = q ? `${q} ${type} station ${baseCity}` : "";
      const urls = [q1, q2].filter(Boolean).map((qq) => `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(qq)}&format=json&limit=15`);
      const cityLow = baseCity.toLowerCase();
      const seen = new Set<string>();
      const results: string[] = [];
      for (const u of urls) {
        try {
          const res = await fetch(u, { headers: { "Accept": "application/json", "Accept-Language": "pt-BR,en" } });
          const js = (await res.json()) as Array<{ display_name: string }>;
          for (const item of js) {
            const name = (item.display_name || "").split(",")[0];
            const s = name.toLowerCase();
            if (!s) continue;
            if (!s.includes(cityLow)) continue;
            if (/shuttle/i.test(s)) continue;
            if (/bus to/i.test(s)) continue;
            if (type === "train" && /bus/i.test(s)) continue;
            if (q && !s.includes(q.toLowerCase())) continue;
            if (seen.has(name)) continue;
            seen.add(name);
            results.push(name);
            if (results.length >= 12) break;
          }
          if (results.length >= 12) break;
        } catch {}
      }
      return results;
    } catch { return []; }
  }

  function formatTimeInput(s: string): string {
    const d = (s || "").replace(/\D/g, "");
    if (!d) return "";
    if (d.length <= 2) return d;
    const h = d.slice(0, 2);
    const m = d.slice(2, 4);
    return `${h}:${(m || "").padEnd(2, "0").slice(0, 2)}`;
  }

  function onSaveTransport() {
    if (transportOpenIdx === null) return;
    const i = transportOpenIdx;
    const segment: TransportSegment = {
      mode: transportMode,
      dep: transportDep,
      arr: transportArr,
      depTime: transportDepTime,
      arrTime: transportArrTime,
      files: transportFiles.slice(),
      route: transportRoute || undefined,
    };
    setCities((prev) => prev.map((x, idx) => (idx === i ? { ...x, transportToNext: segment } : x)));
    setTransportFiles([]);
    const next = i + 1;
    if (next < cities.length - 1) {
      setTransportOpenIdx(next);
      const from = cities[next]?.name || `Cidade ${next + 1}`;
      const to = cities[next + 1]?.name || `Cidade ${next + 2}`;
      const msg = `Agora vamos configurar o transporte entre ${from} e ${to}.`;
      setTransportNotice(msg);
      setTransportHighlight(true);
      show(`Agora buscar e comprar o transporte da cidade ${next + 1} para a cidade ${next + 2}`, { duration: 7000 });
      setTimeout(() => { setTransportHighlight(false); }, 7000);
    } else {
      setTransportOpenIdx(null);
      show("Transporte salvo. Veja o resumo e conclua a hospedagem.", { variant: "success" });
      summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setTransportNotice(null);
      setTransportHighlight(false);
      setSummaryHighlight(true);
      setTimeout(() => { setSummaryHighlight(false); }, 5000);
    }
  }

  useEffect(() => {
    (async () => {
      if (transportOpenIdx === null) return;
      setTransportDep("");
      setTransportArr("");
      setTransportDepTime("");
      setTransportArrTime("");
      setTransportDepOpts([]);
      setTransportArrOpts([]);
      const i = transportOpenIdx;
      const a = cities[i]?.name || "";
      const b = cities[i+1]?.name || "";
      if (!a || !b) return;
      const originQ = `${a}`;
      const destQ = `${b}`;
      const geocode = async (q: string) => {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
        const res = await fetch(url, { headers: { "Accept": "application/json" } });
        const js = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
        return js[0] ? { lat: Number(js[0].lat), lon: Number(js[0].lon) } : null;
      };
      const o = await geocode(originQ);
      const d = await geocode(destQ);
      let distanceKm: number | undefined;
      let durationMin: number | undefined;
      let osmUrl: string | undefined;
      if (o && d) {
        const osrm = `https://router.project-osrm.org/route/v1/driving/${o.lon},${o.lat};${d.lon},${d.lat}?overview=false`;
        const res = await fetch(osrm);
        const js = await res.json();
        const r = js?.routes?.[0];
        if (r) {
          distanceKm = Math.round((r.distance ?? 0) / 1000);
          durationMin = Math.round((r.duration ?? 0) / 60);
        }
        const bbox = [Math.min(o.lon, d.lon), Math.min(o.lat, d.lat), Math.max(o.lon, d.lon), Math.max(o.lat, d.lat)];
        osmUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox.join("%2C")}&layer=mapnik`;
      }
      const gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originQ)}&destination=${encodeURIComponent(destQ)}`;
      const r2rUrl = `https://www.rome2rio.com/s/${encodeURIComponent(originQ)}/${encodeURIComponent(destQ)}`;
      setTransportRoute({ distanceKm, durationMin, gmapsUrl, r2rUrl, osmUrl });
      const suggestAir = async (city: string) => {
        const { searchAirportsAsync } = await import("@/lib/airports");
        const arr = await searchAirportsAsync(city);
        return Array.from(new Set(arr.filter((a) => a.city.toLowerCase() === city.toLowerCase()).map((a) => `${a.city} – ${a.name} (${a.iata})`)));
      };
      const suggestPlace = async (city: string, type: "train" | "bus") => {
        const q = `${city} ${type} station`;
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=12`;
        try {
          const res = await fetch(url, { headers: { "Accept": "application/json" } });
          const js = (await res.json()) as Array<{ display_name: string }>;
          const cityLow = city.toLowerCase();
          return js
            .map((x) => x.display_name.split(",")[0])
            .filter((n) => {
              const s = (n || "").toLowerCase();
              if (!s) return false;
              if (!s.includes(cityLow)) return false;
              if (/shuttle/i.test(s)) return false;
              if (/bus to/i.test(s)) return false;
              if (type === "train" && /bus/i.test(s)) return false;
              return true;
            })
            .slice(0, 12);
        } catch { return []; }
      };
      const depCity = a;
      const arrCity = b;
      if (transportMode === "air") {
        setTransportDepOpts(await suggestAir(depCity));
        setTransportArrOpts(await suggestAir(arrCity));
      } else if (transportMode === "train" || transportMode === "bus") {
        setTransportDepOpts(await suggestPlace(depCity, transportMode));
        setTransportArrOpts(await suggestPlace(arrCity, transportMode));
      } else {
        setTransportDepOpts([]);
        setTransportArrOpts([]);
      }
    })();
  }, [transportOpenIdx, cities, transportMode]);

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
                <div className="rounded-lg border p-3 text-sm">
                  <div><span className="font-semibold">Cidade</span>: {city || initialCity || "(defina acima)"}</div>
                  <div><span className="font-semibold">Check-in</span>: {dates.checkin || "—"}</div>
                  <div><span className="font-semibold">Check-out</span>: {dates.checkout || "—"}</div>
                </div>
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
                  placeholder="Roma"
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
                    const chosen = city || initialCity;
                    if (!chosen) { show("Defina a cidade"); return; }
                    setCities([{ name: chosen, checkin: dates.checkin || "", checkout: dates.checkout || "" }]);
                    setCityDetailIdx(0);
                    setGuideIdx(0);
                    setGuideStep("address");
                    setSameSearchHighlight(false);
                    show("Escolha a acomodação");
                  }}>Buscar acomodação</Button>
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
                    className={diffCityCountHighlight ? "ring-4 ring-amber-500 animate-pulse" : undefined}
                    onChange={(e) => {
                      const v = Number(e.target.value) || 0;
                      setCityCount(v);
                      if (tripSearch?.mode === "different") {
                        if (v > 0) { setDiffCityCountHighlight(false); setDiffCheckHighlight(true); }
                        else { setDiffCityCountHighlight(true); setDiffCheckHighlight(false); }
                      }
                    }}
                  />
                  <Button type="button" className={diffCheckHighlight ? "ring-4 ring-amber-500 animate-pulse" : undefined} onClick={() => { setDiffCheckHighlight(false); onConfirmCityCount(); }}>Check</Button>
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
                                placeholder="Roma"
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
                              <Button type="button" variant="outline" disabled={!enabled} onClick={() => setCitySearchIdx(idx)}>Buscar</Button>
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
                          <Button type="button" disabled={!enabled || !(c.name && (idx === cities.length - 1 || c.checkout))} className={guideIdx === idx && guideStep === "stay" ? "ring-4 ring-amber-500 animate-pulse" : undefined} onClick={() => { show("Escolha a acomodação"); setCityDetailIdx(idx); setGuideStep("address"); }}>
                            Comprar hospedagem
                          </Button>
                          <Button type="button" variant="secondary" disabled={idx !== 0 || !cities[cities.length - 1]?.checked} onClick={() => setTransportOpenIdx(idx)}>Transporte</Button>
                          <Button type="button" variant="outline" disabled={!enabled || !c.address} onClick={() => onCityCheck(idx)}>Check</Button>
                        </div>
                            </>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                )}
                <Dialog open={citySearchIdx !== null} onOpenChange={() => setCitySearchIdx(null)}>
                  <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md rounded-l-lg bg-white p-4 shadow-lg dark:bg-black border border-zinc-200 dark:border-zinc-800">
                    <DialogHeader>Buscar cidade</DialogHeader>
                    <Input placeholder="Digite a cidade" value={citySearchQuery} onChange={(e) => searchCities(e.target.value)} />
                    <div className="mt-2">
                      {citySearchLoading ? (
                        <div className="text-sm text-zinc-600">Carregando…</div>
                      ) : citySearchResults.length === 0 ? (
                        <div className="text-sm text-zinc-600">Nenhuma sugestão encontrada</div>
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
                    <div className="mt-3 flex justify-end">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={!citySearchQuery.trim()}
                        onClick={() => {
                          const v = citySearchQuery.trim();
                          if (!v) return;
                          onPickCity(Number(citySearchIdx), v);
                          show("Cidade definida manualmente");
                        }}
                      >
                        Usar cidade digitada
                      </Button>
                    </div>
                  </div>
                </Dialog>
                
              </div>
            )}
          </CardContent>
        </Card>
        {cityDetailIdx !== null && (
          <Dialog open onOpenChange={() => setCityDetailIdx(null)}>
            <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md rounded-l-lg bg-white p-4 shadow-lg dark:bg-black border border-zinc-200 dark:border-zinc-800">
              <DialogHeader>Hospedagem</DialogHeader>
              <div className="p-1 space-y-2 text-sm">
                <div className="font-semibold">{cities[cityDetailIdx!]?.name || `Cidade ${(cityDetailIdx ?? 0) + 1}`}</div>
                <div>Check-in: {cities[cityDetailIdx!]?.checkin || "—"}</div>
                <div>Check-out: {cities[cityDetailIdx!]?.checkout || "—"}</div>
                <div className="mt-2 font-semibold">Links de acomodação</div>
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
                    <li key={l.name}><a className="underline" href={l.href} target="_blank" rel="noopener noreferrer">{l.name}</a></li>
                  ))}
                </ul>
                <div className="mt-3">
                  <label className="mb-1 block text-sm">Endereço da hospedagem</label>
                  <Input
                    placeholder="Rua, número, bairro"
                    value={cities[cityDetailIdx!]?.address || ""}
                    className={guideIdx === cityDetailIdx && guideStep === "address" ? "ring-4 ring-amber-500 animate-pulse" : undefined}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCities((prev) => prev.map((x, i) => (i === cityDetailIdx ? { ...x, address: v } : x)));
                      if (guideIdx === cityDetailIdx && v.trim()) setGuideStep("check");
                    }}
                  />
                  <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-300 dark:bg-amber-900/20 dark:text-amber-200">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-amber-300 bg-amber-100">
                        <span className="material-symbols-outlined text-[14px] text-amber-800">info</span>
                      </span>
                      <span>
                        Informe o endereço completo da hospedagem. Este endereço ficará no calendário e, no dia da atividade, enviaremos uma notificação com distância, tempo de deslocamento, opções de transporte e links para aplicativos de carro já com o destino preenchido.
                      </span>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="mb-1 font-semibold">Documentos da hospedagem</div>
                    <div className="flex items-center gap-2">
                      <label htmlFor={`stay-cam-${cityDetailIdx ?? 0}`} className="inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm cursor-pointer">Usar câmera</label>
                      <input id={`stay-cam-${cityDetailIdx ?? 0}`} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        Promise.all(files.map(async (f) => {
                          const mod = await import("@/lib/attachments-store");
                          const saved = await mod.saveFromFile(f);
                          return { name: saved.name, type: saved.type, size: saved.size, id: saved.id };
                        })).then((list) => {
                          setCities((prev) => prev.map((x, i) => (i === cityDetailIdx ? { ...x, stayFiles: [...(x.stayFiles || []), ...list] } : x)));
                        });
                      }} />
                      <Input id={`stay-file-${cityDetailIdx ?? 0}`} type="file" multiple accept="image/*,application/pdf" onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        Promise.all(files.map(async (f) => {
                          const mod = await import("@/lib/attachments-store");
                          const saved = await mod.saveFromFile(f);
                          return { name: saved.name, type: saved.type, size: saved.size, id: saved.id };
                        })).then((list) => {
                          setCities((prev) => prev.map((x, i) => (i === cityDetailIdx ? { ...x, stayFiles: [...(x.stayFiles || []), ...list] } : x)));
                        });
                      }} />
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
                    <Button type="button" className={guideIdx === cityDetailIdx && guideStep === "check" ? "ring-4 ring-amber-500 animate-pulse" : undefined} onClick={() => { onCityCheck(cityDetailIdx!); setCityDetailIdx(null); }}>Check</Button>
                  </div>
                </div>
              </div>
            </div>
          </Dialog>
        )}
        
        <Dialog open={transportOpenIdx !== null} onOpenChange={(o) => { if (!o) { setTransportOpenIdx(null); setTransportNotice(null); setTransportHighlight(false); } }}>
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md rounded-l-lg bg-white p-4 shadow-lg dark:bg-black border border-zinc-200 dark:border-zinc-800">
            <DialogHeader>
              <div className={transportHighlight ? "rounded-md p-1 ring-4 ring-amber-500 animate-pulse" : undefined}>
                Transporte entre {transportOpenIdx !== null ? cities[transportOpenIdx]?.name : ""} e {transportOpenIdx !== null ? cities[transportOpenIdx + 1]?.name : ""}
              </div>
            </DialogHeader>
            {transportNotice ? (
              <div className="mb-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-300 dark:bg-amber-900/20 dark:text-amber-200">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-amber-300 bg-amber-100 text-[11px] font-semibold text-amber-800">i</span>
                  <span>{transportNotice}</span>
                </div>
              </div>
            ) : null}
            <div className="text-sm">
              <div className="mb-2">Distância: {transportRoute?.distanceKm ? `${transportRoute.distanceKm} km` : "—"}</div>
              <div className="mb-2">Tempo estimado: {transportRoute?.durationMin ? `${transportRoute.durationMin} min` : "—"}</div>
              {transportRoute?.osmUrl ? (
                <iframe title="map" src={transportRoute.osmUrl} className="mb-3 h-40 w-full rounded-md border" />
              ) : null}
              <ul className="space-y-1 mb-2">
                <li><a className="underline" href={transportRoute?.r2rUrl} target="_blank" rel="noopener noreferrer">Rome2Rio</a></li>
                <li><a className="underline" href={`https://www.rentalcars.com/`} target="_blank" rel="noopener noreferrer">Rentalcars</a></li>
                <li><a className="underline" href={transportRoute?.gmapsUrl} target="_blank" rel="noopener noreferrer">Google Maps</a></li>
              </ul>
              <div className="mb-2">
                <label className="mb-1 block text-sm">Modal</label>
                <select className="w-full rounded-md border px-2 py-1 text-sm" value={transportMode} onChange={(e) => setTransportMode(e.target.value as "air" | "train" | "bus" | "car")}>
                  <option value="air">Avião</option>
                  <option value="train">Trem</option>
                  <option value="bus">Ônibus</option>
                  <option value="car">Carro</option>
                </select>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <div>
                  <label className="mb-1 block text-sm">Origem (aeroporto/estação)</label>
                  <div className="relative">
                    <Input
                      placeholder="Ex.: FCO / Roma Termini"
                      value={transportDep}
                      onFocus={() => {
                        const cityName = cities[transportOpenIdx || 0]?.name || "";
                        if (!cityName) return;
                        if (transportMode === "car") { setTransportDepOpts([]); return; }
                        const mode = transportMode === "air" ? "air" : transportMode === "train" ? "train" : "bus";
                        fetchTransportSuggestions(cityName, transportDep, mode).then(setTransportDepOpts);
                      }}
                      onChange={(e) => {
                        const v = e.target.value;
                        setTransportDep(v);
                        const cityName = cities[transportOpenIdx || 0]?.name || "";
                        if (!cityName) return;
                        if (transportMode === "car") { setTransportDepOpts([]); return; }
                        if (v.trim().length >= 1) {
                          const mode = transportMode === "air" ? "air" : transportMode === "train" ? "train" : "bus";
                          fetchTransportSuggestions(cityName, v, mode).then(setTransportDepOpts);
                        }
                      }}
                    />
                    {transportDepOpts.length ? (
                      <Card className="absolute left-0 right-0 bottom-full mb-1 z-40 p-0">
                        <ul className="max-h-24 overflow-auto divide-y">
                          {transportDepOpts.map((o, i) => (
                            <li key={`dep-${i}`}>
                              <button type="button" className="w-full px-2 py-1 text-left hover:bg-zinc-50" onClick={() => setTransportDep(o)}>
                                <span>{o}</span>
                                <span className="ml-1 text-xs text-zinc-500">{transportMode === "air" ? "Aeroporto" : transportMode === "train" ? "Estação de trem" : "Estação de ônibus"}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </Card>
                    ) : null}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm">Destino (aeroporto/estação)</label>
                  <div className="relative">
                    <Input
                      placeholder="Ex.: FLR / Firenze SMN"
                      value={transportArr}
                      onFocus={() => {
                        const cityName = cities[(transportOpenIdx || 0) + 1]?.name || "";
                        if (!cityName) return;
                        if (transportMode === "car") { setTransportArrOpts([]); return; }
                        const mode = transportMode === "air" ? "air" : transportMode === "train" ? "train" : "bus";
                        fetchTransportSuggestions(cityName, transportArr, mode).then(setTransportArrOpts);
                      }}
                      onChange={(e) => {
                        const v = e.target.value;
                        setTransportArr(v);
                        const cityName = cities[(transportOpenIdx || 0) + 1]?.name || "";
                        if (!cityName) return;
                        if (transportMode === "car") { setTransportArrOpts([]); return; }
                        if (v.trim().length >= 1) {
                          const mode = transportMode === "air" ? "air" : transportMode === "train" ? "train" : "bus";
                          fetchTransportSuggestions(cityName, v, mode).then(setTransportArrOpts);
                        }
                      }}
                    />
                    {transportArrOpts.length ? (
                      <Card className="absolute left-0 right-0 bottom-full mb-1 z-40 p-0">
                        <ul className="max-h-24 overflow-auto divide-y">
                          {transportArrOpts.map((o, i) => (
                            <li key={`arr-${i}`}>
                              <button type="button" className="w-full px-2 py-1 text-left hover:bg-zinc-50" onClick={() => setTransportArr(o)}>
                                <span>{o}</span>
                                <span className="ml-1 text-xs text-zinc-500">{transportMode === "air" ? "Aeroporto" : transportMode === "train" ? "Estação de trem" : "Estação de ônibus"}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </Card>
                    ) : null}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-sm">Horário de saída</label>
                    <Input placeholder="14:30" value={transportDepTime} type="tel" inputMode="numeric" pattern="[0-9]*" onChange={(e) => setTransportDepTime(formatTimeInput(e.target.value))} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm">Horário de chegada</label>
                    <Input placeholder="17:05" value={transportArrTime} type="tel" inputMode="numeric" pattern="[0-9]*" onChange={(e) => setTransportArrTime(formatTimeInput(e.target.value))} />
                  </div>
                </div>
                <div className="mt-2">
                  <input id="file-transport" type="file" accept="image/*,application/pdf" capture="environment" multiple className="hidden" onChange={(e) => {
                    const list = Array.from(e.target.files ?? []);
                    const limit = 2 * 1024 * 1024;
                    const readers = list.map((f) => new Promise<{ name: string; type: string; size: number; dataUrl?: string }>((resolve) => {
                      if (f.size > limit || !(f.type.startsWith("image/") || f.type === "application/pdf")) {
                        resolve({ name: f.name, type: f.type, size: f.size });
                      } else {
                        const fr = new FileReader();
                        fr.onload = () => resolve({ name: f.name, type: f.type, size: f.size, dataUrl: String(fr.result || "") });
                        fr.onerror = () => resolve({ name: f.name, type: f.type, size: f.size });
                        fr.readAsDataURL(f);
                      }
                    }));
                    Promise.all(readers).then((items) => {
                      setTransportFiles((prev) => [...prev, ...items]);
                    });
                  }} />
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="secondary" onClick={() => document.getElementById("file-transport")?.click()}>Anexar passagem</Button>
                    <span className="text-xs text-zinc-600">Foto/arquivo da passagem ficará disponível no calendário.</span>
                  </div>
                  {transportFiles.length ? (
                    <ul className="mt-2 text-xs text-zinc-700 dark:text-zinc-300">
                      {transportFiles.map((f, idx) => (
                        <li key={`tf-${idx}`}>{f.name} • {Math.round(f.size / 1024)} KB</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
              <p className="mt-2 text-xs text-zinc-600">Compare opções: avião, trem, ônibus, carro. Alguns sites oferecem compra direta.</p>
              <div className="mt-3 flex justify-end">
                <Button type="button" onClick={onSaveTransport}>Salvar transporte</Button>
              </div>
            </div>
          </div>
        </Dialog>
        <Card>
          <CardHeader>
            <CardTitle>Resumo de hospedagens e transportes</CardTitle>
          </CardHeader>
          <CardContent>
            <div ref={summaryRef} className={summaryHighlight ? "ring-4 ring-amber-500 animate-pulse rounded-lg" : undefined}>
              <ul className="space-y-2 text-sm p-3">
                {cities.map((c, i) => (
                  <li key={`stay-${i}`}>
                    Hospedagem: {c.name || `Cidade ${i + 1}`} • {c.checkin || "—"} → {c.checkout || "—"} • {c.address || "(endereço não informado)"}
                  </li>
                ))}
                {cities.map((c, i) => (
                  i < cities.length - 1 && c.transportToNext ? (
                    <li key={`tr-${i}`}>
                      Transporte: {c.name || `Cidade ${i + 1}`} → {cities[i + 1]?.name || `Cidade ${i + 2}`} • {(c.transportToNext.mode || "").toUpperCase()} • {c.transportToNext.depTime || "—"} → {c.transportToNext.arrTime || "—"} • Anexos: {(c.transportToNext.files || []).length}
                    </li>
                  ) : null
                ))}
              </ul>
              <div className="mt-3 flex justify-end p-3 pt-0">
                <Button type="button" className={proceedHighlight ? "ring-4 ring-amber-500 animate-pulse" : undefined} onClick={() => {
                  try {
                    const data = { cities: cities };
                    if (typeof window !== "undefined") localStorage.setItem("calentrip_trip_summary", JSON.stringify(data));
                  } catch {}
                  router.push("/entertainment/reservations");
                }}>Seguir para agendar entretenimento e restaurantes</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
    </div>
  );
}
