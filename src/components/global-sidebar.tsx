"use client";
import { useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import Image from "next/image";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { getSavedTrips, getTripEvents, removeTrip, TripItem, addTrip, FlightNote } from "@/lib/trips-db";
import { useTrip } from "@/lib/trip-context";
import { findAirportByIata } from "@/lib/airports";
import { useRouter } from "next/navigation";

export default function GlobalSidebar() {
  const router = useRouter();
  type SavedCalendar = { name: string; events: Array<{ date: string; time?: string; label: string; type?: string; meta?: unknown }>; savedAt?: string };
  const [sideOpen, setSideOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [savedTrips, setSavedTrips] = useState<TripItem[]>([]);
  const [savedCalendars, setSavedCalendars] = useState<SavedCalendar[]>([]);
  const { data: session, status } = useSession();
  const { lang, t } = useI18n();
  const { tripSearch, setTripSearch } = useTrip();


  return (
    <>
      <div className={sideOpen ? "fixed left-0 top-0 bottom-0 z-40 w-56 border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black transition-all" : "fixed left-0 top-0 bottom-0 z-40 w-14 border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black transition-all"}>
        <div className="h-14 flex items-center justify-center border-b border-zinc-200 dark:border-zinc-800">
          <button type="button" className="rounded-md p-2" onClick={() => setSideOpen((v) => !v)}>
            <span className="material-symbols-outlined text-[24px]">menu</span>
          </button>
        </div>
        <div className="p-2 space-y-2">
          <div
            className="rounded-md border border-zinc-200 dark:border-zinc-800 p-2 cursor-pointer"
            onClick={() => {
              try {
                if (status !== "authenticated") router.push("/profile");
              } catch {}
            }}
          >
            {status === "authenticated" ? (
              <div className="flex items-center gap-2">
                {session?.user?.image ? (
                  <Image src={session.user.image} alt="avatar" width={32} height={32} className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-xs">{(session?.user?.name || session?.user?.email || "PF").slice(0, 2).toUpperCase()}</span>
                )}
                {sideOpen ? (
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{session?.user?.name || t("userWord")}</div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400">{session?.user?.email || ""}</div>
                    <div className="mt-1 text-[10px] text-zinc-500">Idioma: {lang.toUpperCase()}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <button type="button" className="underline text-xs" onClick={() => router.push("/profile")}>{t("viewProfile")}</button>
                      <button type="button" className="text-xs" onClick={() => signOut()}>{t("signOut")}</button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-xs">PF</span>
                {sideOpen ? (
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{t("signInTitle")}</div>
                    <div className="mt-1 text-[10px] text-zinc-500">Idioma: {lang.toUpperCase()}</div>
                    <div className="mt-2">
                      <button type="button" className="underline text-xs" onClick={() => router.push("/profile")}>{t("openProfileButton")}</button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-md px-3 h-10 hover:bg-zinc-50 dark:hover:bg-zinc-900"
            onClick={async () => {
              try {
                if (tripSearch) {
                  const isSame = tripSearch.mode === "same";
                  const destIata = isSame ? tripSearch.destination : tripSearch.inbound.destination;
                  let cityName = destIata || "";
                  try { const a = await findAirportByIata(destIata); if (a?.city) cityName = a.city; } catch {}
                  const departDate = isSame ? tripSearch.departDate : tripSearch.outbound.date;
                  const returnDate = isSame ? tripSearch.returnDate : tripSearch.inbound.date;
                  const departTime = isSame ? tripSearch.departTime : tripSearch.outbound.time;
                  const returnTime = isSame ? tripSearch.returnTime : tripSearch.inbound.time;
                  const pax = tripSearch.passengers.adults + tripSearch.passengers.children + tripSearch.passengers.infants;
                  const id = Math.random().toString(36).slice(2);
                  const title = [cityName, departDate, departTime ? `(${departTime})` : null].filter(Boolean).join(" ");
                  const flightNotes: FlightNote[] = [
                    { leg: "outbound", origin: isSame ? tripSearch.origin : tripSearch.outbound.origin, destination: destIata || "", date: departDate, departureTime: departTime },
                    { leg: "inbound", origin: isSame ? tripSearch.destination : tripSearch.inbound.origin, destination: isSame ? tripSearch.origin : tripSearch.outbound.destination, date: returnDate, departureTime: returnTime },
                  ];
                  addTrip({ id, title, date: departDate, passengers: pax, flightNotes });
                }
              } catch {}
              try {
                if (typeof window !== "undefined") {
                  localStorage.removeItem("calentrip_trip_summary");
                  localStorage.removeItem("calentrip:entertainment:records");
                  localStorage.removeItem("calentrip:tripSearch");
                  localStorage.removeItem("calentrip:arrivalNextDay_outbound");
                  localStorage.removeItem("calentrip:arrivalNextDay_inbound");
                }
                setTripSearch(null);
              } catch {}
              router.push("/flights/search");
            }}
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800">
              <span className="material-symbols-outlined text-[22px] text-[#007AFF]">travel_explore</span>
            </span>
            {sideOpen ? <span className="text-sm font-medium">{t("startNewSearch")}</span> : null}
          </button>
          <button type="button" className="flex w-full items-center gap-3 rounded-md px-3 h-10 hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={() => {
            try { if (typeof window !== "undefined") localStorage.setItem("calentrip:open_saved_drawer", "1"); } catch {}
            router.push("/calendar/final");
          }}>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800">
              <span className="material-symbols-outlined text-[22px] text-[#007AFF]">lists</span>
            </span>
            {sideOpen ? <span className="text-sm font-medium">{t("savedSearchesTitle")}</span> : null}
          </button>
          <button type="button" className="flex w-full items-center gap-3 rounded-md px-3 h-10 hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={() => router.push("/calendar/final")}>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800">
              <span className="material-symbols-outlined text-[22px] text-[#007AFF]">list_alt</span>
            </span>
            {sideOpen ? <span className="text-sm font-medium">{t("calendarList")}</span> : null}
          </button>
          <button type="button" className="flex w-full items-center gap-3 rounded-md px-3 h-10 hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={() => router.push("/calendar/month")}>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800">
              <span className="material-symbols-outlined text-[22px]">calendar_month</span>
            </span>
            {sideOpen ? <span className="text-sm font-medium">{t("calendarMonth")}</span> : null}
          </button>
          <button type="button" className="flex w-full items-center gap-3 rounded-md px-3 h-10 hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={() => router.push("/profile")}>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800">
              <span className="material-symbols-outlined text-[22px] text-[#007AFF]">account_circle</span>
            </span>
            {sideOpen ? <span className="text-sm font-medium">{t("profile")}</span> : null}
          </button>
        </div>
      </div>
      {sideOpen ? (
        <div className="fixed top-0 right-0 bottom-0 left-56 z-30 bg-black/10" onClick={() => setSideOpen(false)} />
      ) : null}

      <Dialog open={savedOpen} onOpenChange={setSavedOpen} placement="bottom">
      <DialogHeader>{t("savedSearchesTitle")}</DialogHeader>
      <div className="p-4 md:p-6 space-y-4 text-sm max-h-[70vh] overflow-y-auto">
          <div className="rounded border p-3">
            <div className="font-semibold mb-1">{t("savedCalendarsTitle")}</div>
            {savedCalendars.length ? (
              <ul className="space-y-2">
                {savedCalendars.map((c, idx) => (
                  <li key={`${c.name}-${idx}`} className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium">{c.name}</div>
                      <div className="text-xs text-zinc-600">{(c.events || []).length} {t("eventsWord")}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" onClick={() => {
                        try {
                          if (typeof window !== "undefined") {
                            localStorage.setItem("calentrip:saved_calendar", JSON.stringify({ name: c.name, events: c.events }));
                            localStorage.setItem("calentrip:auto_load_saved", "1");
                          }
                          router.push("/calendar/final");
                        } catch {}
                      }}>{t("loadLabel")}</Button>
                      <Button type="button" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => {
                        try {
                          const ok1 = confirm(`Deseja excluir o calendário \"${c.name}\"?`);
                          if (!ok1) return;
                          const ok2 = confirm("Tem certeza? Esta ação não pode ser desfeita.");
                          if (!ok2) return;
                          const raw = typeof window !== "undefined" ? localStorage.getItem("calentrip:saved_calendars_list") : null;
                          const list = raw ? (JSON.parse(raw) as SavedCalendar[]) : [];
                          const next = list.filter((x) => (x?.name || "") !== (c?.name || ""));
                          localStorage.setItem("calentrip:saved_calendars_list", JSON.stringify(next));
                          setSavedCalendars(next);
                        } catch {}
                      }}>{t("deleteLabel")}</Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-zinc-600">{t("noSavedCalendarsLabel")}</div>
            )}
          </div>
          <div className="rounded border p-3">
            <div className="font-semibold mb-1">{t("savedSearchesTitle")}</div>
            {savedTrips.length === 0 ? (
              <div className="text-zinc-600">{t("noSavedSearchesLabel")}</div>
            ) : (
              <ul className="space-y-2">
                {savedTrips.map((it) => (
                  <li key={it.id} className="flex items-center justify-between gap-3 rounded border p-2">
                    <div>
                      <div className="text-sm font-medium">{it.title}</div>
                      <div className="text-xs text-zinc-600 dark:text-zinc-400">{it.date} • {it.passengers} pax</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" onClick={async () => {
                        try {
                          const events = await getTripEvents(it.id);
                          if (typeof window !== "undefined") {
                            localStorage.setItem("calentrip:saved_calendar", JSON.stringify({ name: it.savedCalendarName || it.title, events }));
                            localStorage.setItem("calentrip:auto_load_saved", "1");
                          }
                          router.push("/calendar/final");
                        } catch {}
                      }}>{t("calendarList")}</Button>
                      <Button type="button" variant="outline" onClick={async () => {
                        try {
                          const events = await getTripEvents(it.id);
                          if (typeof window !== "undefined") {
                            localStorage.setItem("calentrip:saved_calendar", JSON.stringify({ name: it.savedCalendarName || it.title, events }));
                            localStorage.setItem("calentrip:auto_load_saved", "1");
                          }
                          router.push("/calendar/month");
                        } catch {}
                      }}>{t("calendarMonth")}</Button>
                      <Button type="button" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={async () => {
                        try { await removeTrip(it.id); } catch {}
                        try { const trips = await getSavedTrips(); setSavedTrips(trips.filter((x) => x.reachedFinalCalendar)); } catch { setSavedTrips([]); }
                      }}>Apagar</Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setSavedOpen(false)}>Fechar</Button>
          </DialogFooter>
        </div>
      </Dialog>
    </>
  );
}
