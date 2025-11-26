"use client";
import Link from "next/link";
import { useTrip } from "@/lib/trip-context";
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
  return [
    { name: "Google Flights", href: google },
    { name: "Kayak", href: kayak },
    { name: "Booking", href: booking },
    { name: "Viajanet", href: viajanet },
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
  const viajanet = `https://www.viajanet.com.br/busca?origin=${origin}&destination=${destination}&depart=${depart}&adults=${adults}&children=${children}&infants=${infants}`;
  return [
    { name: "Google Flights", href: google },
    { name: "Kayak", href: kayak },
    { name: "Booking", href: booking },
    { name: "Viajanet", href: viajanet },
  ];
}

function airlinesForCountries(a?: string, b?: string) {
  const byCountry: Record<string, { name: string; base: string }[]> = {
    Brazil: [
      { name: "LATAM", base: "https://www.latamairlines.com" },
      { name: "GOL", base: "https://www.voegol.com.br" },
      { name: "Azul", base: "https://www.voeazul.com.br" },
      { name: "TAP Air Portugal", base: "https://www.flytap.com" },
    ],
    Spain: [
      { name: "Iberia", base: "https://www.iberia.com" },
      { name: "Air Europa", base: "https://www.aireuropa.com" },
      { name: "Vueling", base: "https://www.vueling.com" },
    ],
    UnitedKingdom: [
      { name: "British Airways", base: "https://www.britishairways.com" },
      { name: "Virgin Atlantic", base: "https://www.virginatlantic.com" },
    ],
    UnitedStates: [
      { name: "Delta", base: "https://www.delta.com" },
      { name: "American Airlines", base: "https://www.aa.com" },
      { name: "United", base: "https://www.united.com" },
    ],
    France: [{ name: "Air France", base: "https://www.airfrance.com" }],
    Portugal: [{ name: "TAP Air Portugal", base: "https://www.flytap.com" }],
    Italy: [{ name: "ITA Airways", base: "https://www.ita-airways.com" }],
    Germany: [{ name: "Lufthansa", base: "https://www.lufthansa.com" }],
    Netherlands: [{ name: "KLM", base: "https://www.klm.com" }],
    Turkey: [{ name: "Turkish Airlines", base: "https://www.turkishairlines.com" }],
    UAE: [{ name: "Emirates", base: "https://www.emirates.com" }],
    Qatar: [{ name: "Qatar Airways", base: "https://www.qatarairways.com" }],
  };
  const key = (s?: string) => (s ?? "").replace(/\s+/g, "");
  const list = [...(byCountry[key(a)] ?? []), ...(byCountry[key(b)] ?? [])];
  const seen = new Set<string>();
  return list.filter((x) => {
    const k = x.name.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function addQuery(base: string, origin: string, destination: string, depart: string, ret: string, adults: number) {
  const q = new URLSearchParams({ origin, destination, departureDate: depart, returnDate: ret, adults: String(adults) });
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}${q.toString()}`;
}

export default function BookFlightsPage() {
  const { tripSearch } = useTrip();
  const router = useRouter();
  const { t } = useI18n();
  const { show } = useToast();
  const [countries, setCountries] = useState<{ origin?: string; destination?: string; originIn?: string; destinationIn?: string; userRegion?: string }>({});
  const [noteOpen, setNoteOpen] = useState(false);
  const [arrivalNoteOpen, setArrivalNoteOpen] = useState(false);
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

  const missing = !tripSearch;

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

  const airlinesSame = useMemo(() => {
    if (!tripSearch) return [] as { name: string; href: string }[];
    let list = airlinesForCountries(countries.origin, countries.destination);
    if (!list.length && countries.userRegion === "BR") list = airlinesForCountries("Brazil", undefined);
    const depart = tripSearch.departDate;
    const ret = tripSearch.returnDate;
    const pax = totalPassengers(tripSearch.passengers);
    return list.map((a) => ({ name: a.name, href: addQuery(a.base, tripSearch.origin, tripSearch.destination, depart, ret, pax) }));
  }, [countries, tripSearch]);

  const airlinesOut = useMemo(() => {
    if (!tripSearch || tripSearch.mode !== "different") return [] as { name: string; href: string }[];
    let list = airlinesForCountries(countries.origin, countries.destination);
    if (!list.length && countries.userRegion === "BR") list = airlinesForCountries("Brazil", undefined);
    const depart = tripSearch.outbound.date;
    const pax = totalPassengers(tripSearch.passengers);
    return list.map((a) => ({ name: a.name, href: addQuery(a.base, tripSearch.outbound.origin, tripSearch.outbound.destination, depart, depart, pax) }));
  }, [countries, tripSearch]);

  const airlinesIn = useMemo(() => {
    if (!tripSearch || tripSearch.mode !== "different") return [] as { name: string; href: string }[];
    let list = airlinesForCountries(countries.originIn, countries.destinationIn);
    if (!list.length && countries.userRegion === "BR") list = airlinesForCountries("Brazil", undefined);
    const depart = tripSearch.inbound.date;
    const pax = totalPassengers(tripSearch.passengers);
    return list.map((a) => ({ name: a.name, href: addQuery(a.base, tripSearch.inbound.origin, tripSearch.inbound.destination, depart, depart, pax) }));
  }, [countries, tripSearch]);

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
            {missing ? (
              <div className="flex items-center justify-between">
                <div className="text-sm text-zinc-600">{t("noTrips")}</div>
                <Button type="button" onClick={() => router.push("/flights/search")}>{t("searchFlights")}</Button>
              </div>
            ) : tripSearch.mode === "same" ? (
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
                    <TableCell className="p-0.5">{tripSearch.origin}</TableCell>
                    <TableCell className="p-0.5">{tripSearch.destination}</TableCell>
                    <TableCell className="p-0.5">{tripSearch.departDate} → {tripSearch.returnDate}</TableCell>
                    <TableCell className="p-0.5">{totalPassengers(tripSearch.passengers)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            ) : (
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
                    <TableCell className="p-0.5">{tripSearch.outbound.origin}</TableCell>
                    <TableCell className="p-0.5">{tripSearch.outbound.destination}</TableCell>
                    <TableCell className="p-0.5">{tripSearch.outbound.date}</TableCell>
                    <TableCell className="p-0.5">{totalPassengers(tripSearch.passengers)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="p-0.5">{tripSearch.inbound.origin}</TableCell>
                    <TableCell className="p-0.5">{tripSearch.inbound.destination}</TableCell>
                    <TableCell className="p-0.5">{tripSearch.inbound.date}</TableCell>
                    <TableCell className="p-0.5">{totalPassengers(tripSearch.passengers)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
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

      <div className="container-page grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
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
            {tripSearch.mode === "same" && data ? (
              <ul className="space-y-2">
                {data.links.map((item) => (
                  <li key={item.name}>
                    <Link className="underline" href={item.href} target="_blank" rel="noopener noreferrer" onClick={() => show(`Abrindo ${item.name}`)}>
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : tripSearch.mode === "different" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <div className="mb-2 text-sm font-semibold">{tripSearch.outbound.origin}/{tripSearch.outbound.destination}</div>
                  <ul className="space-y-2">
                    {buildLinksOne(tripSearch.outbound.origin, tripSearch.outbound.destination, tripSearch.outbound.date, tripSearch.passengers).map((item) => (
                      <li key={`out-${item.name}`}>
                        <Link className="underline" href={item.href} target="_blank" rel="noopener noreferrer" onClick={() => show(`Abrindo ${item.name}`)}>
                          {item.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="mb-2 text-sm font-semibold">{tripSearch.inbound.origin}/{tripSearch.inbound.destination}</div>
                  <ul className="space-y-2">
                    {buildLinksOne(tripSearch.inbound.origin, tripSearch.inbound.destination, tripSearch.inbound.date, tripSearch.passengers).map((item) => (
                      <li key={`in-${item.name}`}>
                        <Link className="underline" href={item.href} target="_blank" rel="noopener noreferrer" onClick={() => show(`Abrindo ${item.name}`)}>
                          {item.name}
                        </Link>
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base">flight</span>
              <span>{t("bookAirlinesSuggested")}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tripSearch.mode === "same" ? (
              <ul className="space-y-2">
                {airlinesSame.map((a) => (
                  <li key={`same-${a.name}`}>
                    <Link className="underline" href={a.href} target="_blank" rel="noopener noreferrer" onClick={() => show(`Abrindo ${a.name}`)}>
                      {a.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <div className="mb-2 text-sm font-semibold">{tripSearch.outbound.origin}/{tripSearch.outbound.destination}</div>
                  <ul className="space-y-2">
                    {airlinesOut.map((a) => (
                      <li key={`out-${a.name}`}>
                        <Link className="underline" href={a.href} target="_blank" rel="noopener noreferrer" onClick={() => show(`Abrindo ${a.name}`)}>
                          {a.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="mb-2 text-sm font-semibold">{tripSearch.inbound.origin}/{tripSearch.inbound.destination}</div>
                  <ul className="space-y-2">
                    {airlinesIn.map((a) => (
                      <li key={`in-${a.name}`}>
                        <Link className="underline" href={a.href} target="_blank" rel="noopener noreferrer" onClick={() => show(`Abrindo ${a.name}`)}>
                          {a.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            <p className="mt-2 text-xs text-zinc-500">{t("bookAirlinesNote")}</p>
          </CardContent>
        </Card>
      </div>
      <div className="container-page">
        <Card>
          <CardHeader>
            <CardTitle>{t("flightNotesTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {!tripSearch ? (
              <div className="flex items-center justify-between">
                <div className="text-sm text-zinc-600">{t("noTrips")}</div>
                <Button type="button" onClick={() => router.push("/flights/search")}>{t("searchFlights")}</Button>
              </div>
            ) : (
              <FlightNotesForm />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FlightNotesForm() {
  const { tripSearch } = useTrip();
  const { t } = useI18n();
  const router = useRouter();
  const { show } = useToast();
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
  const [files, setFiles] = useState([[], []] as Array<Array<{ name: string; type: string; size: number; dataUrl?: string }>>);
  const allFilled = notes.every((n) => Boolean(n.dep) && Boolean(n.arr));

  function save() {
    if (!tripSearch) return;
    const passengers = totalPassengers(tripSearch.passengers);
    const first = legs[0];
    const id = String(Date.now());
    const title = `${first.origin} → ${first.destination}`;
    const date = first.date;
    const flightNotes = legs.map((l, i) => ({
      leg: i === 0 ? "outbound" : "inbound",
      origin: l.origin,
      destination: l.destination,
      date: l.date,
      departureTime: notes[i]?.dep || undefined,
      arrivalTime: notes[i]?.arr || undefined,
      flightNumber: notes[i]?.code || undefined,
    }));
    const attachments = legs.flatMap((l, i) => (files[i] || []).map((f) => ({ leg: i === 0 ? "outbound" : "inbound", name: f.name, type: f.type, size: f.size, dataUrl: f.dataUrl })));
    addTrip({ id, title, date, passengers, flightNotes, attachments });
    show("Notas salvas, redirecionando…", { variant: "success" });
    router.push("/accommodation/search");
  }

  return (
    <div className="space-y-4">
      {legs.map((l, i) => (
        <div key={`${l.title}-${i}`} className="rounded-lg border p-3">
          <div className="mb-2 text-sm font-semibold">{l.title} • {l.origin} → {l.destination} • {l.date}</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm">{t("departureTime")}</label>
              <Input
                placeholder="14:30"
                value={notes[i]?.dep ?? ""}
                onChange={(e) => {
                  const v = fmtTime(e.target.value);
                  setNotes((prev) => prev.map((x, idx) => (idx === i ? { ...x, dep: v } : x)));
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm">{t("arrivalTime")}</label>
              <Input
                placeholder="18:05"
                value={notes[i]?.arr ?? ""}
                onChange={(e) => {
                  const v = fmtTime(e.target.value);
                  setNotes((prev) => prev.map((x, idx) => (idx === i ? { ...x, arr: v } : x)));
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm">{t("flightNumberOptional")}</label>
              <Input
                placeholder="JJ1234"
                value={notes[i]?.code ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setNotes((prev) => prev.map((x, idx) => (idx === i ? { ...x, code: v } : x)));
                }}
              />
            </div>
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
                  setFiles((prev) => prev.map((arr, idx) => (idx === i ? items : arr)));
                });
              }}
            />
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" onClick={() => document.getElementById(`file-${i}`)?.click()}>{t("attachProofButton")}</Button>
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
        <Button type="button" disabled={!allFilled} onClick={save}>{t("proceedToAccommodation")}</Button>
      </div>
    </div>
  );
}
