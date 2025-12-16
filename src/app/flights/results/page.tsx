"use client";
import { useMemo, useState, useEffect } from "react";
import { useTrip } from "@/lib/trip-context";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableCell, TableBody } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CalendarInput } from "@/components/ui/calendar";
import Link from "next/link";
import { addTrip } from "@/lib/trips-store";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { Select } from "@/components/ui/select";
import PassengerSelector from "@/components/passenger-selector";
import { useToast } from "@/components/ui/toast";

function buildLinks(origin: string, destination: string, date: string, passengers: number) {
  const lang = typeof navigator !== "undefined" ? navigator.language : "";
  const region = lang.includes("-") ? lang.split("-")[1] : "";
  const gDomain = region === "BR" ? "www.google.com.br" : "www.google.com";
  const q = encodeURIComponent(`${origin} to ${destination}`);
  return [
    { name: "Google Flights", href: `https://${gDomain}/travel/flights?q=${q}&d=${date}&cabin=ECONOMY&time=any&adults=${passengers}` },
    { name: "Kayak", href: `https://www.kayak.com/flights/${origin}-${destination}/${date}?adults=${passengers}` },
    { name: "Booking", href: `https://www.booking.com/flights/${origin}-${destination}/${date}?adults=${passengers}` },
    { name: "Viajanet", href: `https://www.viajanet.com.br/busca?origin=${origin}&destination=${destination}&date=${date}&adults=${passengers}` },
  ];
}

