"use client";
import { useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import Image from "next/image";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { getTrips, TripItem, addTrip, removeTrip, FlightNote } from "@/lib/trips-store";
import { useTrip } from "@/lib/trip-context";
import { findAirportByIata } from "@/lib/airports";

export default function GlobalSidebar() {
  const [sideOpen, setSideOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [savedTrips, setSavedTrips] = useState<TripItem[]>([]);
  const { data: session, status } = useSession();
  const { lang, t } = useI18n();
  const { tripSearch, setTripSearch } = useTrip();

  function openSaved() {
    try { setSavedTrips(getTrips().filter((t) => t.reachedFinalCalendar)); } catch { setSavedTrips([]); }
    setSavedOpen(true);
  }

  return (
    <>
      <div className={sideOpen ? "fixed left-0 top-0 bottom-0 z-40 w-56 border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black transition-all" : "fixed left-0 top-0 bottom-0 z-40 w-14 border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black transition-all"}>
        <div className="h-14 flex items-center justify-center border-b border-zinc-200 dark:border-zinc-800">
          <button type="button" className="rounded-md p-2" onClick={() => setSideOpen((v) => !v)}>
            <span className="material-symbols-outlined text-[24px]">menu</span>
          </button>
        </div>
        <div className="p-2 space-y-2">
          <div className="rounded-md border border-zinc-200 dark:border-zinc-800 p-2">
            {status === "authenticated" ? (
              <div className="flex items-center gap-2">
                {session?.user?.image ? (
                  <Image src={session.user.image} alt="avatar" width={32} height={32} className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-xs">{(session?.user?.name || session?.user?.email || "PF").slice(0, 2).toUpperCase()}</span>
                )}
                {sideOpen ? (
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{session?.user?.name || "Usuário"}</div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400">{session?.user?.email || ""}</div>
                    <div className="mt-1 text-[10px] text-zinc-500">Idioma: {lang.toUpperCase()}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <button type="button" className="underline text-xs" onClick={() => { try { window.location.href = "/profile"; } catch {} }}>Ver perfil</button>
                      <button type="button" className="text-xs" onClick={() => signOut()}>Sair</button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-xs">PF</span>
                {sideOpen ? (
                  <div className="flex-1">
                    <div className="text-sm font-semibold">Entrar</div>
                    <div className="mt-1 text-[10px] text-zinc-500">Idioma: {lang.toUpperCase()}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <button type="button" className="text-xs" onClick={() => signIn("google")}>Google</button>
                      <button type="button" className="text-xs" onClick={() => signIn("credentials", { email: "demo@calentrip.com", password: "demo", callbackUrl: "/flights/search" })}>Demo</button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <button type="button" className="flex w-full items-center gap-3 rounded-md px-3 h-10 hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={openSaved}>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800">
              <span className="material-symbols-outlined text-[22px] text-[#007AFF]">lists</span>
            </span>
            {sideOpen ? <span className="text-sm font-medium">Pesquisas salvas</span> : null}
          </button>
          <button type="button" className="flex w-full items-center gap-3 rounded-md px-3 h-10 hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={() => { try { window.location.href = "/calendar/final"; } catch {} }}>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800">
              <span className="material-symbols-outlined text-[22px] text-[#007AFF]">list_alt</span>
            </span>
            {sideOpen ? <span className="text-sm font-medium">Calendário em lista</span> : null}
          </button>
          <button type="button" className="flex w-full items-center gap-3 rounded-md px-3 h-10 hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={() => { try { window.location.href = "/calendar/month"; } catch {} }}>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800">
              <span className="material-symbols-outlined text-[22px]">calendar_month</span>
            </span>
            {sideOpen ? <span className="text-sm font-medium">Calendário mensal</span> : null}
          </button>
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
                  localStorage.removeItem("calentrip:saved_calendar");
                  localStorage.removeItem("calentrip:tripSearch");
                }
                setTripSearch(null);
              } catch {}
              try { window.location.href = "/flights/search"; } catch {}
            }}
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800">
              <span className="material-symbols-outlined text-[22px] text-[#007AFF]">travel_explore</span>
            </span>
            {sideOpen ? <span className="text-sm font-medium">Iniciar nova pesquisa</span> : null}
          </button>
          <button type="button" className="flex w-full items-center gap-3 rounded-md px-3 h-10 hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={() => { try { window.location.href = "/profile"; } catch {} }}>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800">
              <span className="material-symbols-outlined text-[22px] text-[#007AFF]">account_circle</span>
            </span>
            {sideOpen ? <span className="text-sm font-medium">Perfil</span> : null}
          </button>
        </div>
      </div>
      {sideOpen ? (
        <div className="fixed top-0 right-0 bottom-0 left-56 z-30 bg-black/10" onClick={() => setSideOpen(false)} />
      ) : null}

      <Dialog open={savedOpen} onOpenChange={setSavedOpen} placement="bottom">
        <DialogHeader>Pesquisas salvas</DialogHeader>
        <div className="p-4 md:p-6 space-y-4 text-sm max-h-[70vh] overflow-y-auto">
          {savedTrips.length === 0 ? (
            <div className="text-zinc-600">Nenhuma viagem salva.</div>
          ) : (
            <ul className="space-y-2">
              {savedTrips.map((it) => (
                <li key={it.id} className="flex items-center justify-between gap-3 rounded border p-2">
                  <div>
                    <div className="text-sm font-medium">{it.title}</div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400">{it.date} • {it.passengers} pax</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" onClick={() => { try { window.location.href = "/calendar/final"; } catch {} }}>{t("calendarList")}</Button>
                    <Button type="button" variant="outline" onClick={() => { try { window.location.href = "/calendar/month"; } catch {} }}>{t("calendarMonth")}</Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => {
                        try { removeTrip(it.id); } catch {}
                        try { setSavedTrips(getTrips().filter((x) => x.reachedFinalCalendar)); } catch { setSavedTrips([]); }
                      }}
                    >
                      Apagar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button type="button" onClick={() => setSavedOpen(false)}>Fechar</Button>
          </DialogFooter>
        </div>
      </Dialog>
    </>
  );
}
