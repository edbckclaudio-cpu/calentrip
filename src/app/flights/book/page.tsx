"use client";
import Link from "next/link";
import { useTrip } from "@/lib/trip-context";
import type { TripSearchSame, TripSearchDifferent } from "@/lib/trip-context";
import { getCountryByIata } from "@/lib/airports";
import { useRouter } from "next/navigation";
import { useMemo, useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableCell, TableBody } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addTrip } from "@/lib/trips-store";
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
  const viajanet = `https://www.viajanet.com.br/busca?origin=${origin}&destination=${destination}&depart=${depart}&ret=${ret}&adults=${adults}&children=${children}&infants=${infants}`;
  const skyscannerDate = (d: string) => d.replace(/-/g, "");
  const sky = `https://www.skyscanner.com.br/transporte/voos/${origin}/${destination}/${skyscannerDate(depart)}/${skyscannerDate(ret)}/?adults=${adults}&children=${children}&infants=${infants}`;
  return [
    { name: "Google Flights", href: google },
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
    { name: "Google Flights", href: google },
    { name: "Kayak", href: kayak },
    { name: "Booking", href: booking },
    { name: "Skyscanner", href: sky },
  ];
}

 

function addQuery(base: string, origin: string, destination: string, depart: string, ret: string, adults: number) {
  const q = new URLSearchParams({ origin, destination, departureDate: depart, returnDate: ret, adults: String(adults) });
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}${q.toString()}`;
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
        title: "Atenção para documentos de viagem",
        lines: [
          "Antes de comprar, verifique requisitos de passaporte, visto e vacinas conforme o país de destino.",
          "Em geral, recomenda-se passaporte com validade mínima de 6 meses, e documentos em perfeito estado.",
        ],
      };
    }
    if (c === "Brazil") {
      return {
        title: `Requisitos para viagem no Brasil`,
        lines: [
          "Voo doméstico: passaporte não é exigido. Leve documento oficial com foto (RG ou CNH) válido e legível.",
          "Vacinas: verifique orientações de saúde do destino. Em rotas específicas podem existir recomendações.",
        ],
      };
    }
    if (mercosul.includes(c)) {
      return {
        title: `Requisitos para viagem ao Mercosul (${c})`,
        lines: [
          "Para brasileiros, RG físico legível e em bom estado é aceito. Recomenda-se emissão há até 10 anos.",
          "Passaporte pode ser utilizado. Visto: em geral não é exigido para turismo de curto prazo.",
          "Vacinas: verifique exigências do país. Em algumas rotas pode ser solicitado comprovante de Febre Amarela.",
        ],
      };
    }
    return {
      title: `Requisitos para viagem internacional (${c})`,
      lines: [
        "Passaporte obrigatório, preferencialmente com validade mínima de 6 meses a partir da entrada.",
        "Visto: pode ser necessário. Confirme regras do país de destino (ex.: EUA, Canadá, China, Índia, Austrália).",
        "Vacinas: verifique se há exigência de certificado internacional (ex.: Febre Amarela) e demais requisitos de saúde.",
      ],
    };
  }, [countries.destination]);

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
      const id = show(
        "Hora de escolher e comprar o voo. Em \"Plataformas de busca\", use os links para comparar preço e horários. As buscas já vêm preenchidas, mas valide os dados e a quantidade de passageiros. Após a compra, registre os horários dos voos, anexe ou fotografe as passagens e salve o localizador/código de reserva.",
        { variant: "info", sticky: true, key: "book-intro" }
      );
      setTimeout(() => { try { minimize(id); } catch {} }, 20000);
    } else {
      const id = show(
        "Hora de escolher e comprar o voo. Vá no quadro Plataformas de busca, e acesse os links, alguns buscadores podem não reconhecer todos dados — valide os dados e garanta que a opção \"somente ida\" esteja ativa em cada trecho; confira também a quantidade de passageiros. Após a compra, registre os horários dos voos, anexe ou fotografe as passagens e salve o localizador/código de reserva.",
        { variant: "info", sticky: true, key: "book-intro" }
      );
      setTimeout(() => { try { minimize(id); } catch {} }, 20000);
    }
    setIntroShown(true);
  }, [hydrated, loadingTrip, tripSearch, introShown, show, minimize]);

  const missing = hydrated && !loadingTrip && !tripSearch;

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
        <div className="max-w-sm">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-base">summarize</span>
                <span>{t("summarySearch")}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-[11px] py-2">
            {!hydrated || loadingTrip ? (
              <div className="text-sm text-zinc-600">Carregando busca…</div>
            ) : missing ? (
              <div className="flex items-center justify-between">
                <div className="text-sm text-zinc-600">{t("noTrips")}</div>
                <Button type="button" onClick={() => router.push("/flights/search")}>{t("searchFlights")}</Button>
              </div>
            ) : (!missing && tripSearch?.mode === "same") ? (
              <Table className="w-full border-collapse text-[11px]">
                <TableHeader>
                  <TableRow>
                    <TableCell className="font-semibold p-0.5">{t("tableOrigin")}</TableCell>
                    <TableCell className="font-semibold p-0.5">{t("tableDestination")}</TableCell>
                    <TableCell className="font-semibold p-0.5">{t("tableDate")}</TableCell>
                    <TableCell className="font-semibold p-0.5">{t("tablePassengers")}</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="p-0.5">{tripSearch!.origin}</TableCell>
                    <TableCell className="p-0.5">{tripSearch!.destination}</TableCell>
                    <TableCell className="p-0.5">{tripSearch!.departDate} → {tripSearch!.returnDate}</TableCell>
                    <TableCell className="p-0.5">{totalPassengers(tripSearch!.passengers)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            ) : (!missing && tripSearch) ? (
              <Table className="w-full border-collapse text-[11px]">
                <TableHeader>
                  <TableRow>
                    <TableCell className="font-semibold p-0.5">{t("tableOrigin")}</TableCell>
                    <TableCell className="font-semibold p-0.5">{t("tableDestination")}</TableCell>
                    <TableCell className="font-semibold p-0.5">{t("tableDate")}</TableCell>
                    <TableCell className="font-semibold p-0.5">{t("tablePassengers")}</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="p-0.5">{tripSearch!.outbound.origin}</TableCell>
                    <TableCell className="p-0.5">{tripSearch!.outbound.destination}</TableCell>
                    <TableCell className="p-0.5">{tripSearch!.outbound.date}</TableCell>
                    <TableCell className="p-0.5">{totalPassengers(tripSearch!.passengers)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="p-0.5">{tripSearch!.inbound.origin}</TableCell>
                    <TableCell className="p-0.5">{tripSearch!.inbound.destination}</TableCell>
                    <TableCell className="p-0.5">{tripSearch!.inbound.date}</TableCell>
                    <TableCell className="p-0.5">{totalPassengers(tripSearch!.passengers)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            ) : null}
            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                className="px-3 py-1 text-[11px]"
                onClick={() => { show("Editando busca"); router.push("/flights/search"); }}
              >
                {t("editSearchTitle")}
              </Button>
            </div>
            </CardContent>
          </Card>
        </div>
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
                aria-label="Nota de documentos para viagem"
                className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-zinc-300 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200"
                onMouseEnter={() => setNoteOpen(true)}
                onMouseLeave={() => setNoteOpen(false)}
                onFocus={() => setNoteOpen(true)}
                onBlur={() => setNoteOpen(false)}
                onTouchStart={() => setNoteOpen(true)}
                onTouchEnd={() => setNoteOpen(false)}
                onClick={() => {
                  const msg = `${noteText.title} • ${noteText.lines.join(" • ")}`;
                  show(msg);
                }}
              >
                <span className="material-symbols-outlined text-[16px]">info</span>
              </button>
              <button
                type="button"
                aria-label="Dica sobre horário de chegada e check-in"
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
                  <div className="mt-2 text-xs text-zinc-500">Confirme sempre com o consulado/embaixada e autoridades de saúde do destino.</div>
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
              <ul className="space-y-2">
                {data.links.map((item) => (
                  <li key={item.name} className="flex items-center gap-1">
                    <Link className="underline" href={item.href} target="_blank" rel="noopener noreferrer" onClick={() => { show(`Abrindo ${item.name}`); if (guide === "aggregators") setGuide("notes"); }}>
                      {item.name}
                    </Link>
                    {item.name === "Google Flights" ? (
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  {(() => { const ts = tripSearch as TripSearchDifferent; return (
                    <div className="mb-2">
                      <div className="inline-flex items-center gap-2 rounded-md px-2 py-1 border border-[#febb02] bg-[#febb02]/10 text-[#febb02]">
                        <span className="text-xs font-semibold">{t("outboundFlight")}</span>
                        <span className="text-sm font-semibold">{ts.outbound.origin}/{ts.outbound.destination}</span>
                        <span className="text-xs font-medium">• {formatDate(ts.outbound.date)}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400">Links abaixo estão preenchidos com esse trecho (somente ida)</div>
                    </div>
                  ); })()}
                  <ul className="space-y-2">
                    {(() => { const ts = tripSearch as TripSearchDifferent; return buildLinksOne(ts.outbound.origin, ts.outbound.destination, ts.outbound.date, ts.passengers); })().map((item) => (
                      <li key={`out-${item.name}`} className="flex items-center gap-1">
                        <Link className="underline" href={item.href} target="_blank" rel="noopener noreferrer" onClick={() => { show(`Abrindo ${item.name}`); if (guide === "aggregators") setGuide("notes"); }}>
                          {item.name}
                        </Link>
                        {item.name === "Google Flights" ? (
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
                      <div className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400">Links abaixo estão preenchidos com esse trecho (somente ida)</div>
                    </div>
                  ); })()}
                  <ul className="space-y-2">
                    {(() => { const ts = tripSearch as TripSearchDifferent; return buildLinksOne(ts.inbound.origin, ts.inbound.destination, ts.inbound.date, ts.passengers); })().map((item) => (
                      <li key={`in-${item.name}`} className="flex items-center gap-1">
                        <Link className="underline" href={item.href} target="_blank" rel="noopener noreferrer" onClick={() => { show(`Abrindo ${item.name}`); if (guide === "aggregators") setGuide("notes"); }}>
                          {item.name}
                        </Link>
                        {item.name === "Google Flights" ? (
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
              <div className="text-sm text-zinc-600">Carregando busca…</div>
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
  const { tripSearch } = useTrip();
  const { t } = useI18n();
  const router = useRouter();
  const { show, dismiss } = useToast();
  const [activeLeg, setActiveLeg] = useState<0 | 1>(0);
  const [proceedPulse, setProceedPulse] = useState(false);
  const [infoShown, setInfoShown] = useState(false);
  const [hintId, setHintId] = useState<number | null>(null);
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
  const allFilled = notes.every((n) => Boolean(n.dep) && Boolean(n.arr));
  const allValid = allFilled && !invalidLeg(0) && !invalidLeg(1);

  function save() {
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
    addTrip({ id, title, date, passengers, flightNotes, attachments });
    if (hintId != null) {
      try { dismiss(hintId); } catch {}
    }
    show("Notas salvas, redirecionando…", { variant: "success" });
    try { onProceed?.(); } catch {}
    router.push("/accommodation/search");
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
                  if (!infoShown) { const id = show("Inclua os horários dos voos nesses campos. Eles serão incluídos no calendário final e, a partir deles, calcularemos os horários de locomoção.", { duration: 15000 }); setHintId(id); setInfoShown(true); }
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
                  if (!infoShown) { const id = show("Inclua os horários dos voos nesses campos. Eles serão incluídos no calendário final e, a partir deles, calcularemos os horários de locomoção.", { duration: 15000 }); setHintId(id); setInfoShown(true); }
                }}
              />
              {invalidLeg(i) && (
                <div className="mt-1 text-xs text-red-600">{t("arrivalNextDayWarn")}</div>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm">{t("flightNumberOptional")}</label>
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
                  if (!infoShown) { const id = show("Inclua os horários dos voos nesses campos. Eles serão incluídos no calendário final e, a partir deles, calcularemos os horários de locomoção.", { duration: 15000 }); setHintId(id); setInfoShown(true); }
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
                  if (!infoShown) { const id = show("Inclua os horários dos voos nesses campos. Eles serão incluídos no calendário final e, a partir deles, calcularemos os horários de locomoção.", { duration: 15000 }); setHintId(id); setInfoShown(true); }
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
              id={`file-${i}`}
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              multiple
              className="hidden"
              onChange={(e) => {
                const list = Array.from(e.target.files ?? []);
                Promise.all(list.map(async (f) => {
                  const mod = await import("@/lib/attachments-store");
                  const saved = await mod.saveFromFile(f);
                  return { name: saved.name, type: saved.type, size: saved.size, id: saved.id };
                })).then((items) => {
                  setFiles((prev) => prev.map((arr, idx) => (idx === i ? items : arr)));
                });
              }}
                onFocus={() => {
                  setActiveLeg(i as 0 | 1);
                  setProceedPulse(i === 1);
                  if (!infoShown) { const id = show("Inclua os horários dos voos nesses campos. Eles serão incluídos no calendário final e, a partir deles, calcularemos os horários de locomoção.", { duration: 15000 }); setHintId(id); setInfoShown(true); }
                }}
              />
            <div className="flex items-center gap-2">
              <Button type="button" onClick={() => document.getElementById(`file-${i}`)?.click()}>{t("attachProofButton")}</Button>
              <span className="text-xs text-zinc-600">{t("attachProofHelp")}</span>
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
        <Button type="button" disabled={!allValid} onClick={save} className={proceedPulse ? "ring-4 ring-amber-500 pulse-ring" : undefined}>{t("proceedToAccommodation")}</Button>
      </div>
    </div>
  );
}
