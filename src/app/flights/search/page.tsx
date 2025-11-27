"use client";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CalendarInput } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
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
  const [rangeOpen, setRangeOpen] = useState(false);
  const [rangeStart, setRangeStart] = useState<string>("");
  const [rangeEnd, setRangeEnd] = useState<string>("");
  const [exampleOpen, setExampleOpen] = useState(false);

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
        <Tabs defaultValue="same" onValueChange={(v) => setMode(v as "same" | "different")}>
          <TabsList>
          <TabsTrigger value="same">{t("searchTabSame")}</TabsTrigger>
          <TabsTrigger value="different">{t("searchTabDifferent")}</TabsTrigger>
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
              <div>
                <label className="mb-1 block text-sm">Data de Ida/Volta</label>
                <Button type="button" variant="outline" className={attempted && mode === "same" && !(same.departDate && same.returnDate) ? "ring-2 ring-red-400" : ""} onClick={() => setRangeOpen(true)}>
                  {same.departDate && same.returnDate ? `${same.departDate} → ${same.returnDate}` : "Selecionar período"}
                </Button>
                {attempted && mode === "same" && !(same.departDate && same.returnDate) && <div className="mt-1 text-xs text-red-600">{t("required")}</div>}
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
              <div>
                <label className="mb-1 block text-sm">Data de Ida/Volta</label>
                <Button
                  type="button"
                  variant="outline"
                  className={attempted && mode === "different" && !(outbound.date && inbound.date) ? "ring-2 ring-red-400" : ""}
                  onClick={() => setRangeOpen(true)}
                >
                  {outbound.date && inbound.date ? `${outbound.date} → ${inbound.date}` : "Selecionar período"}
                </Button>
                {attempted && mode === "different" && !(outbound.date && inbound.date) && (
                  <div className="mt-1 text-xs text-red-600">{t("required")}</div>
                )}
                <div className="mt-2">
                  <Button type="button" variant="secondary" onClick={() => setExampleOpen(true)}>Exemplo de viagem</Button>
                </div>
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
                  </div>
                </div>

              <Button type="button" onClick={confirm}>{t("confirmInfo")}</Button>
            </div>
        </TabsContent>
          </Tabs>
      </div>
      <Dialog open={exampleOpen} onOpenChange={setExampleOpen} placement="bottom">
        <DialogHeader>Exemplo de viagem — aeroportos diferentes</DialogHeader>
        <div className="p-4 md:p-6 space-y-4 text-sm">
          <div className="rounded-lg border p-3 dark:border-zinc-800">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Voo de ida</div>
            <div className="mt-1 text-base font-medium">Guarulhos (GRU) → Roma Fiumicino (FCO)</div>
            <div className="mt-1 text-zinc-600">Chegada em Roma e início da viagem</div>
          </div>
          <div className="rounded-lg border p-3 dark:border-zinc-800">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Hospedagem</div>
            <div className="mt-1 text-base font-medium">Roma • 5 dias</div>
            <div className="mt-1 text-zinc-600">Sugestão: escolha hospedagem próxima a metrô ou principais pontos turísticos.</div>
          </div>
          <div className="rounded-lg border p-3 dark:border-zinc-800">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Transporte</div>
            <div className="mt-1 text-base font-medium">Trem Roma → Firenze</div>
            <div className="mt-1 text-zinc-600">Viagem rápida (cerca de 1h30–2h). Compre com antecedência para melhor preço.</div>
          </div>
          <div className="rounded-lg border p-3 dark:border-zinc-800">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Hospedagem</div>
            <div className="mt-1 text-base font-medium">Firenze • 6 dias</div>
            <div className="mt-1 text-zinc-600">Explore a Toscana em bate-voltas (Pisa, Siena). Reserve com cancelamento grátis.</div>
          </div>
          <div className="rounded-lg border p-3 dark:border-zinc-800">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Transporte</div>
            <div className="mt-1 text-base font-medium">Trem Firenze → Milão</div>
            <div className="mt-1 text-zinc-600">Alta velocidade (cerca de 1h45–2h). Chegue perto da estação Milano Centrale.</div>
          </div>
          <div className="rounded-lg border p-3 dark:border-zinc-800">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Hospedagem</div>
            <div className="mt-1 text-base font-medium">Milão • 5 dias</div>
            <div className="mt-1 text-zinc-600">Inclua bate-volta ao Lago de Como, se desejar.</div>
          </div>
          <div className="rounded-lg border p-3 dark:border-zinc-800">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Voo de volta</div>
            <div className="mt-1 text-base font-medium">Milão (MXP/LIN) → Guarulhos (GRU)</div>
            <div className="mt-1 text-zinc-600">Selecione o aeroporto mais conveniente (MXP geralmente tem mais opções internacionais).</div>
          </div>
          <div className="rounded-lg border p-3 bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Resumo</div>
            <div className="mt-1">Roteiro exemplo: <span className="font-medium">GRU → FCO</span> • <span className="font-medium">Roma (5d)</span> • <span className="font-medium">Trem para Firenze</span> • <span className="font-medium">Firenze (6d)</span> • <span className="font-medium">Trem para Milão</span> • <span className="font-medium">Milão (5d)</span> • <span className="font-medium">MXP/LIN → GRU</span></div>
            <div className="mt-1 text-zinc-600">Use este formato para planejar e salvar sua pesquisa com aeroportos diferentes.</div>
          </div>
          <div className="flex justify-end">
            <Button type="button" onClick={() => setExampleOpen(false)}>Fechar</Button>
          </div>
        </div>
      </Dialog>
      {rangeOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setRangeOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 z-10 w-full rounded-t-2xl border border-zinc-200 bg-white p-5 md:p-6 shadow-xl dark:border-zinc-800 dark:bg-black">
            <div className="mb-3 text-lg font-semibold">Selecione Ida e Volta</div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(() => {
                function buildMonth(base: Date) {
                  const y = base.getFullYear();
                  const m = base.getMonth();
                  const start = new Date(y, m, 1);
                  const end = new Date(y, m + 1, 0);
                  const days: Array<{ date: string; label: string }>=[];
                  for (let d = 1; d <= end.getDate(); d++) {
                    const dt = new Date(y, m, d);
                    const iso = `${String(dt.getFullYear())}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
                    days.push({ date: iso, label: String(d) });
                  }
                  const pad = (start.getDay() + 6) % 7;
                  const pre = Array.from({ length: pad }, () => ({ date: "", label: "" }));
                  return [...pre, ...days];
                }
                const base = new Date();
                const months = [base, new Date(base.getFullYear(), base.getMonth()+1, 1)];
                return months.map((mo, mi) => (
                  <div key={`m-${mi}`}>
                    <div className="mb-2 text-sm font-semibold">{mo.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</div>
                    <div className="grid grid-cols-7 gap-2 text-sm">
                      {buildMonth(mo).map((d, idx) => {
                        const selected = Boolean(d.date && ((rangeStart && d.date === rangeStart) || (rangeEnd && d.date === rangeEnd)));
                        const inRange = Boolean(d.date && rangeStart && rangeEnd && (new Date(d.date) >= new Date(rangeStart)) && (new Date(d.date) <= new Date(rangeEnd)));
                        const disabled = !!(d.date && d.date < todayISO);
                        const cls = !d.date ? "h-10 rounded border border-transparent" : disabled ? "h-10 rounded border border-zinc-200 text-zinc-400 dark:border-zinc-800" : selected ? "h-10 rounded border border-[#007AFF] bg-[#007AFF]/10" : inRange ? "h-10 rounded border border-[#007AFF]/40 bg-[#007AFF]/5" : "h-10 rounded border border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800";
                        return (
                          <button key={`d-${idx}`} type="button" disabled={!d.date || disabled} className={cls} onClick={() => {
                            if (!rangeStart) { setRangeStart(d.date); }
                            else if (!rangeEnd && new Date(d.date) >= new Date(rangeStart)) { setRangeEnd(d.date); }
                            else { setRangeStart(d.date); setRangeEnd(""); }
                          }}>{d.label}</button>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()}
            </div>
            <div className="mt-4 flex justify-between">
              <Button type="button" variant="outline" onClick={() => { setRangeStart(""); setRangeEnd(""); }}>Limpar</Button>
              <Button
                type="button"
                onClick={() => {
                  if (rangeStart && rangeEnd) {
                    if (mode === "same") {
                      setSame({ ...same, departDate: rangeStart, returnDate: rangeEnd });
                    } else {
                      setOutbound({ ...outbound, date: rangeStart });
                      setInbound({ ...inbound, date: rangeEnd });
                    }
                    setRangeOpen(false);
                  }
                }}
                disabled={!rangeStart || !rangeEnd}
              >
                Aplicar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
