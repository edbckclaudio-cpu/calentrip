"use client";
export const dynamic = "force-dynamic";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTrip } from "@/lib/trip-context";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type TransportMode = "air" | "train" | "bus" | "car";
type TransportRoute = { gmapsUrl?: string; r2rUrl?: string } | null;
type TransportFile = { name: string; type: string; size: number; dataUrl?: string };
type TransportSegment = { mode: TransportMode; dep: string; arr: string; depTime: string; arrTime: string; files?: TransportFile[] };
type CitySummary = { name: string; checkin: string; checkout: string; address?: string; checked?: boolean; transportToNext?: TransportSegment };

export default function TransportPlanPage() {
  const router = useRouter();
  const { tripSearch } = useTrip();
  const { t } = useI18n();
  const { show, dismiss } = useToast();
  const lastToastId = useRef<number | null>(null);
  const showToast = useCallback((message: string, opts?: { variant?: "info" | "success" | "error"; duration?: number; sticky?: boolean; key?: string }) => {
    if (lastToastId.current) dismiss(lastToastId.current);
    const id = show(message, opts);
    lastToastId.current = id;
    return id;
  }, [show, dismiss]);

  const [segIdx, setSegIdx] = useState(0);
  useEffect(() => {
    try {
      const sp = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
      const v = Number(sp.get("i") || "0");
      setSegIdx(Number.isFinite(v) && v >= 0 ? v : 0);
    } catch {}
  }, [showToast]);

  const [cities, setCities] = useState<CitySummary[]>([]);
  const [route, setRoute] = useState<TransportRoute>(null);
  const [mode, setMode] = useState<TransportMode>("train");
  const [dep, setDep] = useState("");
  const [arr, setArr] = useState("");
  const depRef = useRef<HTMLInputElement | null>(null);
  const arrRef = useRef<HTMLInputElement | null>(null);
  const [depOpts, setDepOpts] = useState<string[]>([]);
  const [arrOpts, setArrOpts] = useState<string[]>([]);
  const [depTime, setDepTime] = useState("");
  const [arrTime, setArrTime] = useState("");
  const depTimeRef = useRef<HTMLInputElement | null>(null);
  const arrTimeRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<TransportFile[]>([]);
  const camInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("calentrip_trip_summary") : null;
      const js: { cities?: CitySummary[] } | null = raw ? JSON.parse(raw) : null;
      const list: CitySummary[] = js?.cities || [];
      setCities(list);
      if (!list.length) showToast("Antes, informe as hospedagens.", { duration: 7000 });
    } catch {}
  }, [showToast]);

  const fromCity = cities[segIdx]?.name || "";
  const toCity = cities[segIdx + 1]?.name || "";

  useEffect(() => {
    if (!fromCity || !toCity) return;
    showToast("Escolha o transporte entre as cidades, preenchendo origem, destino e horários.", { duration: 7000 });
    setDep(""); setArr(""); setDepTime(""); setArrTime("");
    setDepOpts([]); setArrOpts([]);
    (async () => {
      const gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(fromCity)}&destination=${encodeURIComponent(toCity)}`;
      const r2rUrl = `https://www.rome2rio.com/s/${encodeURIComponent(fromCity)}/${encodeURIComponent(toCity)}?lang=pt-BR&currency=BRL`;
      setRoute({ gmapsUrl, r2rUrl });
    })();
  }, [fromCity, toCity, showToast]);

  async function suggestAir(city: string) {
    const { searchAirportsAsync } = await import("@/lib/airports");
    const arr = await searchAirportsAsync(city);
    return Array.from(new Set(arr.filter((a) => a.city.toLowerCase() === city.toLowerCase()).map((a) => `${a.city} – ${a.name} (${a.iata})`)));
  }

  async function suggestPlace(city: string, type: "train" | "bus") {
    const q = `${city} ${type} station`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=12`;
    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    const js = (await res.json()) as Array<{ display_name: string }>;
    const cityLow = city.toLowerCase();
    return Array.from(new Set(js.map((x) => x.display_name).filter((s) => s.toLowerCase().includes(cityLow))));
  }

  function formatTimeInput(v: string) {
    const d = (v || "").replace(/[^0-9]/g, "").slice(0, 4);
    if (d.length <= 2) return d;
    return `${d.slice(0,2)}:${d.slice(2)}`;
  }

  function saveTransport() {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("calentrip_trip_summary") : null;
      const js: { cities?: CitySummary[] } | null = raw ? JSON.parse(raw) : null;
      const list: CitySummary[] = js?.cities || [];
      const segment: TransportSegment = { mode, dep: depRef.current?.value ?? dep, arr: arrRef.current?.value ?? arr, depTime: depTimeRef.current?.value ?? depTime, arrTime: arrTimeRef.current?.value ?? arrTime, files };
      const updated = list.map((x, i) => (i === segIdx ? { ...x, transportToNext: segment } : x));
      const payload = { cities: updated };
      if (typeof window !== "undefined") localStorage.setItem("calentrip_trip_summary", JSON.stringify(payload));
      showToast("Transporte salvo", { variant: "success" });
      const hasNext = segIdx + 1 < updated.length - 1;
      if (hasNext) {
        router.push(`/transport/plan?i=${segIdx + 1}`);
        showToast("Próximo trecho", { duration: 5000 });
      } else {
        try { if (typeof window !== "undefined") localStorage.setItem("calentrip:show_summary", "1"); } catch {}
        router.push("/accommodation/search");
      }
    } catch { showToast("Erro ao salvar", { variant: "error" }); }
  }

  useEffect(() => {
    if (mode === "car") {
      try {
        const raw = typeof window !== "undefined" ? localStorage.getItem("calentrip_trip_summary") : null;
        const js: { cities?: CitySummary[] } | null = raw ? JSON.parse(raw) : null;
        const list: CitySummary[] = js?.cities || [];
        const segment: TransportSegment = { mode: "car", dep: "", arr: "", depTime: "", arrTime: "" };
        const updated = list.map((x, i) => (i === segIdx ? { ...x, transportToNext: segment } : x));
        const payload = { cities: updated };
        if (typeof window !== "undefined") localStorage.setItem("calentrip_trip_summary", JSON.stringify(payload));
      } catch {}
      showToast("Transporte próprio selecionado. Indo para resumo.", { duration: 5000 });
      try { if (typeof window !== "undefined") localStorage.setItem("calentrip:show_summary", "1"); } catch {}
      router.push("/accommodation/search");
    }
  }, [mode, segIdx, router, showToast]);

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

  return (
    <div className="min-h-screen px-4 py-6 space-y-6">
      <div className="container-page grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>Transporte entre cidades</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="mb-2">{fromCity} → {toCity}</div>
              <ul className="space-y-1 mb-2">
                <li>
                  <a className="text-[#febb02] underline decoration-2 underline-offset-2 font-semibold hover:text-amber-700 flex items-center gap-1" href={route?.r2rUrl} target="_blank" rel="noopener noreferrer">
                    <span className="material-symbols-outlined text-[16px]">alt_route</span>
                    <span>Opções de rota (Rome2Rio)</span>
                  </a>
                </li>
                <li><a className="text-[#febb02] underline decoration-2 underline-offset-2 font-semibold hover:text-amber-700" href={`https://www.rentalcars.com/`} target="_blank" rel="noopener noreferrer">Rentalcars</a></li>
                <li><a className="text-[#febb02] underline decoration-2 underline-offset-2 font-semibold hover:text-amber-700" href={route?.gmapsUrl} target="_blank" rel="noopener noreferrer">Google Maps</a></li>
              </ul>
              <div>
                <label className="mb-1 block text-sm">Modal</label>
                <select className="w-full rounded-md border px-2 py-1 text-sm" value={mode} onChange={(e) => setMode(e.target.value as TransportMode)}>
                  <option value="air">Avião</option>
                  <option value="train">Trem</option>
                  <option value="bus">Ônibus</option>
                  <option value="car">Carro</option>
                </select>
              </div>
              {mode !== "car" ? (
                <div className="space-y-2">
                  <div>
                    <label className="mb-1 block text-sm">Origem (aeroporto/estação)</label>
                    <div className="relative">
                      <Input
                        placeholder="Digite a origem"
                        value={dep}
                        inputMode="text"
                        autoCapitalize="none"
                        autoCorrect="off"
                        enterKeyHint="next"
                        ref={depRef}
                        onFocus={async () => {
                          if (!fromCity) return;
                          if (mode === "air") setDepOpts(await suggestAir(fromCity));
                          else setDepOpts(await suggestPlace(fromCity, mode === "train" ? "train" : "bus"));
                        }}
                        onChange={async (e) => {
                          const v = e.target.value; setDep(v);
                          if (v.trim().length < 1) return;
                          if (!fromCity) return;
                          if (mode === "air") setDepOpts(await suggestAir(fromCity));
                          else setDepOpts(await suggestPlace(fromCity, mode === "train" ? "train" : "bus"));
                        }}
                      />
                      {depOpts.length ? (
                        <Card className="absolute left-0 right-0 bottom-full mb-1 z-40 p-0">
                          <ul className="max-h-24 overflow-auto divide-y">
                            {depOpts.map((o, i) => (
                              <li key={`dep-${i}`}>
                                <button type="button" className="w-full px-2 py-1 text-left hover:bg-zinc-50" onClick={() => { setDep(o); if (depRef.current) depRef.current.value = o; }}>
                                  <span>{o}</span>
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
                        placeholder="Digite o destino"
                        value={arr}
                        inputMode="text"
                        autoCapitalize="none"
                        autoCorrect="off"
                        enterKeyHint="next"
                        ref={arrRef}
                        onFocus={async () => {
                          if (!toCity) return;
                          if (mode === "air") setArrOpts(await suggestAir(toCity));
                          else setArrOpts(await suggestPlace(toCity, mode === "train" ? "train" : "bus"));
                        }}
                        onChange={async (e) => {
                          const v = e.target.value; setArr(v);
                          if (v.trim().length < 1) return;
                          if (!toCity) return;
                          if (mode === "air") setArrOpts(await suggestAir(toCity));
                          else setArrOpts(await suggestPlace(toCity, mode === "train" ? "train" : "bus"));
                        }}
                      />
                      {arrOpts.length ? (
                        <Card className="absolute left-0 right-0 bottom-full mb-1 z-40 p-0">
                          <ul className="max-h-24 overflow-auto divide-y">
                            {arrOpts.map((o, i) => (
                              <li key={`arr-${i}`}>
                                <button type="button" className="w-full px-2 py-1 text-left hover:bg-zinc-50" onClick={() => { setArr(o); if (arrRef.current) arrRef.current.value = o; }}>
                                  <span>{o}</span>
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
                      <label className="mb-1 block text-sm">Hora da Partida</label>
                      <Input
                        placeholder="hh:mm"
                        value={depTime}
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        enterKeyHint="next"
                        ref={depTimeRef}
                        onChange={(e) => setDepTime(formatTimeInput((e.target as HTMLInputElement).value))}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm">Hora de Chegada</label>
                      <Input
                        placeholder="hh:mm"
                        value={arrTime}
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        enterKeyHint="next"
                        ref={arrTimeRef}
                        onChange={(e) => setArrTime(formatTimeInput((e.target as HTMLInputElement).value))}
                      />
                    </div>
                  </div>
                  <div className="mt-2">
                    <label className="mb-1 block text-sm">Documentos do transporte</label>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button type="button" variant="secondary" className="px-2 py-1 text-xs" onClick={() => camInputRef.current?.click()}>Usar câmera</Button>
                      <Button type="button" variant="secondary" className="px-2 py-1 text-xs" onClick={() => fileInputRef.current?.click()}>Escolher arquivos</Button>
                      <span className="text-xs text-zinc-600">Anexos: {files.length}</span>
                    </div>
                    <input ref={camInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        const buf = await f.arrayBuffer();
                        const b64 = typeof window !== "undefined" ? btoa(String.fromCharCode(...new Uint8Array(buf))) : "";
                        const dataUrl = `data:${f.type};base64,${b64}`;
                        setFiles((prev) => [...prev, { name: f.name, type: f.type, size: f.size, dataUrl }]);
                      } catch {
                        setFiles((prev) => [...prev, { name: f.name, type: f.type, size: f.size }]);
                      } finally { try { (e.target as HTMLInputElement).value = ""; } catch {} }
                    }} />
                    <input ref={fileInputRef} type="file" multiple className="hidden" onChange={async (e) => {
                      const list = Array.from(e.target.files || []);
                      for (const f of list) {
                        try {
                          const buf = await f.arrayBuffer();
                          const b64 = typeof window !== "undefined" ? btoa(String.fromCharCode(...new Uint8Array(buf))) : "";
                          const dataUrl = `data:${f.type};base64,${b64}`;
                          setFiles((prev) => [...prev, { name: f.name, type: f.type, size: f.size, dataUrl }]);
                        } catch {
                          setFiles((prev) => [...prev, { name: f.name, type: f.type, size: f.size }]);
                        }
                      }
                      try { (e.target as HTMLInputElement).value = ""; } catch {}
                    }} />
                  </div>
                </div>
              ) : null}
              <div className="mt-3 flex justify-end">
                {mode !== "car" ? (
                  <Button type="button" onClick={saveTransport}>Salvar transporte</Button>
                ) : (
                  <Button type="button" onClick={() => router.push("/accommodation/search")}>Ir para resumo</Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
