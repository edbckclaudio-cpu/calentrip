export type FlightNote = {
  leg: "outbound" | "inbound";
  origin: string;
  destination: string;
  date: string;
  departureTime?: string;
  arrivalTime?: string;
  flightNumber?: string;
  arrivalNextDay?: boolean;
};

export type AttachmentMeta = {
  leg?: "outbound" | "inbound" | "stay";
  name: string;
  type: string;
  size: number;
  id?: string;
  dataUrl?: string;
};

export type TripItem = {
  id: string;
  title: string;
  date: string;
  passengers: number;
  flightNotes?: FlightNote[];
  attachments?: AttachmentMeta[];
  stayAddress?: string;
  reachedFinalCalendar?: boolean;
  savedCalendarName?: string;
  savedEvents?: unknown[];
};

const KEY = "calentrip:trips";

export function getTrips(): TripItem[] {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
    const list: TripItem[] = raw ? JSON.parse(raw) : [];
    function key(t: TripItem) {
      const dates = (t.flightNotes && t.flightNotes.length ? t.flightNotes.map((n) => n.date) : [t.date]).filter(Boolean).sort();
      const d = dates[0] ?? "";
      const ts = Date.parse(d);
      return Number.isFinite(ts) ? ts : 0;
    }
    return [...list].sort((a, b) => key(a) - key(b));
  } catch {
    return [];
  }
}

export function addTrip(t: TripItem) {
  try {
    // disabled: do not persist saved searches to localStorage
    void t;
  } catch {}
}

export function removeTrip(id: string) {
  try {
    // disabled: do not persist saved searches to localStorage
    void id;
  } catch {}
}
