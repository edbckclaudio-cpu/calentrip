"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Leg = {
  origin: string;
  destination: string;
  date: string;
  time?: string;
  flightNumber?: string;
};

export type Passengers = { adults: number; children: number; infants: number };

export type TripSearchSame = {
  mode: "same";
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string;
  passengers: Passengers;
  departTime?: string;
  returnTime?: string;
  departFlightNumber?: string;
  returnFlightNumber?: string;
};

export type TripSearchDifferent = {
  mode: "different";
  outbound: Leg;
  inbound: Leg;
  passengers: Passengers;
};

export type TripSearch = TripSearchSame | TripSearchDifferent | null;

type TripContextValue = {
  tripSearch: TripSearch;
  setTripSearch: (t: TripSearch) => void;
};

const TripContext = createContext<TripContextValue | undefined>(undefined);

export function TripProvider({ children }: { children: ReactNode }) {
  const [tripSearch, _setTripSearch] = useState<TripSearch>(null);

  function setTripSearch(t: TripSearch) {
    _setTripSearch(t);
    try {
      if (typeof window !== "undefined") {
        if (t) {
          const s = JSON.stringify(t);
          localStorage.setItem("calentrip:tripSearch", s);
          try { sessionStorage.setItem("calentrip:tripSearch", s); } catch {}
        } else {
          localStorage.removeItem("calentrip:tripSearch");
          try { sessionStorage.removeItem("calentrip:tripSearch"); } catch {}
        }
      }
    } catch {}
  }

  useEffect(() => {
    if (tripSearch !== null) return;
    let id: number | undefined;
    try {
      if (typeof window !== "undefined") {
        const rawS = sessionStorage.getItem("calentrip:tripSearch");
        const rawL = !rawS ? localStorage.getItem("calentrip:tripSearch") : null;
        const raw = rawS || rawL;
        if (raw) {
          const obj = JSON.parse(raw);
          id = window.setTimeout(() => _setTripSearch(obj), 0);
        }
      }
    } catch {}
    return () => { if (id) { try { clearTimeout(id); } catch {} } };
  }, [tripSearch]);

  return <TripContext.Provider value={{ tripSearch, setTripSearch }}>{children}</TripContext.Provider>;
}

export function useTrip() {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error("useTrip deve ser usado dentro de TripProvider");
  return ctx;
}
