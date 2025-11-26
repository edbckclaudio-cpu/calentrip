"use client";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CalendarInput } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { useTrip } from "@/lib/trip-context";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import AirportAutocomplete from "@/components/airport-autocomplete";
import PassengerSelector from "@/components/passenger-selector";
import { useToast } from "@/components/ui/toast";

export default function FlightsSearchPage() {
  const { t } = useI18n();
  const todayISO = (() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  })();
  const [mode, setMode] = useState<"same" | "different">("same");
  const [same, setSame] = useState({ origin: "", destination: "", departDate: "", returnDate: "", passengers: { adults: 1, children: 0, infants: 0 } });
  const [outbound, setOutbound] = useState({ origin: "", destination: "", date: "" });
  const [inbound, setInbound] = useState({ origin: "", destination: "", date: "" });
  const [passengers, setPassengers] = useState({ adults: 1, children: 0, infants: 0 });
  const { setTripSearch } = useTrip();
  const router = useRouter();
  const [attempted, setAttempted] = useState(false);
  const { show } = useToast();

  function confirm() {
    const filledSame = Boolean(same.origin && same.destination && same.departDate && same.returnDate);
    const filledDiff = Boolean(outbound.origin && outbound.destination && outbound.date && inbound.origin && inbound.destination && inbound.date);
    if (mode === "different" || (filledDiff && !filledSame)) {
      setTripSearch({ mode: "different", outbound: { ...outbound }, inbound: { ...inbound }, passengers });
      show("Informações confirmadas");
      router.push("/flights/book");
    } else if (filledSame) {
      setTripSearch({
        mode: "same",
        origin: same.origin,
        destination: same.destination,
        departDate: same.departDate,
        returnDate: same.returnDate,
        passengers: same.passengers,
      });
      show("Informações confirmadas");
      router.push("/flights/book");
    } else {
      setAttempted(true);
      show("Preencha os campos obrigatórios", { variant: "error" });
    }
  }

  return (
    <div className="min-h-screen px-4 py-6">
      <div className="container-page">
        <h1 className="mb-1 text-2xl font-semibold text-[var(--brand)]">{t("searchFlightsTitle")}</h1>
        <p className="mb-4 text-sm text-zinc-600">{t("welcomeSearch")}</p>
      </div>
      <div className="container-page">
        <Tabs defaultValue="same">
          <TabsList>
          <TabsTrigger value="same" onClick={() => setMode("same")}>{t("searchTabSame")}</TabsTrigger>
          <TabsTrigger value="different" onClick={() => setMode("different")}>{t("searchTabDifferent")}</TabsTrigger>
          </TabsList>

        <TabsContent value="same">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm">{t("passengers")}</label>
              <PassengerSelector value={same.passengers} onChange={(v) => setSame({ ...same, passengers: v })} />
            </div>
            <div>
              <label className="mb-1 block text-sm">{t("origin")}</label>
              <AirportAutocomplete invalid={attempted && mode === "same" && !same.origin} value={same.origin} onSelect={(iata) => setSame({ ...same, origin: iata })} />
              {attempted && mode === "same" && !same.origin && <div className="mt-1 text-xs text-red-600">{t("required")}</div>}
            </div>
            <div>
              <label className="mb-1 block text-sm">{t("destination")}</label>
              <AirportAutocomplete invalid={attempted && mode === "same" && !same.destination} value={same.destination} onSelect={(iata) => setSame({ ...same, destination: iata })} />
              {attempted && mode === "same" && !same.destination && <div className="mt-1 text-xs text-red-600">{t("required")}</div>}
            </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm">{t("departDate")}</label>
                  <CalendarInput className={attempted && mode === "same" && !same.departDate ? "border-red-500 focus:ring-red-400" : ""} value={same.departDate} min={todayISO} onChange={(e) => setSame({ ...same, departDate: e.target.value })} />
                  {attempted && mode === "same" && !same.departDate && <div className="mt-1 text-xs text-red-600">{t("required")}</div>}
                </div>
                <div>
                  <label className="mb-1 block text-sm">{t("returnDate")}</label>
                  <CalendarInput
                    className={attempted && mode === "same" && !same.returnDate ? "border-red-500 focus:ring-red-400" : ""}
                    value={same.returnDate}
                    min={same.departDate || undefined}
                    onFocus={() => { if (!same.returnDate && same.departDate) setSame({ ...same, returnDate: same.departDate }); }}
                    onChange={(e) => setSame({ ...same, returnDate: e.target.value })}
                  />
                  {attempted && mode === "same" && !same.returnDate && <div className="mt-1 text-xs text-red-600">{t("required")}</div>}
                </div>
              </div>
            <Button type="button" onClick={confirm}>{t("confirmInfo")}</Button>
          </div>
        </TabsContent>

        <TabsContent value="different">
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm">{t("passengers")}</label>
                <PassengerSelector value={passengers} onChange={setPassengers} />
              </div>
              <div className="rounded-lg border p-3">
                <h2 className="mb-2 text-sm font-semibold">{t("outboundFlight")}</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm">{t("tableOrigin")}</label>
                    <AirportAutocomplete invalid={attempted && mode === "different" && !outbound.origin} value={outbound.origin} onSelect={(iata) => setOutbound({ ...outbound, origin: iata })} />
                    {attempted && mode === "different" && !outbound.origin && <div className="mt-1 text-xs text-red-600">{t("required")}</div>}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm">{t("tableDestination")}</label>
                    <AirportAutocomplete invalid={attempted && mode === "different" && !outbound.destination} value={outbound.destination} onSelect={(iata) => setOutbound({ ...outbound, destination: iata })} />
                    {attempted && mode === "different" && !outbound.destination && <div className="mt-1 text-xs text-red-600">{t("required")}</div>}
                  </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-sm">{t("date")}</label>
                  <CalendarInput className={attempted && mode === "different" && !outbound.date ? "border-red-500 focus:ring-red-400" : ""} value={outbound.date} min={todayISO} onChange={(e) => setOutbound({ ...outbound, date: e.target.value })} />
                  {attempted && mode === "different" && !outbound.date && <div className="mt-1 text-xs text-red-600">{t("required")}</div>}
                </div>
              </div>
            </div>

                <div className="rounded-lg border p-3">
                  <h2 className="mb-2 text-sm font-semibold">{t("inboundFlight")}</h2>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-sm">{t("tableOrigin")}</label>
                      <AirportAutocomplete invalid={attempted && mode === "different" && !inbound.origin} value={inbound.origin} onSelect={(iata) => setInbound({ ...inbound, origin: iata })} />
                      {attempted && mode === "different" && !inbound.origin && <div className="mt-1 text-xs text-red-600">{t("required")}</div>}
                    </div>
                    <div>
                      <label className="mb-1 block text-sm">{t("tableDestination")}</label>
                      <AirportAutocomplete invalid={attempted && mode === "different" && !inbound.destination} value={inbound.destination} onSelect={(iata) => setInbound({ ...inbound, destination: iata })} />
                      {attempted && mode === "different" && !inbound.destination && <div className="mt-1 text-xs text-red-600">{t("required")}</div>}
                    </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-sm">{t("date")}</label>
                  <CalendarInput
                    className={attempted && mode === "different" && !inbound.date ? "border-red-500 focus:ring-red-400" : ""}
                    value={inbound.date}
                    min={outbound.date || undefined}
                    onFocus={() => { if (!inbound.date && outbound.date) setInbound({ ...inbound, date: outbound.date }); }}
                    onChange={(e) => setInbound({ ...inbound, date: e.target.value })}
                  />
                  {attempted && mode === "different" && !inbound.date && <div className="mt-1 text-xs text-red-600">{t("required")}</div>}
                </div>
              </div>
            </div>

              <Button type="button" onClick={confirm}>{t("confirmInfo")}</Button>
            </div>
        </TabsContent>
          </Tabs>
      </div>
    </div>
  );
}
