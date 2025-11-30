import sample from "@/data/airports.sample.json";

export type Airport = { iata: string; name: string; city: string; country: string; aliases?: string[] };
type MwggAirport = { iata?: string; name?: string; city?: string; country?: string };

let cache: Airport[] | null = null;
let loading: Promise<Airport[]> | null = null;
const LS_KEY = "calentrip:airports:v1";
const SOURCE = "https://raw.githubusercontent.com/mwgg/Airports/master/airports.json";

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function fromLocal(): Airport[] | null {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;
    return raw ? (JSON.parse(raw) as Airport[]) : null;
  } catch {
    return null;
  }
}

function toLocal(arr: Airport[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(arr));
  } catch {}
}

async function loadAirports(): Promise<Airport[]> {
  if (cache) return cache;
  const local = fromLocal();
  if (local && local.length > 5000) {
    cache = enrich(local);
    return cache;
  }
  if (!loading) {
    loading = (async () => {
      try {
        const res = await fetch(SOURCE);
        const json = (await res.json()) as Record<string, MwggAirport>;
        const arr: Airport[] = Object.values(json)
          .map((a) => ({ iata: a.iata ?? "", name: a.name ?? "", city: a.city ?? "", country: a.country ?? "", aliases: [] }))
          .filter((a) => a.iata && a.iata.length === 3);
        const enriched = enrich(arr);
        cache = enriched;
        toLocal(enriched);
        return enriched;
      } catch {
        const fallback = enrich((sample as Airport[]) ?? []);
        cache = fallback;
        return fallback;
      }
    })();
  }
  return loading;
}

export async function searchAirportsAsync(query: string): Promise<Airport[]> {
  const q = normalize(query.trim());
  if (!q) return [];
  const airports = await loadAirports();
  return airports
    .filter((a) => {
      const pool = [a.iata, a.name, a.city, a.country, ...(a.aliases ?? [])].map((x) => normalize(x));
      return pool.some((x) => x.includes(q));
    })
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, 12);
}

export function clearAirportsCache() {
  cache = null;
  loading = null;
  try {
    localStorage.removeItem(LS_KEY);
  } catch {}
}

function enrich(arr: Airport[]): Airport[] {
  const addAlias = (city: string, aliasList: string[]) => {
    const nc = normalize(city);
    arr.forEach((a) => {
      if (normalize(a.city) === nc) {
        a.aliases = Array.from(new Set([...(a.aliases ?? []), ...aliasList]));
      }
    });
  };
  addAlias("New York", ["NYC", "Nova Iorque", "Nueva York"]);
  addAlias("London", ["Londres"]);
  addAlias("Tokyo", ["Tóquio", "Tokio"]);
  addAlias("Tokyo", ["Narita", "Haneda"]);
  addAlias("São Paulo", ["Sao Paulo"]);
  addAlias("Rio de Janeiro", ["Rio"]);
  addAlias("Paris", ["París"]);

  return arr;
}

function rank(a: Airport): number {
  const city = normalize(a.city);
  const primaries: Record<string, string[]> = {
    [normalize("São Paulo")]: ["GRU", "CGH", "VCP"],
    [normalize("Rio de Janeiro")]: ["GIG", "SDU"],
    [normalize("New York")]: ["JFK", "LGA", "EWR"],
    [normalize("London")]: ["LHR", "LGW", "LCY"],
    [normalize("Paris")]: ["CDG", "ORY"],
    [normalize("Tokyo")]: ["HND", "NRT"],
  };
  const list = primaries[city];
  const idx = list ? list.indexOf(a.iata) : -1;
  const internationalBonus = /international/i.test(a.name) ? -1 : 0;
  return (idx >= 0 ? idx : 99) * 10 + internationalBonus;
}

export async function findAirportByIata(iata: string): Promise<Airport | null> {
  const list = await loadAirports();
  const x = list.find((a) => a.iata.toUpperCase() === iata.toUpperCase());
  return x ?? null;
}

export async function getCountryByIata(iata: string): Promise<string | null> {
  const a = await findAirportByIata(iata);
  return a ? (a.country ?? null) : null;
}
