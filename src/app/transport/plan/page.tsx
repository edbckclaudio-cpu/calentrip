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
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { initDatabase as initDatabaseDb, migrateFromLocalStorage as migrateFromLocalStorageDb, getSavedTrips as getSavedTripsDb, saveRefAttachments } from "@/lib/trips-db";
import { saveFromDataUrl } from "@/lib/attachments-store";

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
  }, []);

  const [cities, setCities] = useState<CitySummary[]>([]);
  const [route, setRoute] = useState<TransportRoute>(null);
  const [mode, setMode] = useState<TransportMode>("train");
  const [dep, setDep] = useState("");
  const [arr, setArr] = useState("");
  const depRef = useRef<HTMLInputElement | null>(null);
  const arrRef = useRef<HTMLInputElement | null>(null);
  
  const [depTime, setDepTime] = useState("");
  const [arrTime, setArrTime] = useState("");
  const depTimeRef = useRef<HTMLInputElement | null>(null);
  const arrTimeRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<TransportFile[]>([]);
  const camInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [nextOpen, setNextOpen] = useState(false);
  const [dialogSegIdx, setDialogSegIdx] = useState<number | null>(null);
  const [mRoute, setMRoute] = useState<TransportRoute>(null);
  const [mMode, setMMode] = useState<TransportMode>("train");
  const [mDep, setMDep] = useState("");
  const [mArr, setMArr] = useState("");
  const mDepRef = useRef<HTMLInputElement | null>(null);
  const mArrRef = useRef<HTMLInputElement | null>(null);
  const [mDepTime, setMDepTime] = useState("");
  const [mArrTime, setMArrTime] = useState("");
  const mDepTimeRef = useRef<HTMLInputElement | null>(null);
  const mArrTimeRef = useRef<HTMLInputElement | null>(null);
  const [mFiles, setMFiles] = useState<TransportFile[]>([]);
  const mCamInputRef = useRef<HTMLInputElement | null>(null);
  const mFileInputRef = useRef<HTMLInputElement | null>(null);

  async function resolveTripId(): Promise<string | null> {
    try {
      await initDatabaseDb();
      try { await migrateFromLocalStorageDb(); } catch {}
      const all = await getSavedTripsDb();
      const rawTs = typeof window !== "undefined" ? localStorage.getItem("calentrip:tripSearch") : null;
      const ts = rawTs ? JSON.parse(rawTs) : null;
      if (ts) {
        const isSame = ts.mode === "same";
        const origin = isSame ? ts.origin : ts.outbound?.origin;
        const destination = isSame ? ts.destination : ts.outbound?.destination;
        const date = isSame ? ts.departDate : ts.outbound?.date;
        const pax = (() => { const p = ts.passengers || {}; return Number(p.adults || 0) + Number(p.children || 0) + Number(p.infants || 0); })();
        const title = origin && destination ? `${origin} → ${destination}` : "";
        const it = all.find((t) => t.title === title && t.date === date && Number(t.passengers || 0) === pax);
        if (it) return String(it.id);
      }
      const fallback = all.find((t) => t.reachedFinalCalendar) || (all.length ? all[0] : null);
      return fallback ? String(fallback.id) : null;
    } catch { return null; }
  }

  async function saveDocumentsToDbSimpleRef() {
    try {
      if (!files.length) return;
      const tripId = await resolveTripId();
      if (!tripId) return;
      const ref = `${fromCity}->${toCity}`;
      const saved = await Promise.all(files.map(async (f) => {
        if (!f.dataUrl) return null;
        const r = await saveFromDataUrl(f.dataUrl!, f.name);
        return { name: f.name, type: f.type, size: f.size, id: r.id };
      }));
      const list = saved.filter(Boolean) as Array<{ name: string; type: string; size: number; id: string }>;
      if (!list.length) return;
      await saveRefAttachments(tripId, "transport", ref, list);
      setFiles([]);
    } catch {}
  }
  async function saveDocumentsModalToDbSimpleRef(from: string, to: string) {
    try {
      if (!mFiles.length) return;
      const tripId = await resolveTripId();
      if (!tripId) return;
      const ref = `${from}->${to}`;
      const saved = await Promise.all(mFiles.map(async (f) => {
        if (!f.dataUrl) return null;
        const r = await saveFromDataUrl(f.dataUrl!, f.name);
        return { name: f.name, type: f.type, size: f.size, id: r.id };
      }));
      const list = saved.filter(Boolean) as Array<{ name: string; type: string; size: number; id: string }>;
      if (!list.length) return;
      await saveRefAttachments(tripId, "transport", ref, list);
      setMFiles([]);
    } catch {}
  }

  const initialHintShownRef = useRef(false);
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("calentrip_trip_summary") : null;
      const js: { cities?: CitySummary[] } | null = raw ? JSON.parse(raw) : null;
      const list: CitySummary[] = js?.cities || [];
      setCities(list);
      if (!list.length && !initialHintShownRef.current) {
        initialHintShownRef.current = true;
        showToast(t("backAndInformStaysMessage"), { duration: 3000 });
      }
    } catch {}
  }, [t]);

  const fromCity = cities[segIdx]?.name || "";
  const toCity = cities[segIdx + 1]?.name || "";
  const fromCityModal = dialogSegIdx != null ? (cities[dialogSegIdx!]?.name || "") : "";
  const toCityModal = dialogSegIdx != null ? (cities[(dialogSegIdx! + 1)]?.name || "") : "";

  const lastHintIdxRef = useRef<number | null>(null);
  useEffect(() => {
    if (!fromCity || !toCity) return;
    if (lastHintIdxRef.current !== segIdx) {
      lastHintIdxRef.current = segIdx;
      showToast(t("fillTransportFieldsHint"), { duration: 3000 });
    }
    setDep(""); setArr(""); setDepTime(""); setArrTime("");
    (async () => {
      const gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(fromCity)}&destination=${encodeURIComponent(toCity)}`;
      const params = new URLSearchParams({ lang: "pt-BR", currency: "BRL" });
      try { const dt = cities[segIdx]?.checkout || ""; if (dt) params.set("date", dt); } catch {}
      const baseR2R = `https://www.rome2rio.com/s/${encodeURIComponent(fromCity)}/${encodeURIComponent(toCity)}`;
      const r2rUrl = params.toString() ? `${baseR2R}?${params.toString()}` : baseR2R;
      setRoute({ gmapsUrl, r2rUrl });
    })();
  }, [fromCity, toCity, cities, segIdx, t]);
  const lastDialogHintIdxRef = useRef<number | null>(null);
  useEffect(() => {
    if (dialogSegIdx == null) return;
    if (!fromCityModal || !toCityModal) return;
    if (lastDialogHintIdxRef.current !== dialogSegIdx) {
      lastDialogHintIdxRef.current = dialogSegIdx;
      showToast(t("fillTransportFieldsHint"), { duration: 3000 });
    }
    setMDep(""); setMArr(""); setMDepTime(""); setMArrTime("");
    (async () => {
      const gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(fromCityModal)}&destination=${encodeURIComponent(toCityModal)}`;
      const params = new URLSearchParams({ lang: "pt-BR", currency: "BRL" });
      try { const dt = cities[dialogSegIdx!]?.checkout || ""; if (dt) params.set("date", dt); } catch {}
      const baseR2R = `https://www.rome2rio.com/s/${encodeURIComponent(fromCityModal)}/${encodeURIComponent(toCityModal)}`;
      const r2rUrl = params.toString() ? `${baseR2R}?${params.toString()}` : baseR2R;
      setMRoute({ gmapsUrl, r2rUrl });
    })();
  }, [dialogSegIdx, fromCityModal, toCityModal, cities, t]);

  

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
      showToast(t("transportSavedGoSummary"), { variant: "success", duration: 3000 });
      const hasNext = segIdx + 1 < updated.length - 1;
      if (hasNext) {
        showToast(t("openingNextTransportMsg"), { duration: 3000 });
        setDialogSegIdx(segIdx + 1);
        setNextOpen(true);
        setMDep(""); setMArr(""); setMDepTime(""); setMArrTime("");
      } else {
        showToast(t("transportSavedGoSummary"), { duration: 3000 });
        try { if (typeof window !== "undefined") localStorage.setItem("calentrip:show_summary", "1"); } catch {}
        router.push("/accommodation/search");
        try {
          setTimeout(() => {
            try {
              if (typeof window !== "undefined") {
                const same = (window.location.pathname || "").includes("/accommodation/search");
                if (!same) window.location.href = "/accommodation/search";
              }
            } catch {}
          }, 600);
        } catch {}
      }
    } catch { showToast(t("saveErrorMsg"), { variant: "error" }); }
  }
  function saveTransportInModal() {
    try {
      if (dialogSegIdx == null) return;
      const raw = typeof window !== "undefined" ? localStorage.getItem("calentrip_trip_summary") : null;
      const js: { cities?: CitySummary[] } | null = raw ? JSON.parse(raw) : null;
      const list: CitySummary[] = js?.cities || [];
      const segment: TransportSegment = { mode: mMode, dep: mDepRef.current?.value ?? mDep, arr: mArrRef.current?.value ?? mArr, depTime: mDepTimeRef.current?.value ?? mDepTime, arrTime: mArrTimeRef.current?.value ?? mArrTime, files: mFiles };
      const updated = list.map((x, i) => (i === dialogSegIdx ? { ...x, transportToNext: segment } : x));
      const payload = { cities: updated };
      if (typeof window !== "undefined") localStorage.setItem("calentrip_trip_summary", JSON.stringify(payload));
      showToast(t("transportSavedGoSummary"), { variant: "success", duration: 3000 });
      saveDocumentsModalToDbSimpleRef(fromCityModal, toCityModal);
      const hasNext = dialogSegIdx + 1 < updated.length - 1;
      if (hasNext) {
        showToast(t("openingNextTransportMsg"), { duration: 3000 });
        setDialogSegIdx((v) => (v == null ? null : v + 1));
        setMDep(""); setMArr(""); setMDepTime(""); setMArrTime("");
      } else {
        showToast(t("transportSavedGoSummary"), { duration: 3000 });
        try { if (typeof window !== "undefined") localStorage.setItem("calentrip:show_summary", "1"); } catch {}
        setNextOpen(false);
        router.push("/accommodation/search");
        try {
          setTimeout(() => {
            try {
              if (typeof window !== "undefined") {
                const same = (window.location.pathname || "").includes("/accommodation/search");
                if (!same) window.location.href = "/accommodation/search";
              }
            } catch {}
          }, 600);
        } catch {}
      }
    } catch { showToast(t("saveErrorMsg"), { variant: "error" }); }
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
      showToast(t("ownTransportSelectedGoingSummary"), { duration: 3000 });
      try { if (typeof window !== "undefined") localStorage.setItem("calentrip:show_summary", "1"); } catch {}
      router.push("/accommodation/search");
    }
  }, [mode, segIdx, router, t]);

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
              <span>{t("transportBetween")}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="mb-2">{fromCity} → {toCity}</div>
              <ul className="space-y-1 mb-2">
                <li>
                  <a className="text-[#febb02] underline decoration-2 underline-offset-2 font-semibold hover:text-amber-700 flex items-center gap-1" href={route?.r2rUrl} target="_blank" rel="noopener noreferrer">
                    <span className="material-symbols-outlined text-[16px]">alt_route</span>
                    <span>{t("seeOptionsOnRome2Rio")}</span>
                  </a>
                </li>
                <li><a className="text-[#febb02] underline decoration-2 underline-offset-2 font-semibold hover:text-amber-700" href={`https://www.rentalcars.com/`} target="_blank" rel="noopener noreferrer">{t("rentalcarsLabel")}</a></li>
                <li><a className="text-[#febb02] underline decoration-2 underline-offset-2 font-semibold hover:text-amber-700" href={route?.gmapsUrl} target="_blank" rel="noopener noreferrer">{t("googleMapsLabel")}</a></li>
              </ul>
              <div>
                <label className="mb-1 block text-sm">{t("transportModeLabel")}</label>
                <select className="w-full rounded-md border px-2 py-1 text-sm" value={mode} onChange={(e) => setMode(e.target.value as TransportMode)}>
                  <option value="air">{t("modeAir")}</option>
                  <option value="train">{t("modeTrain")}</option>
                  <option value="bus">{t("modeBus")}</option>
                  <option value="car">{t("modeCar")}</option>
                </select>
              </div>
              {mode !== "car" ? (
                <div className="space-y-2">
                  <div>
                    <label className="mb-1 block text-sm">{t("transportOriginLabel")}</label>
                    <div className="relative">
                      <Input
                        placeholder={t("transportOriginPlaceholder")}
                        defaultValue={dep}
                        type="text"
                        inputMode="text"
                        autoCapitalize="none"
                        autoCorrect="off"
                        enterKeyHint="next"
                        ref={depRef}
                        onChange={(e) => { const v = e.target.value; setDep(v); }}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm">{t("transportDestinationLabel")}</label>
                    <div className="relative">
                      <Input
                        placeholder={t("transportDestinationPlaceholder")}
                        defaultValue={arr}
                        type="text"
                        inputMode="text"
                        autoCapitalize="none"
                        autoCorrect="off"
                        enterKeyHint="next"
                        ref={arrRef}
                        onChange={(e) => { const v = e.target.value; setArr(v); }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-sm">{t("departureTime")}</label>
                      <Input
                        placeholder={t("timePlaceholder")}
                        defaultValue={depTime}
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        enterKeyHint="next"
                        ref={depTimeRef}
                        onChange={(e) => { const v = formatTimeInput((e.target as HTMLInputElement).value); setDepTime(v); try { if (depTimeRef.current) depTimeRef.current.value = v; } catch {} }}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm">{t("arrivalTime")}</label>
                      <Input
                        placeholder={t("timePlaceholder")}
                        defaultValue={arrTime}
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        enterKeyHint="next"
                        ref={arrTimeRef}
                        onChange={(e) => { const v = formatTimeInput((e.target as HTMLInputElement).value); setArrTime(v); try { if (arrTimeRef.current) arrTimeRef.current.value = v; } catch {} }}
                      />
                    </div>
                  </div>
                  <div className="mt-2">
                    <label className="mb-1 block text-sm">{t("transportDocsTitle")}</label>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button type="button" variant="secondary" className="px-2 py-1 text-xs" onClick={() => camInputRef.current?.click()}>{t("useCamera")}</Button>
                      <Button type="button" variant="secondary" className="px-2 py-1 text-xs" onClick={() => fileInputRef.current?.click()}>{t("chooseFiles")}</Button>
                      <span className="text-xs text-zinc-600">{t("attachmentsLabel")}: {files.length}</span>
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
                  <Button type="button" onClick={() => { saveTransport(); saveDocumentsToDbSimpleRef(); }}>{t("saveTransport")}</Button>
                ) : (
                  <Button type="button" onClick={() => router.push("/accommodation/search")}>{t("goToSummaryButton")}</Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <Dialog open={nextOpen} onOpenChange={setNextOpen} placement="bottom">
        <DialogHeader>{t("transportBetween")}</DialogHeader>
        <div className="space-y-3 text-sm px-4 pb-4">
          <div className="mb-2">{fromCityModal} → {toCityModal}</div>
          <ul className="space-y-1 mb-2">
            <li>
              <a className="text-[#febb02] underline decoration-2 underline-offset-2 font-semibold hover:text-amber-700 flex items-center gap-1" href={mRoute?.r2rUrl} target="_blank" rel="noopener noreferrer">
                <span className="material-symbols-outlined text-[16px]">alt_route</span>
                <span>{t("seeOptionsOnRome2Rio")}</span>
              </a>
            </li>
            <li><a className="text-[#febb02] underline decoration-2 underline-offset-2 font-semibold hover:text-amber-700" href={`https://www.rentalcars.com/`} target="_blank" rel="noopener noreferrer">{t("rentalcarsLabel")}</a></li>
            <li><a className="text-[#febb02] underline decoration-2 underline-offset-2 font-semibold hover:text-amber-700" href={mRoute?.gmapsUrl} target="_blank" rel="noopener noreferrer">{t("googleMapsLabel")}</a></li>
          </ul>
          <div>
            <label className="mb-1 block text-sm">{t("transportModeLabel")}</label>
            <select className="w-full rounded-md border px-2 py-1 text-sm" value={mMode} onChange={(e) => setMMode(e.target.value as TransportMode)}>
              <option value="air">{t("modeAir")}</option>
              <option value="train">{t("modeTrain")}</option>
              <option value="bus">{t("modeBus")}</option>
              <option value="car">{t("modeCar")}</option>
            </select>
          </div>
          {mMode !== "car" ? (
            <div className="space-y-2">
              <div>
                <label className="mb-1 block text-sm">{t("transportOriginLabel")}</label>
                <div className="relative">
                  <Input
                    placeholder={t("transportOriginPlaceholder")}
                    defaultValue={mDep}
                    type="text"
                    inputMode="text"
                    autoCapitalize="none"
                    autoCorrect="off"
                    enterKeyHint="next"
                    ref={mDepRef}
                    onChange={(e) => { const v = e.target.value; setMDep(v); }}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm">{t("transportDestinationLabel")}</label>
                <div className="relative">
                  <Input
                    placeholder={t("transportDestinationPlaceholder")}
                    defaultValue={mArr}
                    type="text"
                    inputMode="text"
                    autoCapitalize="none"
                    autoCorrect="off"
                    enterKeyHint="next"
                    ref={mArrRef}
                    onChange={(e) => { const v = e.target.value; setMArr(v); }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-sm">{t("departureTime")}</label>
                  <Input
                    placeholder={t("timePlaceholder")}
                    defaultValue={mDepTime}
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    enterKeyHint="next"
                    ref={mDepTimeRef}
                    onChange={(e) => { const v = formatTimeInput((e.target as HTMLInputElement).value); setMDepTime(v); try { if (mDepTimeRef.current) mDepTimeRef.current.value = v; } catch {} }}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm">{t("arrivalTime")}</label>
                  <Input
                    placeholder={t("timePlaceholder")}
                    defaultValue={mArrTime}
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    enterKeyHint="next"
                    ref={mArrTimeRef}
                    onChange={(e) => { const v = formatTimeInput((e.target as HTMLInputElement).value); setMArrTime(v); try { if (mArrTimeRef.current) mArrTimeRef.current.value = v; } catch {} }}
                  />
                </div>
              </div>
              <div className="mt-2">
                <label className="mb-1 block text-sm">{t("transportDocsTitle")}</label>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button type="button" variant="secondary" className="px-2 py-1 text-xs" onClick={() => mCamInputRef.current?.click()}>{t("useCamera")}</Button>
                  <Button type="button" variant="secondary" className="px-2 py-1 text-xs" onClick={() => mFileInputRef.current?.click()}>{t("chooseFiles")}</Button>
                  <span className="text-xs text-zinc-600">{t("attachmentsLabel")}: {mFiles.length}</span>
                </div>
                <input ref={mCamInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    const buf = await f.arrayBuffer();
                    const b64 = typeof window !== "undefined" ? btoa(String.fromCharCode(...new Uint8Array(buf))) : "";
                    const dataUrl = `data:${f.type};base64,${b64}`;
                    setMFiles((prev) => [...prev, { name: f.name, type: f.type, size: f.size, dataUrl }]);
                  } catch {
                    setMFiles((prev) => [...prev, { name: f.name, type: f.type, size: f.size }]);
                  } finally { try { (e.target as HTMLInputElement).value = ""; } catch {} }
                }} />
                <input ref={mFileInputRef} type="file" multiple className="hidden" onChange={async (e) => {
                  const list = Array.from(e.target.files || []);
                  for (const f of list) {
                    try {
                      const buf = await f.arrayBuffer();
                      const b64 = typeof window !== "undefined" ? btoa(String.fromCharCode(...new Uint8Array(buf))) : "";
                      const dataUrl = `data:${f.type};base64,${b64}`;
                      setMFiles((prev) => [...prev, { name: f.name, type: f.type, size: f.size, dataUrl }]);
                    } catch {
                      setMFiles((prev) => [...prev, { name: f.name, type: f.type, size: f.size }]);
                    }
                  }
                  try { (e.target as HTMLInputElement).value = ""; } catch {}
                }} />
              </div>
            </div>
          ) : null}
          <div className="mt-3 flex justify-end">
            {mMode !== "car" ? (
              <Button type="button" onClick={() => { saveTransportInModal(); }}>{t("saveTransport")}</Button>
            ) : (
              <Button type="button" onClick={() => { setNextOpen(false); router.push("/accommodation/search"); }}>{t("goToSummaryButton")}</Button>
            )}
          </div>
        </div>
      </Dialog>
    </div>
  );
}
