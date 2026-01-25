"use client";
import Link from "next/link";
import { useTrip } from "@/lib/trip-context";
import type { TripSearchDifferent } from "@/lib/trip-context";
import { getCountryByIata } from "@/lib/airports";
import { useRouter } from "next/navigation";
import { useMemo, useEffect, useState, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { addTrip, saveTripAttachments, updateTrip } from "@/lib/trips-db";
import { saveFromFile } from "@/lib/attachments-store";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/ui/toast";

function formatDate(d: string) { return d ?? ""; }

function totalPassengers(p: { adults?: number; children?: number; infants?: number } | number | undefined) {
  if (typeof p === "number") return p;
  const o = p ?? { adults: 1, children: 0, infants: 0 };
  return Number(o.adults ?? 0) + Number(o.children ?? 0) + Number(o.infants ?? 0);
}

function buildLinksSame(
  origin: string,
  destination: string,
  departDate: string,
  returnDate: string,
  paxObj: { adults?: number; children?: number; infants?: number } | number
) {
  const depart = formatDate(departDate);
  const ret = formatDate(returnDate);
  const adults = Math.max(1, typeof paxObj === "number" ? paxObj : Number(paxObj.adults ?? 1));
  const children = typeof paxObj === "number" ? 0 : Number(paxObj.children ?? 0);
  const infants = typeof paxObj === "number" ? 0 : Number(paxObj.infants ?? 0);
  const lang = typeof navigator !== "undefined" ? navigator.language : "";
  const region = lang.includes("-") ? lang.split("-")[1] : "";
  const gDomain = region === "BR" ? "www.google.com.br" : "www.google.com";
  const q = encodeURIComponent(`${origin} to ${destination}`);
  const google = `https://${gDomain}/travel/flights?q=${q}&d=${depart}&r=${ret}&cabin=ECONOMY&time=any&adults=${adults}`;
  const kayak = `https://www.kayak.com/flights/${origin}-${destination}/${depart}/${destination}-${origin}/${ret}?adults=${adults}&children=${children}&infants=${infants}`;
  const booking = `https://www.booking.com/flights/${origin}-${destination}/${depart}?return=${ret}&adults=${adults}`;
  const skyscannerDate = (d: string) => d.replace(/-/g, "");
  const sky = `https://www.skyscanner.com.br/transporte/voos/${origin}/${destination}/${skyscannerDate(depart)}/${skyscannerDate(ret)}/?adults=${adults}&children=${children}&infants=${infants}`;
  return [
    { name: "Google", href: google },
    { name: "Kayak", href: kayak },
    { name: "Booking", href: booking },
    { name: "Skyscanner", href: sky },
  ];
}

function buildLinksOne(
  origin: string,
  destination: string,
  date: string,
  paxObj: { adults?: number; children?: number; infants?: number } | number
) {
  const depart = formatDate(date);
  const adults = Math.max(1, typeof paxObj === "number" ? paxObj : Number(paxObj.adults ?? 1));
  const children = typeof paxObj === "number" ? 0 : Number(paxObj.children ?? 0);
  const infants = typeof paxObj === "number" ? 0 : Number(paxObj.infants ?? 0);
  const lang = typeof navigator !== "undefined" ? navigator.language : "";
  const region = lang.includes("-") ? lang.split("-")[1] : "";
  const gDomain = region === "BR" ? "www.google.com.br" : "www.google.com";
  const q = encodeURIComponent(`${origin} to ${destination}`);
  const google = `https://${gDomain}/travel/flights?q=${q}&d=${depart}&cabin=ECONOMY&time=any&adults=${adults}`;
  const kayak = `https://www.kayak.com/flights/${origin}-${destination}/${depart}?adults=${adults}&children=${children}&infants=${infants}`;
  const booking = `https://www.booking.com/flights/${origin}-${destination}/${depart}?adults=${adults}`;
  const skyscannerDate = (d: string) => d.replace(/-/g, "");
  const sky = `https://www.skyscanner.com.br/transporte/voos/${origin}/${destination}/${skyscannerDate(depart)}/?adults=${adults}&children=${children}&infants=${infants}`;
  return [
    { name: "Google", href: google },
    { name: "Kayak", href: kayak },
    { name: "Booking", href: booking },
    { name: "Skyscanner", href: sky },
  ];
}

 

export default function BookFlightsPage() {
  const { tripSearch, setTripSearch } = useTrip();
  const router = useRouter();
  const { t } = useI18n();
  const { show, minimize } = useToast();
  const [hydrated, setHydrated] = useState(false);
  const [loadingTrip, setLoadingTrip] = useState(true);
  const [guide, setGuide] = useState<"aggregators" | "notes" | null>("aggregators");
  const [countries, setCountries] = useState<{ origin?: string; destination?: string; originIn?: string; destinationIn?: string; userRegion?: string }>({});
  const [noteOpen, setNoteOpen] = useState(false);
  const [arrivalNoteOpen, setArrivalNoteOpen] = useState(false);
  const [introShown, setIntroShown] = useState(false);
  const noteText = useMemo(() => {
    const c = countries.destination ?? "";
    const mercosul = [
      "Argentina",
      "Uruguay",
      "Paraguay",
      "Chile",
      "Bolivia",
      "Peru",
      "Colombia",
      "Ecuador",
      "Venezuela",
    ];
    if (!c) {
      return {
        title: t("docInternationalTitle"),
        lines: [t("docInternationalLine1"), t("docInternationalLine2"), t("docInternationalLine3")],
      };
    }
    if (c === "Brazil") {
      return {
        title: t("docBrazilTitle"),
        lines: [t("docBrazilLine1"), t("docBrazilLine2")],
      };
    }
    if (mercosul.includes(c)) {
      return {
        title: `${t("docMercosurTitle")} (${c})`,
        lines: [t("docMercosurLine1"), t("docMercosurLine2"), t("docMercosurLine3")],
      };
    }
    return {
      title: `${t("docInternationalTitle")} (${c})`,
      lines: [t("docInternationalLine1"), t("docInternationalLine2"), t("docInternationalLine3")],
    };
  }, [countries.destination, t]);

  useEffect(() => { setHydrated(true); }, []);
  useEffect(() => {
    let stopped = false;
    const tryOnce = () => {
      try {
        if (typeof window === "undefined") return false;
        const rawS = sessionStorage.getItem("calentrip:tripSearch");
        const rawL = !rawS ? localStorage.getItem("calentrip:tripSearch") : null;
        const raw = rawS || rawL;
        if (raw) { setTripSearch(JSON.parse(raw)); return true; }
      } catch {}
      return false;
    };
    if (!tripSearch) {
      if (tryOnce()) { setLoadingTrip(false); return; }
      let tries = 0;
      const id = setInterval(() => {
        if (stopped) { clearInterval(id); return; }
        tries++;
        if (tryOnce() || tries >= 8) { clearInterval(id); setLoadingTrip(false); }
      }, 100);
      return () => { stopped = true; try { clearInterval(id); } catch {} };
    } else {
      setLoadingTrip(false);
    }
  }, [tripSearch, setTripSearch]);

  const data = useMemo(() => {
    if (!tripSearch) return null;
    if (tripSearch.mode !== "same") return null;
    const links = buildLinksSame(
      tripSearch.origin,
      tripSearch.destination,
      tripSearch.departDate,
      tripSearch.returnDate,
      tripSearch.passengers as { adults?: number; children?: number; infants?: number } | number
    );
    return { pax: totalPassengers(tripSearch.passengers), links };
  }, [tripSearch]);

  useEffect(() => {
    if (!hydrated || loadingTrip || introShown) return;
    if (!tripSearch) return;
    if (tripSearch.mode === "same") {
      const id = show(t("bookIntroSame"), { variant: "info", sticky: true, key: "book-intro" });
      setTimeout(() => { try { minimize(id); } catch {} }, 20000);
    } else {
      const id = show(t("bookIntroDifferent"), { variant: "info", sticky: true, key: "book-intro" });
      setTimeout(() => { try { minimize(id); } catch {} }, 20000);
    }
    setIntroShown(true);
  }, [hydrated, loadingTrip, tripSearch, introShown, show, minimize, t]);

 

  useEffect(() => {
    (async () => {
      if (!tripSearch) return;
      try {
        const originIata = tripSearch.mode === "same" ? tripSearch.origin : tripSearch.outbound.origin;
        const destIata = tripSearch.mode === "same" ? tripSearch.destination : tripSearch.outbound.destination;
        const originCountry = await getCountryByIata(originIata);
        const destinationCountry = await getCountryByIata(destIata);
        let originInCountry: string | null = null;
        let destinationInCountry: string | null = null;
        if (tripSearch.mode === "different") {
          originInCountry = await getCountryByIata(tripSearch.inbound.origin);
          destinationInCountry = await getCountryByIata(tripSearch.inbound.destination);
        }
        const lang = typeof navigator !== "undefined" ? navigator.language : "";
        const region = lang.includes("-") ? lang.split("-")[1] : "";
        setCountries({ origin: originCountry ?? undefined, destination: destinationCountry ?? undefined, originIn: originInCountry ?? undefined, destinationIn: destinationInCountry ?? undefined, userRegion: region });
      } catch {}
    })();
  }, [tripSearch]);

  
  

  return (
    <div className="min-h-screen px-4 py-6 space-y-6">
      <div className="container-page">
        <h1 className="mb-1 text-2xl font-semibold text-[var(--brand)]">{t("bookFlightsTitle")}</h1>
        <p className="mb-4 text-sm text-zinc-600">{t("bookFlightsSubtitle")}</p>
      </div>

      <div className="container-page">
        <Card className={guide === "aggregators" ? "ring-4 ring-amber-500 pulse-ring" : undefined}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base">travel_explore</span>
                <span>{t("bookLinksAggregators")}</span>
              </CardTitle>
              <button
                type="button"
                aria-label={t("travelDocsNoteAria")}
                className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-zinc-300 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200"
                onMouseEnter={() => setNoteOpen(true)}
                onMouseLeave={() => setNoteOpen(false)}
                onFocus={() => setNoteOpen(true)}
                onBlur={() => setNoteOpen(false)}
                onTouchStart={() => setNoteOpen(true)}
                onTouchEnd={() => setNoteOpen(false)}
                onClick={() => { const msg = `${noteText.title} • ${noteText.lines.join(" • ")}`; show(msg); }}
              >
                <span className="material-symbols-outlined text-[16px]">info</span>
              </button>
              <button
                type="button"
                aria-label={t("arrivalTipAria")}
                className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-zinc-300 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200"
                onMouseEnter={() => setArrivalNoteOpen(true)}
                onMouseLeave={() => setArrivalNoteOpen(false)}
                onFocus={() => setArrivalNoteOpen(true)}
                onBlur={() => setArrivalNoteOpen(false)}
                onTouchStart={() => setArrivalNoteOpen(true)}
                onTouchEnd={() => setArrivalNoteOpen(false)}
                onClick={() => {
                  const msg = `${t("arrivalTipTitle")}: ${t("arrivalTipLine")} • ${t("arrivalTipLine2")}`;
                  show(msg);
                }}
              >
                <span className="material-symbols-outlined text-[16px]">info</span>
              </button>
            </div>
            {noteOpen && (
              <div className="relative">
                <div className="absolute left-0 top-2 mt-2 w-[28rem] max-w-[90vw] rounded-md border border-zinc-200 bg-white p-3 text-sm shadow-lg dark:border-zinc-800 dark:bg-black">
                  <div className="font-medium">{noteText.title}</div>
                  {noteText.lines.map((l, i) => (
                    <div key={i} className="mt-1 text-zinc-700 dark:text-zinc-200">{l}</div>
                  ))}
                  <div className="mt-2 text-xs text-zinc-500">{t("docDisclaimer")}</div>
                </div>
              </div>
            )}
            {arrivalNoteOpen && (
              <div className="relative">
                <div className="absolute left-0 top-2 mt-2 w-[28rem] max-w-[90vw] rounded-md border border-zinc-200 bg-white p-3 text-sm shadow-lg dark:border-zinc-800 dark:bg-black">
                  <div className="font-medium">{t("arrivalTipTitle")}</div>
                  <div className="mt-1 text-zinc-700 dark:text-zinc-200">{t("arrivalTipLine")}</div>
                  <div className="mt-1 text-zinc-700 dark:text-zinc-200">{t("arrivalTipLine2")}</div>
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {tripSearch && tripSearch.mode === "same" && data ? (
              <ul className="space-y-1">
                {data.links.map((item) => (
                  <li key={item.name} className="flex items-center gap-1">
                    <Link className="underline text-[13px]" href={item.href} target="_blank" rel="noopener noreferrer" onClick={() => { show(t("openingLink")); if (guide === "aggregators") setGuide("notes"); }}>
                      {item.name}
                    </Link>
                    {item.name === "Google" ? (
                      <button
                        type="button"
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                        title={t("googleFlightsDateNoteShort")}
                        aria-label={t("googleFlightsDateNoteShort")}
                        onClick={() => show(t("googleFlightsDateNote"), { variant: "info" })}
                        onTouchStart={() => show(t("googleFlightsDateNote"), { variant: "info" })}
                      >
                        <span className="material-symbols-outlined text-[12px]">info</span>
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : tripSearch && tripSearch.mode === "different" ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  {(() => { const ts = tripSearch as TripSearchDifferent; return (
                    <div className="mb-2">
                      <div className="inline-flex items-center gap-2 rounded-md px-2 py-1 border border-[#febb02] bg-[#febb02]/10 text-[#febb02]">
                        <span className="text-xs font-semibold">{t("outboundFlight")}</span>
                        <span className="text-sm font-semibold">{ts.outbound.origin}/{ts.outbound.destination}</span>
                        <span className="text-xs font-medium">• {formatDate(ts.outbound.date)}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400">{t("linksPreFilledOneWay")}</div>
                    </div>
                  ); })()}
                  <ul className="space-y-1">
                    {(() => { const ts = tripSearch as TripSearchDifferent; return buildLinksOne(ts.outbound.origin, ts.outbound.destination, ts.outbound.date, ts.passengers); })().map((item) => (
                      <li key={`out-${item.name}`} className="flex items-center gap-1">
                        <Link className="underline text-[13px]" href={item.href} target="_blank" rel="noopener noreferrer" onClick={() => { show(t("openingLink")); if (guide === "aggregators") setGuide("notes"); }}>
                          {item.name}
                        </Link>
                        {item.name === "Google" ? (
                          <button
                            type="button"
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                            title={t("googleFlightsDateNoteShort")}
                            aria-label={t("googleFlightsDateNoteShort")}
                            onClick={() => show(t("googleFlightsDateNote"), { variant: "info" })}
                            onTouchStart={() => show(t("googleFlightsDateNote"), { variant: "info" })}
                          >
                            <span className="material-symbols-outlined text-[12px]">info</span>
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  {(() => { const ts = tripSearch as TripSearchDifferent; return (
                    <div className="mb-2">
                      <div className="inline-flex items-center gap-2 rounded-md px-2 py-1 border border-[#febb02] bg-[#febb02]/10 text-[#febb02]">
                        <span className="text-xs font-semibold">{t("inboundFlight")}</span>
                        <span className="text-sm font-semibold">{ts.inbound.origin}/{ts.inbound.destination}</span>
                        <span className="text-xs font-medium">• {formatDate(ts.inbound.date)}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400">{t("linksPreFilledOneWay")}</div>
                    </div>
                  ); })()}
                  <ul className="space-y-1">
                    {(() => { const ts = tripSearch as TripSearchDifferent; return buildLinksOne(ts.inbound.origin, ts.inbound.destination, ts.inbound.date, ts.passengers); })().map((item) => (
                      <li key={`in-${item.name}`} className="flex items-center gap-1">
                        <Link className="underline text-[13px]" href={item.href} target="_blank" rel="noopener noreferrer" onClick={() => { show(t("openingLink")); if (guide === "aggregators") setGuide("notes"); }}>
                          {item.name}
                        </Link>
                        {item.name === "Google" ? (
                          <button
                            type="button"
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                            title={t("googleFlightsDateNoteShort")}
                            aria-label={t("googleFlightsDateNoteShort")}
                            onClick={() => show(t("googleFlightsDateNote"), { variant: "info" })}
                            onTouchStart={() => show(t("googleFlightsDateNote"), { variant: "info" })}
                          >
                            <span className="material-symbols-outlined text-[12px]">info</span>
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="text-sm text-zinc-600">{t("bookLinksDifferentMode")}</div>
            )}
          </CardContent>
        </Card>

      </div>
      <div className="container-page">
        <Card>
          <CardHeader>
            <CardTitle>{t("flightNotesTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {!hydrated ? (
              <div className="text-sm text-zinc-600">{t("loadingSearch")}</div>
            ) : !tripSearch ? (
              <div className="flex items-center justify-between">
                <div className="text-sm text-zinc-600">{t("noTrips")}</div>
                <Button type="button" onClick={() => router.push("/flights/search")}>{t("searchFlights")}</Button>
              </div>
            ) : (
              <FlightNotesForm onProceed={() => setGuide(null)} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FlightNotesForm({ onProceed }: { onProceed?: () => void }) {
  const { tripSearch, setTripSearch } = useTrip();
  const { t } = useI18n();
  const router = useRouter();
  const { show, dismiss } = useToast();
  const [locatorInfoOpen, setLocatorInfoOpen] = useState(false);
  const [activeLeg, setActiveLeg] = useState<0 | 1>(0);
  const [proceedPulse, setProceedPulse] = useState(false);
  const [infoShown, setInfoShown] = useState(false);
  const [hintId, setHintId] = useState<number | null>(null);
  const proceedLockRef = useRef(false);
  const [proceeding, setProceeding] = useState(false);
  const openLocatorInfo = () => setLocatorInfoOpen(true);
  const closeLocatorInfo = () => setLocatorInfoOpen(false);
  function fmtTime(v: string) {
    const s = v.replace(/\D/g, "").slice(0, 4);
    if (!s) return "";
    if (s.length <= 2) return s;
    return `${s.slice(0, 2)}:${s.slice(2)}`;
  }
  const legs = useMemo(() => {
    if (!tripSearch) return [] as { title: string; origin: string; destination: string; date: string }[];
    if (tripSearch.mode === "same") {
      return [
        { title: t("outboundFlight"), origin: tripSearch.origin, destination: tripSearch.destination, date: tripSearch.departDate },
        { title: t("inboundFlight"), origin: tripSearch.destination, destination: tripSearch.origin, date: tripSearch.returnDate },
      ];
    }
    return [
      { title: t("outboundFlight"), origin: tripSearch.outbound.origin, destination: tripSearch.outbound.destination, date: tripSearch.outbound.date },
      { title: t("inboundFlight"), origin: tripSearch.inbound.origin, destination: tripSearch.inbound.destination, date: tripSearch.inbound.date },
    ];
  }, [tripSearch, t]);
  const initial = useMemo(() => {
    if (!tripSearch) return [{ dep: "", arr: "", code: "" }, { dep: "", arr: "", code: "" }];
    if (tripSearch.mode === "same") {
      return [
        { dep: tripSearch.departTime ?? "", arr: "", code: tripSearch.departFlightNumber ?? "" },
        { dep: tripSearch.returnTime ?? "", arr: "", code: tripSearch.returnFlightNumber ?? "" },
      ];
    }
    return [
      { dep: tripSearch.outbound.time ?? "", arr: "", code: tripSearch.outbound.flightNumber ?? "" },
      { dep: tripSearch.inbound.time ?? "", arr: "", code: tripSearch.inbound.flightNumber ?? "" },
    ];
  }, [tripSearch]);
  const [notes, setNotes] = useState(initial);
  const [files, setFiles] = useState([[], []] as Array<Array<{ name: string; type: string; size: number; id?: string; dataUrl?: string }>>);
  const [nextDay, setNextDay] = useState<[boolean, boolean]>([false, false]);
  const [arrivalWarnShown, setArrivalWarnShown] = useState<[boolean, boolean]>([false, false]);
  const [noteAnim, setNoteAnim] = useState<{ maxH: number; transition: string }>(() => {
    try {
      const mobile = typeof window !== "undefined" && window.matchMedia("(max-width: 480px)").matches;
      return { maxH: mobile ? 160 : 240, transition: mobile ? "opacity 200ms ease-out, max-height 200ms ease-out" : "opacity 250ms ease-out, max-height 250ms ease-out" };
    } catch {
      return { maxH: 240, transition: "opacity 250ms ease-out, max-height 250ms ease-out" };
    }
  });
  const [attachLeg, setAttachLeg] = useState<0 | 1 | null>(null);
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
  function toMinutes(s: string): number {
    const m = (s || "").trim();
    const parts = m.split(":");
    const h = Number(parts[0] || 0);
    const mm = Number(parts[1] || 0);
    return h * 60 + mm;
  }
  const invalidLeg = (i: number) => {
    const dep = notes[i]?.dep || "";
    const arr = notes[i]?.arr || "";
    if (!dep || !arr) return false;
    return toMinutes(arr) < toMinutes(dep) && !nextDay[i as 0 | 1];
  };
  const legDepFilled = (i: number) => Boolean(notes[i]?.dep);
  const canProceed = legDepFilled(0);

  useEffect(() => {
    try {
      if (!tripSearch) return;
      if (tripSearch.mode === "same") {
        const next = {
          ...tripSearch,
          departTime: (notes[0]?.dep || ""),
          returnTime: (notes[1]?.dep || ""),
          departFlightNumber: (notes[0]?.code || ""),
          returnFlightNumber: (notes[1]?.code || ""),
        };
        setTripSearch(next);
      } else {
        const next = {
          ...tripSearch,
          outbound: { ...(tripSearch.outbound || {}), time: (notes[0]?.dep || ""), flightNumber: (notes[0]?.code || "") },
          inbound: { ...(tripSearch.inbound || {}), time: (notes[1]?.dep || ""), flightNumber: (notes[1]?.code || "") },
        };
        setTripSearch(next);
      }
    } catch {}
  }, [notes, tripSearch, setTripSearch]);

  function proceedOnce() {
    if (proceedLockRef.current || proceeding) return;
    proceedLockRef.current = true;
    setProceeding(true);
    save();
    setTimeout(() => { proceedLockRef.current = false; setProceeding(false); }, 2000);
  }

  async function save() {
    if (!tripSearch) return;
    const passengers = totalPassengers(tripSearch.passengers);
    const first = legs[0];
    const id = String(Date.now());
    const title = `${first.origin} → ${first.destination}`;
    const date = first.date;
    const flightNotes = legs.map((l, i) => ({
      leg: (i === 0 ? "outbound" : "inbound") as "outbound" | "inbound",
      origin: l.origin,
      destination: l.destination,
      date: l.date,
      departureTime: notes[i]?.dep || undefined,
      arrivalTime: notes[i]?.arr || undefined,
      flightNumber: notes[i]?.code || undefined,
      arrivalNextDay: nextDay[i as 0 | 1] || undefined,
    }));
    const attachments = legs.flatMap((l, i) => (files[i] || []).map((f) => ({ leg: (i === 0 ? "outbound" : "inbound") as "outbound" | "inbound", name: f.name, type: f.type, size: f.size, id: f.id, dataUrl: f.dataUrl })));
    // Navegar primeiro; persistir em background para evitar travas do WebView
    show(t("notesSavedRedirecting"), { variant: "success" });
    try { onProceed?.(); } catch {}
    try { if (typeof window !== "undefined") localStorage.setItem("calentrip:targetRoute", "/accommodation/search"); } catch {}
    try {
      router.push("/accommodation/search");
      if (typeof window !== "undefined") {
        const attempts = [100, 240, 600, 1200, 2000];
        attempts.forEach((ms) => {
          setTimeout(() => {
            try {
              const stillHere = !window.location.pathname.includes("/accommodation/search");
              if (stillHere) {
                router.replace("/accommodation/search");
                try {
                  const isNative = Capacitor.isNativePlatform && Capacitor.isNativePlatform();
                  if (isNative) {
                    router.push("/");
                    setTimeout(() => { try { router.replace("/accommodation/search"); } catch {} }, 180);
                  }
                } catch {}
              }
            } catch {}
          }, ms);
        });
      }
    } catch {}
    // Persistência em segundo plano
    setTimeout(() => {
      try { addTrip({ id, title, date, passengers, flightNotes }).catch(() => {}); } catch {}
      try { saveTripAttachments(id, attachments.map((a) => ({ leg: a.leg, name: a.name, type: a.type, size: a.size, id: a.id || "" }))).catch(() => {}); } catch {}
      try { updateTrip(id, { reachedFinalCalendar: true }).catch(() => {}); } catch {}
    }, 0);
    try {
      const isSame = (tripSearch.mode === "same");
      const dest = isSame ? tripSearch.destination : (tripSearch.inbound?.destination || tripSearch.outbound?.destination || "");
      const departDate = isSame ? (tripSearch.departDate || "") : (tripSearch.outbound?.date || "");
      const returnDate = isSame ? (tripSearch.returnDate || "") : (tripSearch.inbound?.date || "");
      const bump = nextDay[0] ? 1 : 0;
      const addDays = (d: string, days: number) => {
        const dt = new Date(`${(d || "").replace(/\//g, "-")}T00:00:00`);
        if (Number.isNaN(dt.getTime())) return d || "";
        dt.setDate(dt.getDate() + days);
        const p = (n: number) => String(n).padStart(2, "0");
        return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
      };
      const checkin = bump ? addDays(departDate, bump) : departDate;
      const summary = { cities: [{ name: dest || "", checkin, checkout: returnDate || "", address: "" }] };
      if (typeof window !== "undefined") localStorage.setItem("calentrip_trip_summary", JSON.stringify(summary));
    } catch {}
    if (hintId != null) {
      try { dismiss(hintId); } catch {}
    }
    try {
      if (typeof window !== "undefined" && tripSearch) {
        const s = JSON.stringify(tripSearch);
        localStorage.setItem("calentrip:tripSearch", s);
        try { sessionStorage.setItem("calentrip:tripSearch", s); } catch {}
      }
    } catch {}
    try { if (typeof window !== "undefined") localStorage.setItem("calentrip:targetRoute", "/accommodation/search"); } catch {}
    try {} catch {}
  }

  return (
    <div className="space-y-4">
      {legs.map((l, i) => (
        <div key={`${l.title}-${i}`} className={(activeLeg === i ? "ring-4 ring-amber-500 pulse-ring " : "") + "rounded-lg border p-3"}>
          <div className="mb-2 text-sm font-semibold">{l.title} • {l.origin} → {l.destination} • {l.date}</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm">{t("departureTime")}</label>
              <Input
                placeholder=""
                value={notes[i]?.dep ?? ""}
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                onChange={(e) => {
                  const v = fmtTime(e.target.value);
                  setNotes((prev) => prev.map((x, idx) => (idx === i ? { ...x, dep: v } : x)));
                }}
                onFocus={() => {
                  setActiveLeg(i as 0 | 1);
                  setProceedPulse(i === 1);
                  if (!infoShown) { const id = show(t("enterFlightTimesHint"), { duration: 15000 }); setHintId(id); setInfoShown(true); }
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm">{t("arrivalTime")}</label>
              <Input
                placeholder=""
                value={notes[i]?.arr ?? ""}
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                onChange={(e) => {
                  const v = fmtTime(e.target.value);
                  setNotes((prev) => prev.map((x, idx) => (idx === i ? { ...x, arr: v } : x)));
                  try {
                    const dep = notes[i]?.dep || "";
                    const arr = v || "";
                    const warnAlready = arrivalWarnShown[i as 0 | 1];
                    if (dep && arr && arr.length === 5 && toMinutes(arr) < toMinutes(dep) && !nextDay[i as 0 | 1] && !warnAlready) {
                      show(t("arrivalNextDayAsk"));
                      setArrivalWarnShown((prev) => (i === 0 ? [true, prev[1]] : [prev[0], true]));
                    }
                  } catch {}
                }}
                onFocus={() => {
                  setActiveLeg(i as 0 | 1);
                  setProceedPulse(i === 1);
                  if (!infoShown) { const id = show(t("enterFlightTimesHint"), { duration: 15000 }); setHintId(id); setInfoShown(true); }
                }}
              />
              {invalidLeg(i) && (
                <div className="mt-1 text-xs text-red-600">{t("arrivalNextDayWarn")}</div>
              )}
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="block text-sm">{t("flightNumberOptional")}</label>
                <button
                  type="button"
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                  title={t("locatorInfoTitle")}
                  aria-label={t("locatorInfoTitle")}
                  onClick={openLocatorInfo}
                  onTouchStart={openLocatorInfo}
                >
                  <span className="material-symbols-outlined text-[12px]">info</span>
                </button>
              </div>
              <Input
                placeholder=""
                value={notes[i]?.code ?? ""}
                inputMode="text"
                type="text"
                onChange={(e) => {
                  const v = e.target.value;
                  setNotes((prev) => prev.map((x, idx) => (idx === i ? { ...x, code: v } : x)));
                }}
                onFocus={() => {
                  setActiveLeg(i as 0 | 1);
                  setProceedPulse(i === 1);
                  if (!infoShown) { const id = show(t("enterFlightTimesHint"), { duration: 15000 }); setHintId(id); setInfoShown(true); }
                }}
              />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              id={`nextday-${i}`}
              type="checkbox"
              checked={nextDay[i as 0 | 1]}
              onChange={(e) => {
                const checked = e.target.checked;
                setNextDay((prev) => (i === 0 ? [checked, prev[1]] : [prev[0], checked]));
                try {
                  if (i === 0) localStorage.setItem("calentrip:arrivalNextDay_outbound", String(checked));
                  if (i === 1) localStorage.setItem("calentrip:arrivalNextDay_inbound", String(checked));
                } catch {}
              }}
                onFocus={() => {
                  setActiveLeg(i as 0 | 1);
                  setProceedPulse(i === 1);
                  if (!infoShown) { const id = show(t("enterFlightTimesHint"), { duration: 15000 }); setHintId(id); setInfoShown(true); }
                }}
              />
            <label htmlFor={`nextday-${i}`} className="text-sm">{t("arrivalNextDayLabel")}</label>
          </div>
          <div
            className="mt-2 flex items-start gap-2 rounded-md border border-amber-500 bg-amber-50 p-2 text-xs text-amber-900"
            style={{ maxHeight: nextDay[i as 0 | 1] ? noteAnim.maxH : 0, opacity: nextDay[i as 0 | 1] ? 1 : 0, transition: noteAnim.transition, overflow: "hidden" }}
            aria-hidden={!nextDay[i as 0 | 1]}
          >
            <span className="material-symbols-outlined text-amber-700">warning</span>
            <span>{t("arrivalNextDayHelp")}</span>
          </div>
          <div className="mt-3">
            <input
              id={`file-photo-${i}`}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={(e) => {
                const list = Array.from(e.target.files ?? []);
                Promise.all(list.map(async (f) => {
                  const saved = await saveFromFile(f);
                  return { name: saved.name, type: saved.type, size: saved.size, id: saved.id };
                })).then((items) => {
                  setFiles((prev) => prev.map((arr, idx) => (idx === i ? items : arr)));
                });
              }}
              onFocus={() => {
                setActiveLeg(i as 0 | 1);
                setProceedPulse(i === 1);
                if (!infoShown) { const id = show(t("enterFlightTimesHint"), { duration: 15000 }); setHintId(id); setInfoShown(true); }
              }}
            />
            <input
              id={`file-gallery-${i}`}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const list = Array.from(e.target.files ?? []);
                Promise.all(list.map(async (f) => {
                  const saved = await saveFromFile(f);
                  return { name: saved.name, type: saved.type, size: saved.size, id: saved.id };
                })).then((items) => {
                  setFiles((prev) => prev.map((arr, idx) => (idx === i ? items : arr)));
                });
              }}
              onFocus={() => {
                setActiveLeg(i as 0 | 1);
                setProceedPulse(i === 1);
                if (!infoShown) { const id = show(t("enterFlightTimesHint"), { duration: 15000 }); setHintId(id); setInfoShown(true); }
              }}
            />
            <input
              id={`file-doc-${i}`}
              type="file"
              accept="application/pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                const list = Array.from(e.target.files ?? []);
                Promise.all(list.map(async (f) => {
                  const saved = await saveFromFile(f);
                  return { name: saved.name, type: saved.type, size: saved.size, id: saved.id };
                })).then((items) => {
                  setFiles((prev) => prev.map((arr, idx) => (idx === i ? items : arr)));
                });
              }}
              onFocus={() => {
                setActiveLeg(i as 0 | 1);
                setProceedPulse(i === 1);
                if (!infoShown) { const id = show(t("enterFlightTimesHint"), { duration: 15000 }); setHintId(id); setInfoShown(true); }
              }}
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                className="px-2 py-1 text-xs rounded-md gap-1"
                onClick={() => {
                  try {
                    setActiveLeg(i as 0 | 1);
                    setProceedPulse(i === 1);
                    setAttachLeg(i as 0 | 1);
                  } catch {}
                }}
              >
                <span className="material-symbols-outlined text-[16px]">attach_file</span>
                <span>{t("attachProofButton")}</span>
              </Button>
              <span className="text-[10px] text-zinc-600">{t("attachProofHelp")}</span>
            </div>
            {files[i]?.length ? (
              <ul className="mt-2 text-xs text-zinc-700 dark:text-zinc-300">
                {files[i].map((f, idx) => (
                  <li key={`${f.name}-${idx}`}>{f.name} • {Math.round(f.size / 1024)} KB</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ))}
      <div className="flex justify-end">
        <Button
          type="button"
          role="button"
          disabled={!canProceed || proceeding}
          onClick={proceedOnce}
          onTouchStart={proceedOnce}
          onTouchEnd={proceedOnce}
          onPointerUp={proceedOnce}
          className={(proceedPulse ? "ring-4 ring-amber-500 pulse-ring " : "") + "relative z-[1001] pointer-events-auto"}
          style={{ touchAction: "manipulation" }}
        >
          {proceeding ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 rounded-full border-2 border-zinc-300 border-t-[var(--brand)] animate-spin" aria-label={t("loading")} />
              <span>{t("proceedToAccommodation")}</span>
            </span>
          ) : (
            t("proceedToAccommodation")
          )}
        </Button>
      </div>
      <Dialog open={locatorInfoOpen} onOpenChange={setLocatorInfoOpen} placement="bottom">
        <DialogHeader>{t("locatorInfoTitle")}</DialogHeader>
        <div className="space-y-2 text-sm">
          <p>{t("locatorInfoText")}</p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={closeLocatorInfo}>{t("close")}</Button>
        </DialogFooter>
      </Dialog>
      <Dialog open={attachLeg != null} onOpenChange={(o) => { if (!o) setAttachLeg(null); }} placement="bottom">
        <DialogHeader>{t("attachProofButton")}</DialogHeader>
        <div className="space-y-2 text-sm">
          <div className="flex flex-col gap-2">
            <Button type="button" variant="outline" className="justify-start" onClick={() => { try { const id = attachLeg as 0 | 1; setAttachLeg(null); document.getElementById(`file-photo-${id}`)?.click(); } catch {} }}>Câmera</Button>
            <Button type="button" variant="outline" className="justify-start" onClick={() => { try { const id = attachLeg as 0 | 1; setAttachLeg(null); document.getElementById(`file-gallery-${id}`)?.click(); } catch {} }}>Fotos/Galeria</Button>
            <Button type="button" variant="outline" className="justify-start" onClick={() => { try { const id = attachLeg as 0 | 1; setAttachLeg(null); document.getElementById(`file-doc-${id}`)?.click(); } catch {} }}>Documento (PDF)</Button>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setAttachLeg(null)}>{t("close")}</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