export default function FlightsResultsPage() {
  const { tripSearch, setTripSearch } = useTrip();
  const router = useRouter();
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const { t } = useI18n();
  const { show } = useToast();
  const todayISO = (() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  })();

  const [noteOpenIdx, setNoteOpenIdx] = useState<number | null>(null);
  const [destCountries, setDestCountries] = useState<Record<number, string>>({});

  function normalizePassengers(p: unknown) {
    if (typeof p === "number") return { adults: p, children: 0, infants: 0 };
    if (p && typeof p === "object") {
      const o = p as { adults?: number; children?: number; infants?: number };
      return { adults: Number(o.adults ?? 1), children: Number(o.children ?? 0), infants: Number(o.infants ?? 0) };
    }
    return { adults: 1, children: 0, infants: 0 };
  }

  function setModeValue(v: "same" | "different") {
    if (!tripSearch) return;
    if (v === tripSearch.mode) return;
    if (v === "same") {
      const origin = tripSearch.mode === "different" ? tripSearch.outbound.origin ?? "" : tripSearch.origin ?? "";
      const destination = tripSearch.mode === "different" ? tripSearch.outbound.destination ?? "" : tripSearch.destination ?? "";
      const departDate = tripSearch.mode === "different" ? tripSearch.outbound.date ?? "" : tripSearch.departDate ?? "";
      const returnDate = tripSearch.mode === "different" ? tripSearch.inbound.date ?? "" : tripSearch.returnDate ?? "";
      setTripSearch({ mode: "same", origin, destination, departDate, returnDate, passengers: normalizePassengers(tripSearch.passengers as unknown) });
    } else {
      const outbound = {
        origin: tripSearch.mode === "same" ? tripSearch.origin ?? "" : tripSearch.outbound.origin ?? "",
        destination: tripSearch.mode === "same" ? tripSearch.destination ?? "" : tripSearch.outbound.destination ?? "",
        date: tripSearch.mode === "same" ? tripSearch.departDate ?? "" : tripSearch.outbound.date ?? "",
      };
      const inbound = {
        origin: tripSearch.mode === "same" ? tripSearch.destination ?? "" : tripSearch.inbound.origin ?? "",
        destination: tripSearch.mode === "same" ? tripSearch.origin ?? "" : tripSearch.inbound.destination ?? "",
        date: tripSearch.mode === "same" ? tripSearch.returnDate ?? "" : tripSearch.inbound.date ?? "",
      };
      setTripSearch({ mode: "different", outbound, inbound, passengers: normalizePassengers(tripSearch.passengers as unknown) });
    }
  }

  function paxCount(p: unknown) {
    if (typeof p === "number") return p;
    if (p && typeof p === "object") {
      const o = p as { adults?: number; children?: number; infants?: number };
      return Number(o.adults ?? 0) + Number(o.children ?? 0) + Number(o.infants ?? 0);
    }
    return 0;
  }

  function isValid(ts: typeof tripSearch) {
    if (!ts) return false;
    if (paxCount(ts.passengers) < 1) return false;
    if (ts.mode === "same") {
      return Boolean(ts.origin && ts.destination && ts.departDate && ts.returnDate);
    }
    return Boolean(ts.outbound.origin && ts.outbound.destination && ts.outbound.date && ts.inbound.origin && ts.inbound.destination && ts.inbound.date);
  }

  const summary = useMemo(() => {
    if (!tripSearch) return null;
    if (tripSearch.mode === "same") {
      return {
        legs: [
          { title: `${t("outboundFlight")}: ${tripSearch.origin} -> ${tripSearch.destination}`, origin: tripSearch.origin, destination: tripSearch.destination, date: tripSearch.departDate },
          { title: `${t("inboundFlight")}: ${tripSearch.destination} -> ${tripSearch.origin}`, origin: tripSearch.destination, destination: tripSearch.origin, date: tripSearch.returnDate },
        ],
        passengers: paxCount(tripSearch.passengers as unknown),
      };
    }
    return {
      legs: [
        { title: `${t("outboundFlight")}: ${tripSearch.outbound.origin} -> ${tripSearch.outbound.destination}`, origin: tripSearch.outbound.origin, destination: tripSearch.outbound.destination, date: tripSearch.outbound.date },
        { title: `${t("inboundFlight")}: ${tripSearch.inbound.origin} -> ${tripSearch.inbound.destination}`, origin: tripSearch.inbound.origin, destination: tripSearch.inbound.destination, date: tripSearch.inbound.date },
      ],
      passengers: paxCount(tripSearch.passengers as unknown),
    };
  }, [tripSearch, t]);

  function fmtTime(v: string) {
    const s = (v || "").replace(/\D/g, "").slice(0, 4);
    if (!s) return "";
    if (s.length <= 2) return s;
    return `${s.slice(0, 2)}:${s.slice(2)}`;
  }
  function toMinutes(s: string): number {
    const m = (s || "").trim();
    const parts = m.split(":");
    const h = Number(parts[0] || 0);
    const mm = Number(parts[1] || 0);
    return h * 60 + mm;
  }
  const [arrivalTimes, setArrivalTimes] = useState<[string, string]>(["", ""]);
  const [arrivalNextDay, setArrivalNextDay] = useState<[boolean, boolean]>([false, false]);
  const [arrivalWarnShown, setArrivalWarnShown] = useState<[boolean, boolean]>([false, false]);
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

  useEffect(() => {
    (async () => {
      if (!summary) return;
      try {
        const { getCountryByIata } = await import("@/lib/airports");
        const map: Record<number, string> = {};
        for (let i = 0; i < summary.legs.length; i++) {
          const c = await getCountryByIata(summary.legs[i].destination);
          if (c) map[i] = c;
        }
        setDestCountries(map);
      } catch {}
    })();
  }, [summary]);

  function noteTextFor(country?: string) {
    const c = country ?? "";
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
      return { title: t("docInternationalTitle"), lines: [t("docInternationalLine1"), t("docInternationalLine2"), t("docInternationalLine3")] };
    }
    if (c === "Brazil") {
      return { title: t("docBrazilTitle"), lines: [t("docBrazilLine1"), t("docBrazilLine2")] };
    }
    if (mercosul.includes(c)) {
      return { title: `${t("docMercosurTitle")} (${c})`, lines: [t("docMercosurLine1"), t("docMercosurLine2"), t("docMercosurLine3")] };
    }
    return { title: `${t("docInternationalTitle")} (${c})`, lines: [t("docInternationalLine1"), t("docInternationalLine2"), t("docInternationalLine3")] };
  }

  if (!tripSearch || !summary) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="mb-3">{t("noTrips")}</p>
          <Button onClick={() => router.push("/flights/search")}>{t("searchFlights")}</Button>
        </div>
      </div>
    );
  }

  const allTimesFilled = (() => {
    if (tripSearch.mode === "same") {
      return Boolean(tripSearch.departTime && tripSearch.returnTime);
    }
    return Boolean(tripSearch.outbound.time && tripSearch.inbound.time);
  })();

  return (
    <div className="min-h-screen px-4 py-6 space-y-6">
      <div className="container-page">
        <Card>
          <CardHeader>
            <CardTitle>{t("editSearchTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-3">
              <label className="mb-1 block text-sm">{t("modeLabel")}</label>
              <Select value={tripSearch.mode} onChange={(e) => setModeValue(e.target.value as "same" | "different")}> 
                <option value="same">{t("searchModeSame")}</option>
                <option value="different">{t("searchModeDifferent")}</option>
              </Select>
            </div>
            {tripSearch.mode === "same" ? (
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="mb-1 block text-sm">{t("origin")}</label>
                  <Input value={tripSearch.origin ?? ""} onChange={(e) => setTripSearch({ ...tripSearch, origin: e.target.value })} placeholder="GRU" />
                  {!tripSearch.origin && <div className="mt-1 text-xs text-red-600">{t("required")}</div>}
                </div>
                <div>
                  <label className="mb-1 block text-sm">{t("destination")}</label>
                  <Input value={tripSearch.destination ?? ""} onChange={(e) => setTripSearch({ ...tripSearch, destination: e.target.value })} placeholder="SDU" />
                  {!tripSearch.destination && <div className="mt-1 text-xs text-red-600">{t("required")}</div>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm">{t("departDate")}</label>
                    <CalendarInput value={tripSearch.departDate ?? ""} min={todayISO} onChange={(e) => setTripSearch({ ...tripSearch, departDate: e.target.value })} />
                    {!tripSearch.departDate && <div className="mt-1 text-xs text-red-600">{t("required")}</div>}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm">{t("returnDate")}</label>
                      <CalendarInput
                        value={tripSearch.returnDate ?? ""}
                        min={tripSearch.departDate || undefined}
                        onChange={(e) => setTripSearch({ ...tripSearch, returnDate: e.target.value })}
                      />
                    {!tripSearch.returnDate && <div className="mt-1 text-xs text-red-600">{t("required")}</div>}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm">{t("passengers")}</label>
                  <PassengerSelector
                    value={normalizePassengers(tripSearch.passengers as unknown)}
                    onChange={(v) => setTripSearch({ ...tripSearch, passengers: v })}
                  />
                </div>
                <div>
                  <Button type="button" variant="secondary" disabled={!isValid(tripSearch)}>{t("apply")}</Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                <div className="rounded-lg border p-3">
                  <h2 className="mb-2 text-sm font-semibold">{t("outboundFlight")}</h2>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                  <label className="mb-1 block text-sm">{t("tableOrigin")}</label>
                  <Input value={tripSearch.outbound.origin ?? ""} onChange={(e) => setTripSearch({ ...tripSearch, outbound: { ...tripSearch.outbound, origin: e.target.value } })} placeholder="GRU" />
                      {!tripSearch.outbound.origin && <div className="mt-1 text-xs text-red-600">{t("required")}</div>}
                    </div>
                    <div>
                      <label className="mb-1 block text-sm">{t("tableDestination")}</label>
                      <Input value={tripSearch.outbound.destination ?? ""} onChange={(e) => setTripSearch({ ...tripSearch, outbound: { ...tripSearch.outbound, destination: e.target.value } })} placeholder="SDU" />
                      {!tripSearch.outbound.destination && <div className="mt-1 text-xs text-red-600">{t("required")}</div>}
                    </div>
                    <div className="col-span-2">
                    <label className="mb-1 block text-sm">{t("date")}</label>
                      <CalendarInput value={tripSearch.outbound.date ?? ""} min={todayISO} onChange={(e) => setTripSearch({ ...tripSearch, outbound: { ...tripSearch.outbound, date: e.target.value } })} />
                    {!tripSearch.outbound.date && <div className="mt-1 text-xs text-red-600">{t("required")}</div>}
                  </div>
                </div>
              </div>

                <div className="rounded-lg border p-3">
                  <h2 className="mb-2 text-sm font-semibold">{t("inboundFlight")}</h2>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                  <label className="mb-1 block text-sm">{t("tableOrigin")}</label>
                  <Input value={tripSearch.inbound.origin ?? ""} onChange={(e) => setTripSearch({ ...tripSearch, inbound: { ...tripSearch.inbound, origin: e.target.value } })} placeholder="SDU" />
                      {!tripSearch.inbound.origin && <div className="mt-1 text-xs text-red-600">{t("required")}</div>}
                    </div>
                    <div>
                      <label className="mb-1 block text-sm">{t("tableDestination")}</label>
                      <Input value={tripSearch.inbound.destination ?? ""} onChange={(e) => setTripSearch({ ...tripSearch, inbound: { ...tripSearch.inbound, destination: e.target.value } })} placeholder="GRU" />
                      {!tripSearch.inbound.destination && <div className="mt-1 text-xs text-red-600">{t("required")}</div>}
                    </div>
                    <div className="col-span-2">
                    <label className="mb-1 block text-sm">{t("date")}
                    </label>
                      <CalendarInput
                        value={tripSearch.inbound.date ?? ""}
                        min={tripSearch.outbound.date || undefined}
                        onChange={(e) => setTripSearch({ ...tripSearch, inbound: { ...tripSearch.inbound, date: e.target.value } })}
                      />
                      {!tripSearch.inbound.date && <div className="mt-1 text-xs text-red-600">{t("required")}</div>}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm">{t("passengers")}</label>
                  <PassengerSelector
                    value={normalizePassengers(tripSearch.passengers as unknown)}
                    onChange={(v) => setTripSearch({ ...tripSearch, passengers: v })}
                  />
                </div>
                <div>
                  <Button type="button" variant="secondary" disabled={!isValid(tripSearch)}>{t("apply")}</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="container-page space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("summarySearch")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell className="font-semibold">{t("tableOrigin")}</TableCell>
                <TableCell className="font-semibold">{t("tableDestination")}</TableCell>
                <TableCell className="font-semibold">{t("tableDate")}</TableCell>
                <TableCell className="font-semibold">{t("tablePassengers")}</TableCell>
              </TableRow>
            </TableHeader>
          <TableBody>
            {summary.legs.map((l, i) => (
              <TableRow key={i}>
                <TableCell>{l.origin}</TableCell>
                <TableCell>{l.destination}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span>{l.date}</span>
                      {arrivalNextDay[i as 0 | 1] && (
                        <span className="rounded px-2 py-0.5 text-[11px] bg-amber-100 text-amber-800 border border-amber-300">{t("arrivalNextDayLabel")}</span>
                      )}
                    </div>
                    {arrivalTimes[i as 0 | 1] && (
                      <div className="mt-1 text-xs text-zinc-600">{t("arrivalTime")}: {arrivalTimes[i as 0 | 1]}</div>
                    )}
                  </div>
                </TableCell>
                <TableCell>{summary.passengers}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          </Table>
        </CardContent>
      </Card>

      {summary.legs.map((l, i) => {
        const links = buildLinks(l.origin, l.destination, l.date, summary.passengers);
        const isSame = tripSearch.mode === "same";
        const timeValue = isSame ? (i === 0 ? tripSearch.departTime ?? "" : tripSearch.returnTime ?? "") : (i === 0 ? tripSearch.outbound.time ?? "" : tripSearch.inbound.time ?? "");
        const flightValue = isSame ? (i === 0 ? tripSearch.departFlightNumber ?? "" : tripSearch.returnFlightNumber ?? "") : (i === 0 ? tripSearch.outbound.flightNumber ?? "" : tripSearch.inbound.flightNumber ?? "");
        return (
          <Card key={i}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base">flight_takeoff</span>
                <span>{i === 0 ? l.title : l.title}, {l.date}</span>
                {arrivalNextDay[i as 0 | 1] && (
                  <span className="ml-2 rounded px-2 py-0.5 text-[11px] bg-amber-100 text-amber-800 border border-amber-300">{t("arrivalNextDayLabel")}</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                {arrivalTimes[i as 0 | 1] && (
                  <div className="text-xs text-zinc-600">{t("arrivalTime")}: {arrivalTimes[i as 0 | 1]}</div>
                )}
                <Button type="button" onClick={() => setOpenIdx(i)}>{t("searchFlights")}</Button>
                <Dialog open={openIdx === i} onOpenChange={(o) => setOpenIdx(o ? i : null)}>
                  <DialogHeader>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-base">link</span>
                      <span>{t("linksSuggested")}</span>
                      <button
                        type="button"
                        aria-label={t("travelDocsNoteAria")}
                        className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-zinc-300 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200"
                        onMouseEnter={() => setNoteOpenIdx(i)}
                        onMouseLeave={() => setNoteOpenIdx(null)}
                        onFocus={() => setNoteOpenIdx(i)}
                        onBlur={() => setNoteOpenIdx(null)}
                        onTouchStart={() => setNoteOpenIdx(i)}
                        onTouchEnd={() => setNoteOpenIdx(null)}
                      >
                        <span className="material-symbols-outlined text-[16px]">info</span>
                      </button>
                    </div>
                    {noteOpenIdx === i && (
                      <div className="relative">
                        <div className="absolute left-0 top-2 mt-2 w-[28rem] max-w-[90vw] rounded-md border border-zinc-200 bg-white p-3 text-sm shadow-lg dark:border-zinc-800 dark:bg-black">
                          {(() => {
                            const info = noteTextFor(destCountries[i]);
                            return (
                              <div>
                                <div className="font-medium">{info.title}</div>
                                {info.lines.map((l, idx) => (
                                  <div key={idx} className="mt-1 text-zinc-700 dark:text-zinc-200">{l}</div>
                                ))}
                                <div className="mt-2 text-xs text-zinc-500">
                                  {t("docDisclaimer")}
                                  <a className="ml-1 underline" href="https://www.gov.br/anvisa/pt-br/assuntos/viajantes" target="_blank" rel="noopener noreferrer">{t("learnMore")}</a>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </DialogHeader>
                  <ul className="space-y-2">
                    {links.map((item) => (
                      <li key={item.name}>
                        <Link className="underline" href={item.href} target="_blank" rel="noopener noreferrer">
                          {item.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <DialogFooter>
                    <Button type="button" onClick={() => setOpenIdx(null)}>{t("close")}</Button>
                  </DialogFooter>
                </Dialog>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm">{t("departureTime")}</label>
                    <Input
                      placeholder=""
                      value={timeValue}
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      onChange={(e) => {
                        const v = e.target.value;
                        if (isSame) {
                          setTripSearch({
                            ...tripSearch,
                            departTime: i === 0 ? v : tripSearch.departTime,
                            returnTime: i === 1 ? v : tripSearch.returnTime,
                          });
                        } else {
                          setTripSearch({
                            ...tripSearch,
                            outbound: { ...tripSearch.outbound, time: i === 0 ? v : tripSearch.outbound.time },
                            inbound: { ...tripSearch.inbound, time: i === 1 ? v : tripSearch.inbound.time },
                          });
                        }
                      }}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm">{t("flightNumberOptional")}</label>
                    <Input
                      placeholder=""
                      value={flightValue}
                      inputMode="text"
                      type="text"
                      onChange={(e) => {
                        const v = e.target.value;
                        if (isSame) {
                          setTripSearch({
                            ...tripSearch,
                            departFlightNumber: i === 0 ? v : tripSearch.departFlightNumber,
                            returnFlightNumber: i === 1 ? v : tripSearch.returnFlightNumber,
                          });
                        } else {
                          setTripSearch({
                            ...tripSearch,
                            outbound: { ...tripSearch.outbound, flightNumber: i === 0 ? v : tripSearch.outbound.flightNumber },
                            inbound: { ...tripSearch.inbound, flightNumber: i === 1 ? v : tripSearch.inbound.flightNumber },
                          });
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm">{t("arrivalTime")}</label>
                    <Input
                      placeholder=""
                      value={arrivalTimes[i as 0 | 1]}
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      onChange={(e) => {
                        const v = fmtTime(e.target.value);
                        setArrivalTimes((prev) => (i === 0 ? [v, prev[1]] : [prev[0], v]));
                        try {
                          const dep = timeValue || "";
                          const arr = v || "";
                          const warnAlready = arrivalWarnShown[i as 0 | 1];
                          if (dep && arr && arr.length === 5 && toMinutes(arr) < toMinutes(dep) && !arrivalNextDay[i as 0 | 1] && !warnAlready) {
                            show(t("arrivalNextDayAsk"));
                            setArrivalWarnShown((prev) => (i === 0 ? [true, prev[1]] : [prev[0], true]));
                          }
                        } catch {}
                      }}
                    />
                    {(() => {
                      const dep = timeValue || "";
                      const arr = arrivalTimes[i as 0 | 1] || "";
                      const invalid = dep && arr && toMinutes(arr) < toMinutes(dep) && !arrivalNextDay[i as 0 | 1];
                      return invalid ? <div className="mt-1 text-xs text-red-600">{t("arrivalNextDayWarn")}</div> : null;
                    })()}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id={`nextday-${i}`}
                      type="checkbox"
                      checked={arrivalNextDay[i as 0 | 1]}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setArrivalNextDay((prev) => (i === 0 ? [checked, prev[1]] : [prev[0], checked]));
                        try {
                          if (i === 0) localStorage.setItem("calentrip:arrivalNextDay_outbound", String(checked));
                          if (i === 1) localStorage.setItem("calentrip:arrivalNextDay_inbound", String(checked));
                        } catch {}
                      }}
                    />
                    <label htmlFor={`nextday-${i}`} className="text-sm">{t("arrivalNextDayLabel")}</label>
                  </div>
                </div>
                <div
                  className="mt-2 flex items-start gap-2 rounded-md border border-amber-500 bg-amber-50 p-2 text-xs text-amber-900"
                  style={{ maxHeight: arrivalNextDay[i as 0 | 1] ? noteAnim.maxH : 0, opacity: arrivalNextDay[i as 0 | 1] ? 1 : 0, transition: noteAnim.transition, overflow: "hidden" }}
                  aria-hidden={!arrivalNextDay[i as 0 | 1]}
                >
                  <span className="material-symbols-outlined text-amber-700">warning</span>
                  <span>{t("arrivalNextDayHelp")}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <div className="flex justify-between">
        <Button
          type="button"
          disabled={!allTimesFilled || !isValid(tripSearch) || (() => {
            const dep0 = tripSearch.mode === "same" ? (tripSearch.departTime || "") : (tripSearch.outbound.time || "");
            const dep1 = tripSearch.mode === "same" ? (tripSearch.returnTime || "") : (tripSearch.inbound.time || "");
            const inv0 = dep0 && arrivalTimes[0] && toMinutes(arrivalTimes[0]) < toMinutes(dep0) && !arrivalNextDay[0];
            const inv1 = dep1 && arrivalTimes[1] && toMinutes(arrivalTimes[1]) < toMinutes(dep1) && !arrivalNextDay[1];
            return Boolean(inv0 || inv1);
          })()}
          onClick={() => {
            const id = String(Date.now());
            const title = `${summary.legs[0].origin} → ${summary.legs[0].destination}`;
            const date = summary.legs[0].date;
            addTrip({ id, title, date, passengers: summary.passengers });
          }}
        >
          {t("saveTrip")}
        </Button>
        <Button
          type="button"
          disabled={!allTimesFilled || !isValid(tripSearch) || (() => {
            const dep0 = tripSearch.mode === "same" ? (tripSearch.departTime || "") : (tripSearch.outbound.time || "");
            const dep1 = tripSearch.mode === "same" ? (tripSearch.returnTime || "") : (tripSearch.inbound.time || "");
            const inv0 = dep0 && arrivalTimes[0] && toMinutes(arrivalTimes[0]) < toMinutes(dep0) && !arrivalNextDay[0];
            const inv1 = dep1 && arrivalTimes[1] && toMinutes(arrivalTimes[1]) < toMinutes(dep1) && !arrivalNextDay[1];
            return Boolean(inv0 || inv1);
          })()}
          onClick={() => router.push("/accommodation/search")}
        >
          {t("advanceToStay")}
        </Button>
      </div>
      </div>
    </div>
  );
}
