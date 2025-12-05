"use client";
let _Preferences: any = null;
let _CapacitorSQLite: any = null;

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

export type TripItem = {
  id: string;
  title: string;
  date: string;
  passengers: number;
  flightNotes?: FlightNote[];
  reachedFinalCalendar?: boolean;
  savedCalendarName?: string;
  savedAt?: number;
};

export type EventItem = {
  name: string;
  label?: string;
  date: string;
  time?: string;
  address?: string;
  type?: string;
};

type Conn = {
  open: (db: string, encrypted?: boolean, mode?: string, version?: number) => Promise<{
    execute: (sql: string) => Promise<void>;
    run: (sql: string, params?: unknown[]) => Promise<void>;
    query: (sql: string, params?: unknown[]) => Promise<{ values?: unknown[][] } | undefined>;
    close: () => Promise<void>;
  }>;
};

const _dbName = "calentrip_db";
let _conn: Conn | null = null;
let _ready = false;
let _useFallback = false;

async function getConnection(): Promise<Conn | null> {
  if (_conn) return _conn;
  try {
    if (!_CapacitorSQLite) {
      try { const mod = await import("@capacitor-community/sqlite"); _CapacitorSQLite = (mod as any).CapacitorSQLite || mod; } catch { _useFallback = true; return null; }
    }
    const anySql = _CapacitorSQLite as unknown as {
      createConnection: (opts: { database: string; version?: number; encrypted?: boolean; mode?: string }) => Promise<unknown>;
      open: (opts: { database: string; version?: number; encrypted?: boolean; mode?: string }) => Promise<{
        execute: (sql: string) => Promise<void>;
        run: (sql: string, params?: unknown[]) => Promise<void>;
        query: (sql: string, params?: unknown[]) => Promise<{ values?: unknown[][] } | undefined>;
        close: () => Promise<void>;
      }>;
    };
    const adapter: Conn = {
      open: async (db, encrypted = false, mode = "no-encryption", version = 1) => {
        const handle = await anySql.open({ database: db, version, encrypted, mode });
        return handle as unknown as {
          execute: (sql: string) => Promise<void>;
          run: (sql: string, params?: unknown[]) => Promise<void>;
          query: (sql: string, params?: unknown[]) => Promise<{ values?: unknown[][] } | undefined>;
          close: () => Promise<void>;
        };
      },
    };
    _conn = adapter;
    return _conn;
  } catch {
    _useFallback = true;
    return null;
  }
}

