"use client";
import { createContext, useContext, useState, ReactNode } from "react";

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
        if (t) localStorage.setItem("calentrip:tripSearch", JSON.stringify(t));
        else localStorage.removeItem("calentrip:tripSearch");
      }
    } catch {}
  }

  if (typeof window !== "undefined") {
    if (tripSearch === null) {
      try {
        const raw = localStorage.getItem("calentrip:tripSearch");
        if (raw) _setTripSearch(JSON.parse(raw));
      } catch {}
    }
  }

  return <TripContext.Provider value={{ tripSearch, setTripSearch }}>{children}</TripContext.Provider>;
}

export function useTrip() {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error("useTrip deve ser usado dentro de TripProvider");
  return ctx;
}
