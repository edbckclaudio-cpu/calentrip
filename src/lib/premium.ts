type PremiumRecord = { tripId: string; expiresAt: number };
const KEY = "calentrip:premium";

export function getPremiumTripIds(): string[] {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
    const list: PremiumRecord[] = raw ? JSON.parse(raw) : [];
    const now = Date.now();
    const active = list.filter((r) => r.expiresAt > now).map((r) => r.tripId);
    try { console.log("DIAGNÓSTICO: premium storage", { raw, active }); } catch {}
    return active;
  } catch {
    return [];
  }
}

export function isTripPremium(tripId: string): boolean {
  const list = getPremiumTripIds();
  return list.includes("global") || list.includes(tripId);
}

export function setTripPremium(tripId: string, expiresAt: number) {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
    const list: PremiumRecord[] = raw ? JSON.parse(raw) : [];
    const next = list.filter((r) => r.tripId !== tripId);
    next.push({ tripId, expiresAt });
    localStorage.setItem(KEY, JSON.stringify(next));
    try { console.log("DIAGNÓSTICO: setTripPremium", { tripId, expiresAt, next }); } catch {}
  } catch {}
}

export function setGlobalPremium(expiresAt: number) {
  setTripPremium("global", expiresAt);
  try { console.log("DIAGNÓSTICO: setGlobalPremium", { expiresAt }); } catch {}
}

export function isGlobalPremium(): boolean {
  return isTripPremium("global");
}

export function computeExpiryFromData(opts: {
  tripDate?: string;
  returnDate?: string;
  lastCheckout?: string;
}): number {
  const dates = [opts.returnDate, opts.lastCheckout, opts.tripDate].filter(Boolean) as string[];
  const ts = dates.map((d) => Date.parse(d)).filter((n) => Number.isFinite(n));
  const end = ts.length ? Math.max(...ts) : Date.now() + 30 * 24 * 60 * 60 * 1000;
  return end + 24 * 60 * 60 * 1000;
}