export async function initDatabase() {
  if (_ready) return;
  const conn = await getConnection();
  if (!conn) { _ready = true; return; }
  const db = await conn.open(_dbName, false, "no-encryption", 1);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS trips (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      passengers INTEGER,
      flightNotes TEXT,
      reachedFinalCalendar INTEGER DEFAULT 0,
      savedCalendarName TEXT,
      savedAt INTEGER
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS events (
      event_id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id TEXT NOT NULL,
      name TEXT NOT NULL,
      label TEXT,
      date TEXT NOT NULL,
      time TEXT,
      address TEXT,
      type TEXT,
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS attachments (
      att_id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id TEXT NOT NULL,
      leg TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      size INTEGER NOT NULL,
      file_id TEXT NOT NULL,
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
    );
  `);
  try { await db.execute(`ALTER TABLE attachments ADD COLUMN category TEXT`); } catch {}
  try { await db.execute(`ALTER TABLE attachments ADD COLUMN ref TEXT`); } catch {}
  await db.close();
  _ready = true;
}

export async function migrateFromLocalStorage() {
  try {
    if (!_Preferences) { try { const mod = await import("@capacitor/preferences"); _Preferences = (mod as any).Preferences || mod; } catch {} }
    const flag = _Preferences ? await _Preferences.get({ key: "migration_complete" }) : undefined;
    if ((flag?.value || "") === "true") return;
  } catch {}
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem("calentrip:trips") : null;
    const arr: TripItem[] = raw ? JSON.parse(raw) : [];
    if (!arr.length) {
      if (_Preferences) await _Preferences.set({ key: "migration_complete", value: "true" });
      return;
    }
    const conn = await getConnection();
    if (!conn) {
      if (_Preferences) await _Preferences.set({ key: "migration_complete", value: "true" });
      return;
    }
    const db = await conn.open(_dbName, false, "no-encryption", 1);
    for (const t of arr) {
      const flightNotes = JSON.stringify(t.flightNotes || []);
      const reached = t.reachedFinalCalendar ? 1 : 0;
      const savedAt = t.savedAt ?? Date.now();
      await db.run(
        "INSERT OR REPLACE INTO trips (id, title, date, passengers, flightNotes, reachedFinalCalendar, savedCalendarName, savedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [t.id, t.title, t.date, t.passengers, flightNotes, reached, t.savedCalendarName || null, savedAt]
      );
      const evs = (t as unknown as { savedEvents?: EventItem[] }).savedEvents || [];
      if (Array.isArray(evs) && evs.length) {
        await db.run("DELETE FROM events WHERE trip_id = ?", [t.id]);
        for (const e of evs) {
          await db.run(
            "INSERT INTO events (trip_id, name, label, date, time, address, type) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [t.id, e.name || e.label || "Evento", e.label || null, e.date, e.time || null, e.address || null, e.type || null]
          );
        }
      }
      const atts = (t as unknown as { attachments?: Array<{ leg: "outbound" | "inbound"; name: string; type: string; size: number; id?: string }> }).attachments || [];
      if (Array.isArray(atts) && atts.length) {
        await db.run("DELETE FROM attachments WHERE trip_id = ?", [t.id]);
        for (const a of atts) {
          await db.run(
            "INSERT INTO attachments (trip_id, leg, name, type, size, file_id) VALUES (?, ?, ?, ?, ?, ?)",
            [t.id, a.leg, a.name, a.type, a.size, a.id || ""]
          );
        }
      }
    }
    await db.close();
    if (_Preferences) await _Preferences.set({ key: "migration_complete", value: "true" });
  } catch {
    try { if (_Preferences) await _Preferences.set({ key: "migration_complete", value: "true" }); } catch {}
  }
}

export async function addTrip(trip: TripItem) {
  await initDatabase();
  const conn = await getConnection();
  if (!conn || _useFallback) {
    try {
      const list: TripItem[] = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("calentrip:trips") || "[]") : [];
      const next = [trip, ...list].slice(0, 20);
      if (typeof window !== "undefined") localStorage.setItem("calentrip:trips", JSON.stringify(next));
    } catch {}
    return;
  }
  try {
    const db = await conn.open(_dbName, false, "no-encryption", 1);
    await db.run(
      "INSERT OR REPLACE INTO trips (id, title, date, passengers, flightNotes, reachedFinalCalendar, savedCalendarName, savedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [trip.id, trip.title, trip.date, trip.passengers, JSON.stringify(trip.flightNotes || []), trip.reachedFinalCalendar ? 1 : 0, trip.savedCalendarName || null, Date.now()]
    );
    await db.close();
  } catch {
    _useFallback = true;
    try {
      const list: TripItem[] = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("calentrip:trips") || "[]") : [];
      const next = [trip, ...list].slice(0, 20);
      if (typeof window !== "undefined") localStorage.setItem("calentrip:trips", JSON.stringify(next));
    } catch {}
  }
}

export async function updateTrip(id: string, data: Partial<TripItem>) {
  await initDatabase();
  const conn = await getConnection();
  if (!conn || _useFallback) {
    try {
      const list: TripItem[] = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("calentrip:trips") || "[]") : [];
      const idx = list.findIndex((t) => t.id === id);
      if (idx >= 0) {
        const next = [...list];
        next[idx] = { ...next[idx], ...data };
        if (typeof window !== "undefined") localStorage.setItem("calentrip:trips", JSON.stringify(next));
      }
    } catch {}
    return;
  }
  const fields: string[] = [];
  const values: unknown[] = [];
  if (data.title !== undefined) { fields.push("title = ?"); values.push(data.title); }
  if (data.date !== undefined) { fields.push("date = ?"); values.push(data.date); }
  if (data.passengers !== undefined) { fields.push("passengers = ?"); values.push(data.passengers); }
  if (data.flightNotes !== undefined) { fields.push("flightNotes = ?"); values.push(JSON.stringify(data.flightNotes || [])); }
  if (data.reachedFinalCalendar !== undefined) { fields.push("reachedFinalCalendar = ?"); values.push(data.reachedFinalCalendar ? 1 : 0); }
  if (data.savedCalendarName !== undefined) { fields.push("savedCalendarName = ?"); values.push(data.savedCalendarName || null); }
  if (data.savedAt !== undefined) { fields.push("savedAt = ?"); values.push(data.savedAt); }
  if (!fields.length) return;
  const sql = `UPDATE trips SET ${fields.join(", ")} WHERE id = ?`;
  const conn2 = await getConnection();
  const db = await conn2!.open(_dbName, false, "no-encryption", 1);
  await db.run(sql, [...values, id]);
  await db.close();
}

export async function saveCalendarEvents(tripId: string, events: EventItem[]) {
  await initDatabase();
  const conn = await getConnection();
  if (!conn || _useFallback) {
    try {
      const list: TripItem[] = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("calentrip:trips") || "[]") : [];
      const idx = list.findIndex((t) => t.id === tripId);
      if (idx >= 0) {
        const next = [...list];
        (next[idx] as unknown as { savedEvents?: EventItem[] }).savedEvents = events;
        if (typeof window !== "undefined") localStorage.setItem("calentrip:trips", JSON.stringify(next));
      }
    } catch {}
    return;
  }
  const db = await conn.open(_dbName, false, "no-encryption", 1);
  await db.run("DELETE FROM events WHERE trip_id = ?", [tripId]);
  for (const e of events) {
    await db.run(
      "INSERT INTO events (trip_id, name, label, date, time, address, type) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [tripId, e.name || e.label || "Evento", e.label || null, e.date, e.time || null, e.address || null, e.type || null]
    );
  }
  await db.close();
}

export async function getSavedTrips(): Promise<TripItem[]> {
  await initDatabase();
  const conn = await getConnection();
  if (!conn || _useFallback) {
    try {
      const list: TripItem[] = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("calentrip:trips") || "[]") : [];
      return [...list].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    } catch { return []; }
  }
  const db = await conn.open(_dbName, false, "no-encryption", 1);
  const res = await db.query("SELECT id, title, date, passengers, flightNotes, reachedFinalCalendar, savedCalendarName, savedAt FROM trips ORDER BY date DESC");
  await db.close();
  const out: TripItem[] = [];
  const rows = (res?.values || []) as unknown[][];
  for (const r of rows) {
    const [id, title, date, passengers, flightNotesJson, reached, savedCalendarName, savedAt] = r as [string, string, string, number, string, number, string | null, number | null];
    const notes = (() => { try { return JSON.parse(String(flightNotesJson || "[]")); } catch { return []; } })();
    out.push({ id, title, date, passengers: Number(passengers || 0), flightNotes: notes, reachedFinalCalendar: Boolean(reached), savedCalendarName: savedCalendarName || undefined, savedAt: savedAt || undefined });
  }
  return out;
}

export async function getTripEvents(tripId: string): Promise<EventItem[]> {
  await initDatabase();
  const conn = await getConnection();
  if (!conn || _useFallback) {
    try {
      const list: TripItem[] = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("calentrip:trips") || "[]") : [];
      const it = list.find((t) => t.id === tripId);
      const evs = (it as unknown as { savedEvents?: EventItem[] })?.savedEvents || [];
      return evs;
    } catch { return []; }
  }
  const db = await conn.open(_dbName, false, "no-encryption", 1);
  const res = await db.query("SELECT name, label, date, time, address, type FROM events WHERE trip_id = ? ORDER BY date ASC, time ASC", [tripId]);
  await db.close();
  const out: EventItem[] = [];
  const rows = (res?.values || []) as unknown[][];
  for (const r of rows) {
    const [name, label, date, time, address, type] = r as [string, string | null, string, string | null, string | null, string | null];
    out.push({ name, label: label || undefined, date, time: time || undefined, address: address || undefined, type: type || undefined });
  }
  return out;
}

export async function removeTrip(id: string) {
  await initDatabase();
  const conn = await getConnection();
  if (!conn || _useFallback) {
    try {
      const list: TripItem[] = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("calentrip:trips") || "[]") : [];
      const next = list.filter((t) => t.id !== id);
      if (typeof window !== "undefined") localStorage.setItem("calentrip:trips", JSON.stringify(next));
    } catch {}
    return;
  }
  const db = await conn.open(_dbName, false, "no-encryption", 1);
  await db.run("DELETE FROM events WHERE trip_id = ?", [id]);
  await db.run("DELETE FROM attachments WHERE trip_id = ?", [id]);
  await db.run("DELETE FROM trips WHERE id = ?", [id]);
  await db.close();
}

export async function saveTripAttachments(tripId: string, atts: Array<{ leg: "outbound" | "inbound"; name: string; type: string; size: number; id: string }>) {
  await initDatabase();
  const conn = await getConnection();
  if (!conn || _useFallback) {
    try {
      const list: TripItem[] = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("calentrip:trips") || "[]") : [];
      const idx = list.findIndex((t) => t.id === tripId);
      if (idx >= 0) {
        const next = [...list];
        (next[idx] as unknown as { attachments?: Array<{ leg: "outbound" | "inbound"; name: string; type: string; size: number; id?: string }> }).attachments = atts;
        if (typeof window !== "undefined") localStorage.setItem("calentrip:trips", JSON.stringify(next));
      }
    } catch {}
    return;
  }
  const db = await conn.open(_dbName, false, "no-encryption", 1);
  await db.run("DELETE FROM attachments WHERE trip_id = ?", [tripId]);
  for (const a of atts) {
    await db.run(
      "INSERT INTO attachments (trip_id, leg, name, type, size, file_id) VALUES (?, ?, ?, ?, ?, ?)",
      [tripId, a.leg, a.name, a.type, a.size, a.id]
    );
  }
  await db.close();
}

export async function saveRefAttachments(tripId: string, category: string, ref: string, atts: Array<{ name: string; type: string; size: number; id: string }>) {
  await initDatabase();
  const conn = await getConnection();
  if (!conn || _useFallback) {
    try {
      const list: TripItem[] = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("calentrip:trips") || "[]") : [];
      const idx = list.findIndex((t) => t.id === tripId);
      if (idx >= 0) {
        const next = [...list];
        const cur = (next[idx] as unknown as { attachments?: Array<{ leg?: string; category?: string; ref?: string; name: string; type: string; size: number; id?: string }> }).attachments || [];
        const merged = cur.concat(atts.map((a) => ({ category, ref, name: a.name, type: a.type, size: a.size, id: a.id })));
        (next[idx] as unknown as { attachments?: Array<{ leg?: string; category?: string; ref?: string; name: string; type: string; size: number; id?: string }> }).attachments = merged;
        if (typeof window !== "undefined") localStorage.setItem("calentrip:trips", JSON.stringify(next));
      }
    } catch {}
    return;
  }
  const db = await conn.open(_dbName, false, "no-encryption", 1);
  // Do not delete existing attachments for this trip/ref; append
  for (const a of atts) {
    await db.run(
      "INSERT INTO attachments (trip_id, leg, name, type, size, file_id, category, ref) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [tripId, category, a.name, a.type, a.size, a.id, category, ref]
    );
  }
  await db.close();
}

export async function getRefAttachments(tripId: string, category?: string, ref?: string): Promise<Array<{ name: string; type: string; size: number; id: string }>> {
  await initDatabase();
  const conn = await getConnection();
  if (!conn || _useFallback) {
    try {
      const list: TripItem[] = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("calentrip:trips") || "[]") : [];
      const it = list.find((t) => t.id === tripId);
      const raw = (it as unknown as { attachments?: Array<{ leg?: string; category?: string; ref?: string; name: string; type: string; size: number; id?: string }> })?.attachments || [];
      const filtered = raw.filter((a) => (category ? (a.category === category || a.leg === category) : true) && (ref ? a.ref === ref : true));
      return filtered.map((a) => ({ name: a.name, type: a.type, size: a.size, id: a.id || "" }));
    } catch { return []; }
  }
  const db = await conn.open(_dbName, false, "no-encryption", 1);
  let sql = "SELECT name, type, size, file_id FROM attachments WHERE trip_id = ?";
  const params: unknown[] = [tripId];
  if (category) { sql += " AND category = ?"; params.push(category); }
  if (ref) { sql += " AND ref = ?"; params.push(ref); }
  const res = await db.query(sql, params);
  await db.close();
  const rows = (res?.values || []) as unknown[][];
  return rows.map((r) => {
    const [name, type, size, file_id] = r as [string, string, number, string];
    return { name, type, size: Number(size || 0), id: file_id };
  });
}
export async function getTripAttachments(tripId: string, leg?: "outbound" | "inbound"): Promise<Array<{ name: string; type: string; size: number; id: string }>> {
  await initDatabase();
  const conn = await getConnection();
  if (!conn || _useFallback) {
    try {
      const list: TripItem[] = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("calentrip:trips") || "[]") : [];
      const it = list.find((t) => t.id === tripId);
      const raw = (it as unknown as { attachments?: Array<{ leg: "outbound" | "inbound"; name: string; type: string; size: number; id?: string }> })?.attachments || [];
      const out = raw.map((a) => ({ name: a.name, type: a.type, size: a.size, id: a.id || "" }));
      return leg ? out.filter((a, idx) => ((raw[idx]?.leg) === leg)) : out;
    } catch { return []; }
  }
  const db = await conn.open(_dbName, false, "no-encryption", 1);
  const sql = leg ? "SELECT name, type, size, file_id FROM attachments WHERE trip_id = ? AND leg = ?" : "SELECT name, type, size, file_id FROM attachments WHERE trip_id = ?";
  const res = await db.query(sql, leg ? [tripId, leg] : [tripId]);
  await db.close();
  const rows = (res?.values || []) as unknown[][];
  return rows.map((r) => {
    const [name, type, size, file_id] = r as [string, string, number, string];
    return { name, type, size: Number(size || 0), id: file_id };
  });
}
