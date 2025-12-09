"use client";
import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  const [rangeBase, setRangeBase] = useState<Date>(new Date());
  const [exampleOpen, setExampleOpen] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [hintRangeDiff, setHintRangeDiff] = useState(false);
  const [guideStep, setGuideStep] = useState<
    | null
    | "out_origin"
    | "out_dest"
    | "in_origin"
    | "in_dest"
    | "confirm"
    | "same_origin"
    | "same_dest"
    | "same_period"
    | "same_confirm"
  >(null);

  useEffect(() => {
    const id = setTimeout(() => {
      try {
        if (typeof window !== "undefined") {
          localStorage.removeItem("calentrip_trip_summary");
          localStorage.removeItem("calentrip:entertainment:records");
          localStorage.removeItem("calentrip:saved_calendar");
          localStorage.removeItem("calentrip:open_calendar_help");
          localStorage.removeItem("calentrip:arrivalNextDay_outbound");
        }
      } catch {}
      setSame({ origin: "", destination: "", departDate: "", returnDate: "", passengers: { adults: 1, children: 0, infants: 0 } });
      setOutbound({ origin: "", destination: "", date: "" });
      setInbound({ origin: "", destination: "", date: "" });
      setPassengers({ adults: 1, children: 0, infants: 0 });
      setAttempted(false);
      setGuideStep(null);
    }, 0);
    return () => clearTimeout(id);
  }, []);

  async function confirm() {
    const filledSame = Boolean(same.origin && same.destination && same.departDate && same.returnDate);
    const filledDiff = Boolean(outbound.origin && outbound.destination && outbound.date && inbound.origin && inbound.destination && inbound.date);
    if (mode === "different" || (filledDiff && !filledSame)) {
      setTripSearch({ mode: "different", outbound: { ...outbound }, inbound: { ...inbound }, passengers });
      show(t("infoConfirmed"));
      await new Promise((r) => setTimeout(r, 500));
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
      show(t("infoConfirmed"));
      await new Promise((r) => setTimeout(r, 500));
      router.push("/flights/book");
    } else {
      setAttempted(true);
      show(t("fillRequiredFieldsError"), { variant: "error" });
    }
  }

  return (
    <div className="min-h-screen px-4 py-6 pb-24">
      <div className="container-page">
        <h1 className="mb-1 text-2xl font-semibold text-[var(--brand)]">{t("searchFlightsTitle")}</h1>
        <p className="mb-4 text-sm text-zinc-600">{t("welcomeSearch")}</p>
      </div>
      <div className="container-page">
        <Tabs defaultValue="same" onValueChange={(v) => { const mv = v as "same" | "different"; setMode(mv); setGuideStep(null); if (mv === "different" && !(outbound.date && inbound.date)) { setHintRangeDiff(true); } else { setHintRangeDiff(false); } }}>
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
            <div className={guideStep === "same_origin" ? "ring-4 ring-amber-500 animate-pulse rounded-md" : undefined}>
              <label className="mb-1 block text-sm">{t("origin")}</label>
              <AirportAutocomplete invalid={attempted && mode === "same" && !same.origin} value={same.origin} onFocus={() => { if (mode === "same") setGuideStep("same_origin"); }} onSelect={(iata) => { setSame({ ...same, origin: iata }); if (mode === "same") setGuideStep("same_dest"); }} />
              {attempted && mode === "same" && !same.origin && <div className="mt-1 text-xs text-red-600">{t("required")}</div>}
            </div>
            <div className={guideStep === "same_dest" ? "ring-4 ring-amber-500 pulse-ring rounded-md" : undefined}>
              <label className="mb-1 block text-sm">{t("destination")}</label>
              <AirportAutocomplete invalid={attempted && mode === "same" && !same.destination} value={same.destination} onFocus={() => { if (mode === "same") setGuideStep("same_dest"); }} onSelect={(iata) => { setSame({ ...same, destination: iata }); if (mode === "same") setGuideStep("same_period"); }} />
              {attempted && mode === "same" && !same.destination && <div className="mt-1 text-xs text-red-600">{t("required")}</div>}
            </div>
              <div>
                <label className="mb-1 block text-sm">{t("departReturnDates")}</label>
                <Button type="button" variant="outline" className={(attempted && mode === "same" && !(same.departDate && same.returnDate) ? "ring-2 ring-red-400 " : "") + (guideStep === "same_period" ? " ring-4 ring-amber-500 pulse-ring " : "")} onClick={() => setRangeOpen(true)}>
                  {same.departDate && same.returnDate ? `${same.departDate} → ${same.returnDate}` : t("selectPeriodButton")}
                </Button>
                {attempted && mode === "same" && !(same.departDate && same.returnDate) && <div className="mt-1 text-xs text-red-600">{t("required")}</div>}
              </div>
            <Button type="button" className={guideStep === "same_confirm" ? "ring-4 ring-amber-500 animate-pulse" : undefined} onClick={() => { setGuideStep(null); confirm(); }}>{t("confirmInfo")}</Button>
          </div>
        </TabsContent>

        <TabsContent value="different">
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm">{t("passengers")}</label>
                <PassengerSelector value={passengers} onChange={setPassengers} />
              </div>
              <div>
                <label className="mb-1 block text-sm">{t("departReturnDates")}</label>
                <Button
                  type="button"
                  variant="outline"
                  className={(attempted && mode === "different" && !(outbound.date && inbound.date) ? "ring-2 ring-red-400 " : "") + (mode === "different" && hintRangeDiff ? " pulse-ring ring-4 ring-amber-500 " : "")}
                  onClick={() => { setRangeOpen(true); setHintRangeDiff(false); }}
                >
                  {outbound.date && inbound.date ? `${outbound.date} → ${inbound.date}` : t("selectPeriodButton")}
                </Button>
                {attempted && mode === "different" && !(outbound.date && inbound.date) && (
                  <div className="mt-1 text-xs text-red-600">{t("required")}</div>
                )}
                <div className="mt-2">
                  <Button type="button" variant="secondary" onClick={() => setExampleOpen(true)}>{t("exampleTripButton")}</Button>
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <h2 className="mb-2 text-sm font-semibold">{t("outboundFlight")}</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div className={guideStep === "out_origin" ? "ring-4 ring-amber-500 pulse-ring rounded-md" : undefined}>
                    <label className="mb-1 block text-sm">{t("tableOrigin")}</label>
                    <AirportAutocomplete invalid={attempted && mode === "different" && !outbound.origin} value={outbound.origin} onSelect={(iata) => { setOutbound({ ...outbound, origin: iata }); if (mode === "different") setGuideStep("out_dest"); }} />
                    {attempted && mode === "different" && !outbound.origin && <div className="mt-1 text-xs text-red-600">{t("required")}</div>}
                  </div>
                  <div className={guideStep === "out_dest" ? "ring-4 ring-amber-500 animate-pulse rounded-md" : undefined}>
                    <label className="mb-1 block text-sm">{t("tableDestination")}</label>
                    <AirportAutocomplete invalid={attempted && mode === "different" && !outbound.destination} value={outbound.destination} onSelect={(iata) => { setOutbound({ ...outbound, destination: iata }); if (mode === "different") setGuideStep("in_origin"); }} />
                    {attempted && mode === "different" && !outbound.destination && <div className="mt-1 text-xs text-red-600">{t("required")}</div>}
                  </div>
                </div>
              </div>

                <div className="rounded-lg border p-3">
                  <h2 className="mb-2 text-sm font-semibold">{t("inboundFlight")}</h2>
                  <div className="grid grid-cols-2 gap-3">
                    <div className={guideStep === "in_origin" ? "ring-4 ring-amber-500 animate-pulse rounded-md" : undefined}>
                      <label className="mb-1 block text-sm">{t("tableOrigin")}</label>
                      <AirportAutocomplete invalid={attempted && mode === "different" && !inbound.origin} value={inbound.origin} onSelect={(iata) => { setInbound({ ...inbound, origin: iata }); if (mode === "different") setGuideStep("in_dest"); }} />
                      {attempted && mode === "different" && !inbound.origin && <div className="mt-1 text-xs text-red-600">{t("required")}</div>}
                    </div>
                    <div className={guideStep === "in_dest" ? "ring-4 ring-amber-500 animate-pulse rounded-md" : undefined}>
                      <label className="mb-1 block text-sm">{t("tableDestination")}</label>
                      <AirportAutocomplete invalid={attempted && mode === "different" && !inbound.destination} value={inbound.destination} onSelect={(iata) => { setInbound({ ...inbound, destination: iata }); if (mode === "different") setGuideStep("confirm"); }} />
                      {attempted && mode === "different" && !inbound.destination && <div className="mt-1 text-xs text-red-600">{t("required")}</div>}
                    </div>
                  </div>
                </div>

              <Button type="button" className={guideStep === "confirm" ? "ring-4 ring-amber-500 animate-pulse" : undefined} onClick={() => { setGuideStep(null); confirm(); }}>{t("confirmInfo")}</Button>
            </div>
        </TabsContent>
          </Tabs>
      </div>
      <Dialog open={exampleOpen} onOpenChange={setExampleOpen} placement="bottom">
        <DialogHeader>{t("exampleDialogTitle")}</DialogHeader>
        <div className="p-4 md:p-6 space-y-4 text-sm">
          <div className="rounded-lg border p-3 dark:border-zinc-800">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-600">{t("exampleOutboundLabel")}</div>
            <div className="mt-1 text-base font-medium">{t("exampleOutboundDesc")}</div>
            <div className="mt-1 text-zinc-600">{t("exampleOutboundNote")}</div>
          </div>
          <div className="rounded-lg border p-3 dark:border-zinc-800">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-600">{t("exampleStayLabel")}</div>
            <div className="mt-1 text-base font-medium">{t("exampleStayDesc1")}</div>
            <div className="mt-1 text-zinc-600">{t("exampleStaySuggestionRome")}</div>
          </div>
          <div className="rounded-lg border p-3 dark:border-zinc-800">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-600">{t("exampleTransportLabel")}</div>
            <div className="mt-1 text-base font-medium">{t("exampleTransportDescRomeFlorence")}</div>
            <div className="mt-1 text-zinc-600">{t("exampleTransportRomeFlorenceNote")}</div>
          </div>
          <div className="rounded-lg border p-3 dark:border-zinc-800">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-600">{t("exampleStayLabel")}</div>
            <div className="mt-1 text-base font-medium">{t("exampleStayDesc2")}</div>
            <div className="mt-1 text-zinc-600">{t("exampleStaySuggestionFlorence")}</div>
          </div>
          <div className="rounded-lg border p-3 dark:border-zinc-800">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-600">{t("exampleTransportLabel")}</div>
            <div className="mt-1 text-base font-medium">{t("exampleTransportDescFlorenceMilan")}</div>
            <div className="mt-1 text-zinc-600">{t("exampleTransportFlorenceMilanNote")}</div>
          </div>
          <div className="rounded-lg border p-3 dark:border-zinc-800">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-600">{t("exampleStayLabel")}</div>
            <div className="mt-1 text-base font-medium">{t("exampleStayDesc3")}</div>
            <div className="mt-1 text-zinc-600">{t("exampleStaySuggestionMilan")}</div>
          </div>
          <div className="rounded-lg border p-3 dark:border-zinc-800">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-600">{t("exampleReturnLabel")}</div>
            <div className="mt-1 text-base font-medium">{t("exampleReturnDesc")}</div>
            <div className="mt-1 text-zinc-600">{t("exampleAirportTipText")}</div>
          </div>
          <div className="rounded-lg border p-3 bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-600">{t("exampleSummaryLabel")}</div>
            <div className="mt-1">{t("exampleRouteExampleText")}</div>
            <div className="mt-1 text-zinc-600">{t("exampleFormatNote")}</div>
          </div>
          <div className="flex justify-end">
            <Button type="button" onClick={() => setExampleOpen(false)}>{t("close")}</Button>
          </div>
        </div>
      </Dialog>
      {rangeOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setRangeOpen(false)} />
          <div
            className="absolute bottom-0 left-0 right-0 z-10 w-full rounded-t-2xl border border-zinc-200 bg-white p-5 md:p-6 shadow-xl dark:border-zinc-800 dark:bg-black"
            onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
            onTouchEnd={(e) => {
              if (touchStartX !== null) {
                const dx = e.changedTouches[0].clientX - touchStartX;
                if (Math.abs(dx) > 50) {
                  setRangeBase(new Date(rangeBase.getFullYear(), rangeBase.getMonth() + (dx < 0 ? 1 : -1), 1));
                }
                setTouchStartX(null);
              }
            }}
          >
            <div className="mb-3 text-lg font-semibold">{t("rangeOverlayTitle")}</div>
            <div className="mb-3 flex items-center justify-between hidden sm:flex">
              <button type="button" className="inline-flex h-8 px-2 items-center justify-center rounded-md border border-zinc-300 text-sm hover:bg-zinc-100 dark:border-zinc-700" onClick={() => setRangeBase(new Date(rangeBase.getFullYear(), rangeBase.getMonth() - 1, 1))}>
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                <span>{t("previousMonth")}</span>
              </button>
              <div className="text-sm font-medium">
                {rangeBase.toLocaleDateString(undefined, { month: "long", year: "numeric" })} • {new Date(rangeBase.getFullYear(), rangeBase.getMonth() + 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              </div>
              <button type="button" className="inline-flex h-8 px-2 items-center justify-center rounded-md border border-zinc-300 text-sm hover:bg-zinc-100 dark:border-zinc-700" onClick={() => setRangeBase(new Date(rangeBase.getFullYear(), rangeBase.getMonth() + 1, 1))}>
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                <span>{t("nextMonth")}</span>
              </button>
            </div>
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
                const base = rangeBase;
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
                    {mi === 0 && (
                      <div className="my-2 flex items-center justify-center gap-3 sm:hidden">
                        <button type="button" aria-label={t("previousMonthAria")} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700" onClick={() => setRangeBase(new Date(rangeBase.getFullYear(), rangeBase.getMonth() - 1, 1))}>
                          <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                        </button>
                        <button type="button" aria-label={t("nextMonthAria")} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700" onClick={() => setRangeBase(new Date(rangeBase.getFullYear(), rangeBase.getMonth() + 1, 1))}>
                          <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                        </button>
                      </div>
                    )}
                  </div>
                ));
              })()}
            </div>
            <div className="mt-4 flex justify-between">
              <Button type="button" variant="outline" onClick={() => { setRangeStart(""); setRangeEnd(""); }}>{t("clear")}</Button>
              <Button
                type="button"
                onClick={() => {
                  if (rangeStart && rangeEnd) {
                    if (mode === "same") {
                      setSame({ ...same, departDate: rangeStart, returnDate: rangeEnd });
                      setGuideStep("same_confirm");
                    } else {
                      setOutbound({ ...outbound, date: rangeStart });
                      setInbound({ ...inbound, date: rangeEnd });
                      setGuideStep("out_origin");
                    }
                    setRangeOpen(false);
                  }
                }}
                disabled={!rangeStart || !rangeEnd}
                >
                  {t("apply")}
                </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
