"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarInput } from "@/components/ui/calendar";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

type CityStay = { name?: string; checkin?: string; checkout?: string; address?: string };
type RecordItem = { kind: "activity" | "restaurant"; cityIdx: number; cityName: string; date: string; time?: string; title: string; address?: string; files?: Array<{ name: string; type: string; size: number; dataUrl?: string }> };
type AISuggestion = { name: string; category: "museum" | "park" | "theatre" | "attraction" | "tour"; free?: boolean | null; price?: string | null; prebook?: boolean | null; lead?: string | null; url?: string | null };
type CityEvent = { name: string; date: string; url?: string | null };
type RestaurantSuggestion = { name: string; cuisine?: string[]; price?: string | null; reservation?: boolean | null; url?: string | null };

export default function EntertainmentReservationsPage() {
  const router = useRouter();
  const { show } = useToast();
  const [cities, setCities] = useState<CityStay[]>(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("calentrip_trip_summary") : null;
      if (raw) {
        const obj = JSON.parse(raw);
        if (Array.isArray(obj?.cities)) return obj.cities as CityStay[];
      }
    } catch {}
    return [] as CityStay[];
  });
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [openKind, setOpenKind] = useState<"activity" | "restaurant" | null>(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [address, setAddress] = useState("");
  const [records, setRecords] = useState<RecordItem[]>(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("calentrip:entertainment:records") : null;
      const list = raw ? (JSON.parse(raw) as RecordItem[]) : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [] as RecordItem[];
    }
  });

  const [aiOpenIdx, setAiOpenIdx] = useState<number | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiItems, setAiItems] = useState<AISuggestion[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiEvents, setAiEvents] = useState<CityEvent[]>([]);
  const [aiDateMap, setAiDateMap] = useState<Record<string, string>>({});
  const [aiTimeMap, setAiTimeMap] = useState<Record<string, string>>({});
  const [aiFilesMap, setAiFilesMap] = useState<Record<string, Array<{ name: string; type: string; size: number; dataUrl?: string }>>>({});
  const [aiActiveKey, setAiActiveKey] = useState<string | null>(null);
  const [aiRestOpenIdx, setAiRestOpenIdx] = useState<number | null>(null);
  const [restLoading, setRestLoading] = useState(false);
  const [restItems, setRestItems] = useState<RestaurantSuggestion[]>([]);
  const [restError, setRestError] = useState<string | null>(null);
  const [restDateMap, setRestDateMap] = useState<Record<string, string>>({});
  const [restTimeMap, setRestTimeMap] = useState<Record<string, string>>({});
  const [restFilesMap, setRestFilesMap] = useState<Record<string, Array<{ name: string; type: string; size: number; dataUrl?: string }>>>({});
  const [restActiveKey, setRestActiveKey] = useState<string | null>(null);

  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [goDrawerOpen, setGoDrawerOpen] = useState(false);
  const [goLoading, setGoLoading] = useState(false);
  const [goInfo, setGoInfo] = useState<{ destination?: string; distanceKm?: number; walkingMin?: number; drivingMin?: number; busMin?: number; trainMin?: number; priceEstimate?: number; uberUrl?: string; gmapsUrl?: string } | null>(null);
  const [goRecord, setGoRecord] = useState<RecordItem | null>(null);
  const [docOpen, setDocOpen] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docFiles, setDocFiles] = useState<Array<{ name: string; type: string; size: number; dataUrl?: string }>>([]);

  useEffect(() => {
    if (!cities.length) return;
    try {
      const payload = { cities };
      localStorage.setItem("calentrip_trip_summary", JSON.stringify(payload));
    } catch {}
  }, [cities]);

  const sorted = useMemo(() => {
    const parse = (d: string, t: string | undefined) => {
      const s = `${d || ""} ${t || "00:00"}`.trim();
      return new Date(s.replace(/\//g, "-"));
    };
    return [...records].sort((a, b) => parse(a.date, a.time).getTime() - parse(b.date, b.time).getTime());
  }, [records]);

  useEffect(() => {
    try {
      localStorage.setItem("calentrip:entertainment:records", JSON.stringify(records));
    } catch {}
  }, [records]);

  function formatTimeInput(s: string): string {
    const d = (s || "").replace(/\D/g, "");
    if (!d) return "";
    if (d.length <= 2) return d;
    const h = d.slice(0, 2);
    const m = d.slice(2, 4);
    return `${h}:${(m || "").padEnd(2, "0").slice(0, 2)}`;
  }

  async function fetchCityQid(city: string): Promise<string | null> {
    try {
      const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(city)}&language=pt&format=json&origin=*`;
      const res = await fetch(url);
      const js = await res.json();
      const list: Array<{ id?: string; description?: string }> = js?.search || [];
      const first = list.find((x) => /cidade|city/i.test(x?.description || "") || /municipality|município/i.test(x?.description || "")) || list[0];
      return first?.id || null;
    } catch { return null; }
  }

  async function fetchCategoryItems(cityQid: string, categoryQid: string, category: AISuggestion["category"], limit = 10): Promise<AISuggestion[]> {
    const endpoint = `https://query.wikidata.org/sparql`;
    const query = `SELECT ?item ?itemLabel ?official WHERE { ?item wdt:P31/wdt:P279* wd:${categoryQid} . ?item wdt:P131 wd:${cityQid} . OPTIONAL { ?item wdt:P856 ?official } SERVICE wikibase:label { bd:serviceParam wikibase:language "pt,en". } } LIMIT ${limit}`;
    const url = `${endpoint}?query=${encodeURIComponent(query)}`;
    try {
      const res = await fetch(url, { headers: { Accept: "application/sparql-results+json" } });
      const js = await res.json();
      const rows: Array<{ itemLabel?: { value?: string }; official?: { value?: string } }> = js?.results?.bindings || [];
      return rows.map((r) => {
        const name = r?.itemLabel?.value || "";
        const official = r?.official?.value || null;
        let free: boolean | null = null;
        let price: string | null = null;
        let prebook: boolean | null = null;
        let lead: string | null = null;
        if (category === "park") { free = true; price = null; prebook = false; lead = "-"; }
        else if (category === "museum") { free = false; price = "€10–€25"; prebook = true; lead = "1–2 semanas"; }
        else if (category === "theatre") { free = false; price = "€20–€80"; prebook = true; lead = "1–4 semanas"; }
        else if (category === "attraction") { free = null; price = null; prebook = null; lead = null; }
        else if (category === "tour") { free = false; price = "€20–€60"; prebook = true; lead = "1–2 semanas"; }
        return { name, category, free, price, prebook, lead, url: official } as AISuggestion;
      });
    } catch { return []; }
  }

  async function fetchCityEvents(cityQid: string, startISO: string, endISO: string, limit = 15): Promise<CityEvent[]> {
    const endpoint = `https://query.wikidata.org/sparql`;
    const prefix = `PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>`;
    const query = `${prefix}\nSELECT ?item ?itemLabel (COALESCE(?datePoint, ?start) AS ?d) ?official WHERE { \n  ?item wdt:P31/wdt:P279* wd:Q1656682 .\n  ?item (wdt:P131|wdt:P276) wd:${cityQid} .\n  OPTIONAL { ?item wdt:P585 ?datePoint }\n  OPTIONAL { ?item wdt:P580 ?start }\n  OPTIONAL { ?item wdt:P582 ?end }\n  OPTIONAL { ?item wdt:P856 ?official }\n  FILTER(\n    (?datePoint >= \"${startISO}\"^^xsd:dateTime && ?datePoint <= \"${endISO}\"^^xsd:dateTime) ||\n    (?start >= \"${startISO}\"^^xsd:dateTime && ?start <= \"${endISO}\"^^xsd:dateTime) ||\n    (?start <= \"${startISO}\"^^xsd:dateTime && ?end >= \"${startISO}\"^^xsd:dateTime)\n  )\n  SERVICE wikibase:label { bd:serviceParam wikibase:language \"pt,en\". }\n} LIMIT ${limit}`;
    const url = `${endpoint}?query=${encodeURIComponent(query)}`;
    try {
      const res = await fetch(url, { headers: { Accept: "application/sparql-results+json" } });
      const js = await res.json();
      const rows: Array<{ itemLabel?: { value?: string }; d?: { value?: string }; official?: { value?: string } }> = js?.results?.bindings || [];
      return rows.map((r) => ({ name: r?.itemLabel?.value || "", date: r?.d?.value || "", url: r?.official?.value || null })).filter((e) => e.name && e.date);
    } catch { return []; }
  }

  async function openGoDrawer(r: RecordItem) {
    setGoRecord(r);
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
      const query = `${r.address || (r.title ? `${r.title} ${r.cityName}` : r.cityName)}`.trim();
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

  async function fetchRestaurantItems(cityQid: string, limit = 12): Promise<RestaurantSuggestion[]> {
    const endpoint = `https://query.wikidata.org/sparql`;
    const query = `SELECT ?item ?itemLabel ?official (GROUP_CONCAT(DISTINCT ?cuisineLabel; separator=", ") AS ?cuisines) ?price WHERE {\n  ?item wdt:P31/wdt:P279* wd:Q11707 .\n  ?item (wdt:P131|wdt:P276) wd:${cityQid} .\n  OPTIONAL { ?item wdt:P856 ?official }\n  OPTIONAL { ?item wdt:P2012 ?cuisine . ?cuisine rdfs:label ?cuisineLabel FILTER(LANG(?cuisineLabel) = "pt" || LANG(?cuisineLabel) = "en") }\n  OPTIONAL { ?item wdt:P2555 ?price }\n  SERVICE wikibase:label { bd:serviceParam wikibase:language "pt,en". }\n} GROUP BY ?item ?itemLabel ?official ?price LIMIT ${limit}`;
    const url = `${endpoint}?query=${encodeURIComponent(query)}`;
    try {
      const res = await fetch(url, { headers: { Accept: "application/sparql-results+json" } });
      const js = await res.json();
      const rows: Array<{ itemLabel?: { value?: string }; official?: { value?: string }; cuisines?: { value?: string }; price?: { value?: string } }> = js?.results?.bindings || [];
      return rows.map((r) => ({
        name: r?.itemLabel?.value || "",
        cuisine: (r?.cuisines?.value || "").split(", ").filter(Boolean),
        price: r?.price?.value || null,
        reservation: null,
        url: r?.official?.value || null,
      })).filter((x) => x.name);
    } catch { return []; }
  }

  async function openAISuggestions(idx: number) {
    setAiOpenIdx(idx);
    setAiItems([]);
    setAiEvents([]);
    setAiError(null);
    setAiLoading(true);
    try {
      const cityName = cities[idx]?.name || "";
      const qid = await fetchCityQid(cityName);
      if (!qid) { setAiError("Não foi possível identificar a cidade no Wikidata"); setAiLoading(false); return; }
      const cats: Array<{ qid: string; cat: AISuggestion["category"] }> = [
        { qid: "Q33506", cat: "museum" },
        { qid: "Q22698", cat: "park" },
        { qid: "Q24354", cat: "theatre" },
        { qid: "Q570116", cat: "attraction" }
      ];
      const resultsCats = await Promise.all(cats.map((c) => fetchCategoryItems(qid, c.qid, c.cat, 8)));
      const items = ([] as AISuggestion[]).concat(...resultsCats);
      setAiItems(items);
      const startISO = (cities[idx]?.checkin || "").replace(/\//g, "-");
      const endISO = (cities[idx]?.checkout || startISO).replace(/\//g, "-");
      if (startISO) {
        const evs = await fetchCityEvents(qid, `${startISO}T00:00:00`, `${endISO || startISO}T23:59:59`);
        setAiEvents(evs);
      }
      setAiDateMap({}); setAiTimeMap({}); setAiFilesMap({});
    } catch { setAiError("Falha ao buscar sugestões"); }
    finally { setAiLoading(false); }
  }

  async function openAIRestaurants(idx: number) {
    setAiRestOpenIdx(idx);
    setRestItems([]);
    setRestError(null);
    setRestLoading(true);
    try {
      const cityName = cities[idx]?.name || "";
      const qid = await fetchCityQid(cityName);
      if (!qid) { setRestError("Não foi possível identificar a cidade no Wikidata"); setRestLoading(false); return; }
      const items = await fetchRestaurantItems(qid, 14);
      setRestItems(items);
      setRestDateMap({}); setRestTimeMap({}); setRestFilesMap({});
    } catch { setRestError("Falha ao buscar restaurantes"); }
    finally { setRestLoading(false); }
  }

  return (
    <div className="min-h-screen px-4 py-6 space-y-6">
      <div className="container-page">
        <h1 className="mb-1 text-2xl font-semibold text-[var(--brand)]">Entretenimento e reservas</h1>
        <p className="text-sm text-zinc-600">Agende atividades e restaurantes por cidade. Ao final, veja o resumo cronológico.</p>
      </div>

      <div className="container-page grid grid-cols-1 gap-6 md:grid-cols-2">
        {cities.length ? cities.map((c, i) => (
          <Card key={`city-${i}`} className="rounded-xl shadow-md">
            <CardHeader>
              <CardTitle>{c.name || `Cidade ${i + 1}`}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm">Período: {c.checkin || "—"} → {c.checkout || "—"}</div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                  <div className="text-[10px] leading-tight font-semibold uppercase tracking-wide text-zinc-600 mb-2 break-all text-center">Atividade/entretenimento</div>
                  <div className="space-y-2">
                    <Button type="button" className="w-full h-11 rounded-lg font-semibold tracking-wide" onClick={() => { setOpenIdx(i); setOpenKind("activity"); setTitle(""); setDate(c.checkin || ""); setTime(""); }}>Agendar</Button>
                    <Button type="button" className="w-full h-11 rounded-lg font-semibold tracking-wide" onClick={() => openAISuggestions(i)}>Sugestões por IA</Button>
                  </div>
                </div>
                <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                  <div className="text-[10px] leading-tight font-semibold uppercase tracking-wide text-zinc-600 mb-2 break-all text-center">Restaurante</div>
                  <div className="space-y-2">
                    <Button type="button" variant="secondary" className="w-full h-11 rounded-lg font-semibold tracking-wide" onClick={() => { setOpenIdx(i); setOpenKind("restaurant"); setTitle(""); setDate(c.checkin || ""); setTime(""); }}>Agendar</Button>
                    <Button type="button" variant="secondary" className="w-full h-11 rounded-lg font-semibold tracking-wide" onClick={() => openAIRestaurants(i)}>Sugestões por IA</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )) : (
          <Card className="rounded-xl shadow-md">
            <CardHeader>
              <CardTitle>Sem cidades</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm text-zinc-600">Volte e informe hospedagens para continuar.</div>
                <Button type="button" className="h-11 rounded-lg font-semibold tracking-wide" onClick={() => router.push("/accommodation/search")}>Voltar para hospedagens</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="container-page">
        <Card className="rounded-xl shadow-md">
          <CardHeader>
            <CardTitle>Resumo de atividades e restaurantes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sorted.length ? (
              <ul className="space-y-2 text-sm">
                {sorted.map((r, idx) => (
                  <li key={`rec-${idx}`} className="flex items-center justify-between gap-2">
                    <div>
                      {r.date} {r.time || ""} • {r.cityName} • {r.kind === "activity" ? "Atividade" : "Restaurante"}: {r.title}{r.address ? ` • ${r.address}` : ""}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" onClick={() => openGoDrawer(r)}>Como ir</Button>
                    <Button type="button" variant="outline" onClick={() => {
                        const j = records.indexOf(r);
                        if (j >= 0) {
                          setEditIdx(j);
                          setEditTitle(r.title);
                          setEditDate(r.date);
                          setEditTime(r.time || "");
                          setEditAddress(r.address || "");
                        }
                      }}>Editar</Button>
                      <Button type="button" variant="secondary" onClick={() => {
                        const j = records.indexOf(r);
                        if (j >= 0) {
                          setRecords((prev) => prev.filter((_, i) => i !== j));
                          show("Item removido", { variant: "success" });
                        }
                      }}>Apagar</Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-zinc-600">Nenhuma atividade ou restaurante registrado.</div>
            )}
            <div className="mt-3 flex justify-end">
              <Button type="button" className="h-11 rounded-lg font-semibold tracking-wide" onClick={() => router.push("/calendar/final")}>Ir para o calendário final</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={openIdx !== null && openKind !== null} onOpenChange={() => { setOpenIdx(null); setOpenKind(null); }}>
        <DialogHeader>{openKind === "restaurant" ? "Agendar restaurante" : "Agendar atividade/entretenimento"}</DialogHeader>
        {openIdx !== null && openKind !== null && (
          <div className="p-4 md:p-6 space-y-4 text-sm">
            <div>
              <label className="mb-1 block text-sm">Cidade</label>
              <div className="rounded border p-2">{cities[openIdx]?.name || `Cidade ${openIdx + 1}`}</div>
            </div>
            <div>
              <label className="mb-1 block text-sm">Título</label>
              <Input placeholder={openKind === "restaurant" ? "Nome do restaurante" : "Nome da atividade"} value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm">Endereço</label>
              <Input placeholder="Rua, número, bairro" value={address} onChange={(e) => setAddress(e.target.value)} />
              <div className="mt-1 text-xs text-zinc-600">Este será o endereço para a geolocalização calcular o deslocamento.</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm">Data</label>
                <CalendarInput value={date} min={cities[openIdx!]?.checkin || undefined} max={cities[openIdx!]?.checkout || undefined} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm">Horário</label>
                        <Input placeholder="19:30" value={time} type="tel" inputMode="numeric" pattern="[0-9]*" onChange={(e) => setTime(formatTimeInput(e.target.value))} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" className="h-11 rounded-lg font-semibold tracking-wide" onClick={() => {
                setOpenIdx(null);
                setOpenKind(null);
                setTitle("");
                setDate("");
                setTime("");
                setAddress("");
              }}>Cancelar</Button>
              <Button type="button" className="h-11 rounded-lg font-semibold tracking-wide" disabled={!title || !date} onClick={() => {
                const cityName = cities[openIdx!]?.name || `Cidade ${openIdx! + 1}`;
                setRecords((prev) => [...prev, { kind: openKind!, cityIdx: openIdx!, cityName, date, time, title, address: address.trim() || undefined }]);
                setOpenIdx(null);
                setOpenKind(null);
                setAddress("");
                show(openKind === "restaurant" ? "Restaurante adicionado" : "Atividade adicionada", { variant: "success" });
              }}>Salvar</Button>
            </div>
            <div className="text-xs text-zinc-600">Para encontrar mais opções, use o botão &quot;Sugestões por IA&quot;.</div>
          </div>
        )}
      </Dialog>

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
                      <Button type="button" variant="outline" onClick={() => { setDocTitle(goRecord!.title); setDocFiles(goRecord!.files || []); setDocOpen(true); }}>Arquivos salvos</Button>
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
                        <div className="mt-2">
                          <a className="underline" href={f.dataUrl} target="_blank" rel="noopener noreferrer">Abrir/baixar</a>
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

      <Dialog open={aiOpenIdx !== null} onOpenChange={() => setAiOpenIdx(null)}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <span>Sugestões por IA — atividade/entretenimento</span>
            <Button type="button" variant="outline" className="h-6 px-2 text-[11px]" onClick={() => setAiOpenIdx(null)}>sair</Button>
          </div>
        </DialogHeader>
        {aiOpenIdx !== null && (
          <div className="p-4 md:p-6 space-y-4 text-sm max-h-[75vh] overflow-y-auto">
            <div className="rounded border p-2">Cidade: {cities[aiOpenIdx!]?.name || `Cidade ${aiOpenIdx! + 1}`}</div>
            {aiLoading ? (
              <div className="flex items-center justify-center gap-3 py-6">
                <div className="h-6 w-6 rounded-full border-2 border-zinc-300 border-t-[var(--brand)] animate-spin" aria-label="Carregando" />
                <div className="text-sm text-zinc-700">Buscando…</div>
              </div>
            ) : aiError ? (
              <div className="text-red-600">{aiError}</div>
            ) : aiItems.length === 0 ? (
              <div className="text-zinc-600">Nenhuma sugestão encontrada.</div>
            ) : (
              <>
                {aiEvents.length ? (
                  <div>
                    <div className="mb-2 font-semibold">Eventos nas suas datas</div>
                    <ul className="space-y-2">
                      {aiEvents.map((ev, i) => (
                        <li key={`ev-${i}`} className="rounded border p-2">
                          <div className="font-medium">{ev.name}</div>
                          <div>Data: {new Date(ev.date).toLocaleDateString(undefined, { timeZone: "UTC" })}</div>
                          {ev.url && (<div><a className="underline" href={ev.url} target="_blank" rel="noopener noreferrer">Site oficial</a></div>)}
                          <div className="mt-2">
                            <Button type="button" onClick={() => {
                              const cityName = cities[aiOpenIdx!]?.name || `Cidade ${aiOpenIdx! + 1}`;
                              const d = new Date(ev.date).toISOString().slice(0, 10);
                              setRecords((prev) => [...prev, { kind: "activity", cityIdx: aiOpenIdx!, cityName, date: d, time: "", title: ev.name }]);
                              show("Atividade adicionada", { variant: "success" });
                            }}>Adicionar ao cronograma</Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <ul className="space-y-2">
                  {aiItems.map((s, idx) => (
                    <li key={`ai-${idx}`} className={aiActiveKey === `ai-${idx}` ? "rounded border-2 border-[#febb02] p-2" : "rounded border p-2"}>
                      <div className="font-medium">{s.name} • {s.category === "museum" ? "Museu" : s.category === "park" ? "Parque" : s.category === "theatre" ? "Teatro" : s.category === "tour" ? "Tour" : "Atração"}</div>
                      <div>Preço: {s.free === true ? "Gratuito" : s.free === false ? (s.price || "Pago") : (s.price || "Ver no site")}</div>
                      <div>Ingressos antecipados: {s.prebook === null ? "Ver no site" : s.prebook ? "Sim" : "Não"}</div>
                      <div>Antecedência: {s.lead || "Ver no site"}</div>
                      {s.url && (
                        <div><a className="underline" href={s.url} target="_blank" rel="noopener noreferrer" onClick={() => setAiActiveKey(`ai-${idx}`)}>Site oficial</a></div>
                      )}
                      <div className="mt-2 grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-xs">Data</label>
                          <CalendarInput value={aiDateMap[`ai-${idx}`] || cities[aiOpenIdx!]?.checkin || ""} min={cities[aiOpenIdx!]?.checkin || undefined} max={cities[aiOpenIdx!]?.checkout || undefined} onFocus={() => setAiActiveKey(`ai-${idx}`)} onChange={(e) => setAiDateMap((prev) => ({ ...prev, [`ai-${idx}`]: e.target.value }))} />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs">Horário</label>
                          <Input placeholder="19:30" value={aiTimeMap[`ai-${idx}`] || ""} type="tel" inputMode="numeric" pattern="[0-9]*" onFocus={() => setAiActiveKey(`ai-${idx}`)} onChange={(e) => setAiTimeMap((prev) => ({ ...prev, [`ai-${idx}`]: formatTimeInput(e.target.value) }))} />
                        </div>
                      </div>
                      <div className="mt-2 space-y-2">
                        <label className="mb-1 block text-xs">Foto/Documento da compra</label>
                        <div className="flex items-center gap-2">
                          <input id={`ai-cam-${idx}`} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            if (!files.length) return;
                            Promise.all(files.map((f) => new Promise<{ name: string; type: string; size: number; dataUrl?: string }>((resolve) => {
                              const reader = new FileReader();
                              reader.onload = () => resolve({ name: f.name, type: f.type, size: f.size, dataUrl: String(reader.result || "") });
                              reader.onerror = () => resolve({ name: f.name, type: f.type, size: f.size });
                              reader.readAsDataURL(f);
                            }))).then((arr) => { setAiFilesMap((prev) => ({ ...prev, [`ai-${idx}`]: [...(prev[`ai-${idx}`] || []), ...arr] })); setAiActiveKey(`ai-${idx}`); });
                          }} />
                          <Button type="button" className="rounded-md font-semibold" onClick={() => { setAiActiveKey(`ai-${idx}`); const el = document.getElementById(`ai-cam-${idx}`) as HTMLInputElement | null; el?.click(); }}>Tirar foto (câmera)</Button>
                          <Input id={`ai-file-${idx}`} type="file" multiple accept="image/*,application/pdf" onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            if (!files.length) { setAiFilesMap((prev) => ({ ...prev, [`ai-${idx}`]: prev[`ai-${idx}`] || [] })); setAiActiveKey(`ai-${idx}`); return; }
                            Promise.all(files.map((f) => new Promise<{ name: string; type: string; size: number; dataUrl?: string }>((resolve) => {
                              const reader = new FileReader();
                              reader.onload = () => resolve({ name: f.name, type: f.type, size: f.size, dataUrl: String(reader.result || "") });
                              reader.onerror = () => resolve({ name: f.name, type: f.type, size: f.size });
                              reader.readAsDataURL(f);
                            }))).then((arr) => { setAiFilesMap((prev) => ({ ...prev, [`ai-${idx}`]: [...(prev[`ai-${idx}`] || []), ...arr] })); setAiActiveKey(`ai-${idx}`); });
                          }} />
                        </div>
                        {Boolean((aiFilesMap[`ai-${idx}`] || []).length) && (
                        <div className="text-xs text-zinc-600">{(aiFilesMap[`ai-${idx}`] || []).length} arquivo(s) selecionado(s)</div>
                        )}
                      </div>
                      <div className="mt-2">
                        <Button type="button" className="w-full h-10 rounded-lg font-semibold tracking-wide" onClick={() => {
                          const cityName = cities[aiOpenIdx!]?.name || `Cidade ${aiOpenIdx! + 1}`;
                          const d = aiDateMap[`ai-${idx}`] || cities[aiOpenIdx!]?.checkin || "";
                          const t = aiTimeMap[`ai-${idx}`] || "";
                          const files = aiFilesMap[`ai-${idx}`] || [];
                          if (!d) return;
                          setRecords((prev) => [...prev, { kind: "activity", cityIdx: aiOpenIdx!, cityName, date: d, time: t, title: s.name, files }]);
                          show("Atividade adicionada", { variant: "success" });
                        }}>Adicionar ao cronograma</Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </Dialog>

      <Dialog open={aiRestOpenIdx !== null} onOpenChange={() => setAiRestOpenIdx(null)}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <span>Sugestões por IA — restaurante</span>
            <Button type="button" variant="outline" className="h-6 px-2 text-[11px]" onClick={() => setAiRestOpenIdx(null)}>sair</Button>
          </div>
        </DialogHeader>
        {aiRestOpenIdx !== null && (
          <div className="p-4 md:p-6 space-y-4 text-sm max-h-[75vh] overflow-y-auto">
            <div className="rounded border p-2">Cidade: {cities[aiRestOpenIdx!]?.name || `Cidade ${aiRestOpenIdx! + 1}`}</div>
            {restLoading ? (
              <div className="flex items-center justify-center gap-3 py-6">
                <div className="h-6 w-6 rounded-full border-2 border-zinc-300 border-t-[var(--brand)] animate-spin" aria-label="Carregando" />
                <div className="text-sm text-zinc-700">Buscando…</div>
              </div>
            ) : restError ? (
              <div className="text-red-600">{restError}</div>
            ) : restItems.length === 0 ? (
              <div className="text-zinc-600">Nenhuma sugestão encontrada.</div>
            ) : (
              <ul className="space-y-2">
                {restItems.map((s, idx) => (
                  <li key={`rest-${idx}`} className={restActiveKey === `rest-${idx}` ? "rounded border-2 border-[#febb02] p-2" : "rounded border p-2"}>
                    <div className="font-medium">{s.name} • Restaurante</div>
                    <div>Reserva: {s.reservation === null ? "Ver no site" : s.reservation ? "Necessária" : "Opcional"}</div>
                    <div>Tipo de cozinha: {s.cuisine && s.cuisine.length ? s.cuisine.join(", ") : "Ver no site"}</div>
                    <div>Faixa de preço: {s.price || "Ver no site"}</div>
                    {s.url && (
                      <div><a className="underline" href={s.url} target="_blank" rel="noopener noreferrer" onClick={() => setRestActiveKey(`rest-${idx}`)}>Site oficial</a></div>
                    )}
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs">Data</label>
                        <CalendarInput value={restDateMap[`rest-${idx}`] || cities[aiRestOpenIdx!]?.checkin || ""} min={cities[aiRestOpenIdx!]?.checkin || undefined} max={cities[aiRestOpenIdx!]?.checkout || undefined} onFocus={() => setRestActiveKey(`rest-${idx}`)} onChange={(e) => setRestDateMap((prev) => ({ ...prev, [`rest-${idx}`]: e.target.value }))} />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs">Horário</label>
                        <Input placeholder="19:30" value={restTimeMap[`rest-${idx}`] || ""} type="tel" inputMode="numeric" pattern="[0-9]*" onFocus={() => setRestActiveKey(`rest-${idx}`)} onChange={(e) => setRestTimeMap((prev) => ({ ...prev, [`rest-${idx}`]: formatTimeInput(e.target.value) }))} />
                      </div>
                    </div>
                    <div className="mt-2 space-y-2">
                      <label className="mb-1 block text-xs">Foto/Documento da reserva</label>
                      <div className="flex items-center gap-2">
                        <input id={`rest-cam-${idx}`} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          if (!files.length) return;
                          Promise.all(files.map((f) => new Promise<{ name: string; type: string; size: number; dataUrl?: string }>((resolve) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve({ name: f.name, type: f.type, size: f.size, dataUrl: String(reader.result || "") });
                            reader.onerror = () => resolve({ name: f.name, type: f.type, size: f.size });
                            reader.readAsDataURL(f);
                          }))).then((arr) => { setRestFilesMap((prev) => ({ ...prev, [`rest-${idx}`]: [...(prev[`rest-${idx}`] || []), ...arr] })); setRestActiveKey(`rest-${idx}`); });
                        }} />
                        <Button type="button" variant="secondary" className="rounded-md font-semibold" onClick={() => { setRestActiveKey(`rest-${idx}`); const el = document.getElementById(`rest-cam-${idx}`) as HTMLInputElement | null; el?.click(); }}>Tirar foto (câmera)</Button>
                        <Input id={`rest-file-${idx}`} type="file" multiple accept="image/*,application/pdf" onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          if (!files.length) { setRestFilesMap((prev) => ({ ...prev, [`rest-${idx}`]: prev[`rest-${idx}`] || [] })); setRestActiveKey(`rest-${idx}`); return; }
                          Promise.all(files.map((f) => new Promise<{ name: string; type: string; size: number; dataUrl?: string }>((resolve) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve({ name: f.name, type: f.type, size: f.size, dataUrl: String(reader.result || "") });
                            reader.onerror = () => resolve({ name: f.name, type: f.type, size: f.size });
                            reader.readAsDataURL(f);
                          }))).then((arr) => { setRestFilesMap((prev) => ({ ...prev, [`rest-${idx}`]: [...(prev[`rest-${idx}`] || []), ...arr] })); setRestActiveKey(`rest-${idx}`); }); 
                        }} />
                      </div>
                      {Boolean((restFilesMap[`rest-${idx}`] || []).length) && (
                        <div className="text-xs text-zinc-600">{(restFilesMap[`rest-${idx}`] || []).length} arquivo(s) selecionado(s)</div>
                      )}
                    </div>
                    <div className="mt-2">
                        <Button type="button" variant="secondary" className="w-full h-10 rounded-lg font-semibold tracking-wide" onClick={() => {
                        const cityName = cities[aiRestOpenIdx!]?.name || `Cidade ${aiRestOpenIdx! + 1}`;
                        const d = restDateMap[`rest-${idx}`] || cities[aiRestOpenIdx!]?.checkin || "";
                        const t = restTimeMap[`rest-${idx}`] || "";
                        const files = restFilesMap[`rest-${idx}`] || [];
                        if (!d) return;
                        setRecords((prev) => [...prev, { kind: "restaurant", cityIdx: aiRestOpenIdx!, cityName, date: d, time: t, title: s.name, files }]);
                        show("Restaurante adicionado", { variant: "success" });
                      }}>Adicionar ao cronograma</Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Dialog>

      <Dialog open={editIdx !== null} onOpenChange={() => setEditIdx(null)}>
        <DialogHeader>Editar item</DialogHeader>
        {editIdx !== null && (
          <div className="p-4 md:p-6 space-y-4 text-sm">
            <div className="rounded border p-2">{records[editIdx!]?.cityName}</div>
            <div>
              <label className="mb-1 block text-sm">Título</label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm">Endereço</label>
              <Input placeholder="Rua, número, bairro" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} />
              <div className="mt-1 text-xs text-zinc-600">Este será o endereço para a geolocalização calcular o deslocamento.</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm">Data</label>
                <CalendarInput value={editDate} min={cities[records[editIdx!].cityIdx]?.checkin || undefined} max={cities[records[editIdx!].cityIdx]?.checkout || undefined} onChange={(e) => setEditDate(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm">Horário</label>
                <Input placeholder="19:30" value={editTime} type="tel" inputMode="numeric" pattern="[0-9]*" onChange={(e) => setEditTime(formatTimeInput(e.target.value))} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="button" className="h-11 rounded-lg font-semibold tracking-wide" disabled={!editTitle || !editDate} onClick={() => {
                setRecords((prev) => prev.map((it, i) => i === editIdx ? { ...it, title: editTitle, date: editDate, time: editTime, address: editAddress.trim() || it.address } : it));
                setEditIdx(null);
                setEditAddress("");
                show("Item atualizado", { variant: "success" });
              }}>Salvar</Button>
            </div>
            <div className="text-xs text-zinc-600">Para encontrar mais opções, use o botão &quot;Sugestões por IA&quot;.</div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
