export type EventKind = "flight" | "activity" | "restaurant" | "transport" | "stay";

export function escText(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
}

export function limit(s: string, n = 320) {
  if (!s) return s;
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export function foldLine(s: string) {
  const max = 74;
  if (s.length <= max) return s;
  const parts: string[] = [];
  for (let i = 0; i < s.length; i += max) parts.push(s.slice(i, i + max));
  return parts.join("\r\n ");
}

export function toAscii(s: string) {
  try {
    const base = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return base.replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();
  } catch {
    return s.replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();
  }
}

export function fmtLocal(d: Date) {
  const y = String(d.getFullYear());
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const s = "00";
  return `${y}${m}${da}T${h}${mi}${s}`;
}

export function fmtUTC(d: Date) {
  const y = String(d.getUTCFullYear());
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const s = "00";
  return `${y}${m}${da}T${h}${mi}${s}Z`;
}

export function alarmForEvent(kind: EventKind, hasTime: boolean, start: Date | null): string[] {
  const isFlight = kind === "flight";
  const isActivity = kind === "activity";
  const isRestaurant = kind === "restaurant";
  const isTransport = kind === "transport";
  if (!start) return [];
  if (!isFlight && !hasTime) return [];
  const alarms: string[] = [];
  if (isFlight) {
    alarms.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Lembrete de voo", "TRIGGER:-P1D", "END:VALARM");
    alarms.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Lembrete de voo", "TRIGGER:-PT60M", "END:VALARM");
    return alarms;
  }
  const label = isTransport ? "Lembrete de transporte" : "Lembrete de atividade";
  const trigger = (isActivity || isRestaurant) ? "-PT60M" : "-PT120M";
  alarms.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${label}`, `TRIGGER:${trigger}`, "END:VALARM");
  return alarms;
}

