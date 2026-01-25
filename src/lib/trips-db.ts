"use client";
import { Capacitor } from "@capacitor/core";

type PreferencesAdapter = { get: (opts: { key: string }) => Promise<{ value?: string }>; set: (opts: { key: string; value: string }) => Promise<void> };
type CapacitorSQLiteAdapter = {
  createConnection?: (opts: { database: string; version?: number; encrypted?: boolean; mode?: string }) => Promise<any>;
  retrieveConnection?: (opts: { database: string }) => Promise<any>;
  isDBOpen?: (opts: { database: string }) => Promise<{ result: boolean }>;
  open: (opts: { database: string; version?: number; encrypted?: boolean; mode?: string }) => Promise<any>;
};

let _Preferences: PreferencesAdapter | null = null;
let _CapacitorSQLite: CapacitorSQLiteAdapter | null = null;

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

const _dbName = "calentrip_db";
let _ready = false;
let _useFallback = false;
const _timeoutMs = 5000;
let _dbHandle: any = null; // Singleton da conexão
let _dbQueue: Promise<unknown> = Promise.resolve();

function _withTimeout<T>(p: Promise<T>, ms = _timeoutMs): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

// Inicializa os plugins Capacitor
async function _loadPlugins() {
  if (!_CapacitorSQLite && Capacitor.isNativePlatform()) {
    try {
      const mod = await import("@capacitor-community/sqlite");
      _CapacitorSQLite = (mod as any).CapacitorSQLite ?? mod;
      console.log("DIAGN: Plugin SQLite carregado");
    } catch (e) {
      console.warn("DIAGN: Falha ao carregar SQLite, usando fallback", e);
      _useFallback = true;
    }
  }
  if (!_Preferences) {
    try {
      const mod = await import("@capacitor/preferences");
      _Preferences = (mod as any).Preferences ?? mod;
    } catch {}
  }
}

// Garante que a conexão exista e esteja aberta (Singleton)
async function getDbHandle() {
  await _loadPlugins();
  if (_useFallback || !Capacitor.isNativePlatform()) return null;

  try {
    if (_dbHandle) {
      const isOpen = await _CapacitorSQLite!.isDBOpen!({ database: _dbName });
      if (isOpen.result) return _dbHandle;
    }

    console.log("DIAGN: Iniciando abertura de conexão...");
    
    if (!_CapacitorSQLite?.retrieveConnection || !_CapacitorSQLite?.createConnection) {
      console.warn("DIAGN: Métodos de conexão SQLite ausentes, ativando fallback");
      _useFallback = true;
      return null;
    }

    // Tenta recuperar conexão existente ou criar nova
    try {
      _dbHandle = await _CapacitorSQLite!.retrieveConnection!({ database: _dbName });
    } catch {
      await _CapacitorSQLite!.createConnection!({
        database: _dbName,
        version: 1,
        encrypted: false,
        mode: "no-encryption"
      });
      _dbHandle = await _CapacitorSQLite!.retrieveConnection!({ database: _dbName });
    }

    const checkOpen = await _CapacitorSQLite!.isDBOpen!({ database: _dbName });
    if (!checkOpen.result) {
      await _withTimeout(_CapacitorSQLite!.open({ database: _dbName, version: 1, encrypted: false, mode: "no-encryption" }));
      console.log("DIAGN: Banco de dados aberto com sucesso");
      _dbHandle = await _CapacitorSQLite!.retrieveConnection!({ database: _dbName });
    }
    
    return _dbHandle;
  } catch (e) {
    console.error("DIAGN: Erro ao obter handle do banco", e);
    _useFallback = true;
    return null;
  }
}

// Fila de execução para evitar Race Conditions
async function runDb<T>(fn: (db: any) => Promise<T>): Promise<T> {
  const task = _dbQueue.then(async () => {
    const db = await getDbHandle();
    if (!db) throw new Error("Fallback mode");
    return await fn(db);
  });
  
  _dbQueue = task.then(() => undefined, () => undefined);
  return await task as T;
}

export async function initDatabase() {
  if (_ready) return;
  await _loadPlugins();

  if (!Capacitor.isNativePlatform()) {
    _useFallback = true;
    _ready = true;
    return;
  }

  try {
    await runDb(async (db) => {
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
          category TEXT,
          ref TEXT,
          FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
        );
      `);
      console.log("DIAGN: Tabelas verificadas/criadas");
    });
    _ready = true;
  } catch (e) {
    _useFallback = true;
    _ready = true;
  }
}

// --- MÉTODOS DE DADOS ---

export async function migrateFromLocalStorage() {
  try {
    await _loadPlugins();
    const flag = _Preferences ? await _Preferences.get({ key: "migration_complete" }) : null;
    if (flag?.value === "true") return;

    const raw = typeof window !== "undefined" ? localStorage.getItem("calentrip:trips") : null;
    const arr: TripItem[] = raw ? JSON.parse(raw) : [];
    
    if (arr.length > 0 && Capacitor.isNativePlatform()) {
      await runDb(async (db) => {
        for (const t of arr) {
          await db.run(
            "INSERT OR REPLACE INTO trips (id, title, date, passengers, flightNotes, reachedFinalCalendar, savedCalendarName, savedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [t.id, t.title, t.date, t.passengers, JSON.stringify(t.flightNotes || []), t.reachedFinalCalendar ? 1 : 0, t.savedCalendarName || null, t.savedAt || Date.now()]
          );
        }
      });
      console.log("DIAGN: Migração concluída");
    }
    
    if (_Preferences) await _Preferences.set({ key: "migration_complete", value: "true" });
  } catch (e) {
    console.error("DIAGN: Erro na migração", e);
  }
}

export async function addTrip(trip: TripItem) {
  await initDatabase();
  if (_useFallback) {
    const list = JSON.parse(localStorage.getItem("calentrip:trips") || "[]");
    localStorage.setItem("calentrip:trips", JSON.stringify([trip, ...list].slice(0, 50)));
    return;
  }
  await runDb(async (db) => {
    await db.run(
      "INSERT OR REPLACE INTO trips (id, title, date, passengers, flightNotes, reachedFinalCalendar, savedCalendarName, savedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [trip.id, trip.title, trip.date, trip.passengers, JSON.stringify(trip.flightNotes || []), trip.reachedFinalCalendar ? 1 : 0, trip.savedCalendarName || null, Date.now()]
    );
  });
}

export async function updateTrip(id: string, data: Partial<TripItem>) {
  await initDatabase();
  if (_useFallback) {
    const list: TripItem[] = JSON.parse(localStorage.getItem("calentrip:trips") || "[]");
    const idx = list.findIndex(t => t.id === id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...data };
      localStorage.setItem("calentrip:trips", JSON.stringify(list));
    }
    return;
  }
  const fields: string[] = [];
  const values: any[] = [];
  Object.entries(data).forEach(([key, val]) => {
    if (val === undefined) return;
    if (key === "flightNotes") { fields.push(`${key} = ?`); values.push(JSON.stringify(val)); }
    else if (key === "reachedFinalCalendar") { fields.push(`${key} = ?`); values.push(val ? 1 : 0); }
    else { fields.push(`${key} = ?`); values.push(val); }
  });
  if (!fields.length) return;
  await runDb(async (db) => {
    await db.run(`UPDATE trips SET ${fields.join(", ")} WHERE id = ?`, [...values, id]);
  });
}

export async function saveCalendarEvents(tripId: string, events: EventItem[]) {
  await initDatabase();
  if (_useFallback) {
    const list = JSON.parse(localStorage.getItem("calentrip:trips") || "[]");
    const idx = list.findIndex((t: any) => t.id === tripId);
    if (idx >= 0) {
      list[idx].savedEvents = events;
      localStorage.setItem("calentrip:trips", JSON.stringify(list));
    }
    return;
  }
  await runDb(async (db) => {
    await db.run("DELETE FROM events WHERE trip_id = ?", [tripId]);
    for (const e of events) {
      await db.run(
        "INSERT INTO events (trip_id, name, label, date, time, address, type) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [tripId, e.name || "Evento", e.label || null, e.date, e.time || null, e.address || null, e.type || null]
      );
    }
  });
}

export async function getSavedTrips(): Promise<TripItem[]> {
  await initDatabase();
  if (_useFallback) {
    return JSON.parse(localStorage.getItem("calentrip:trips") || "[]");
  }
  return await runDb(async (db) => {
    const res = await db.query("SELECT * FROM trips ORDER BY date DESC");
    return (res?.values || []).map((r: any) => ({
      ...r,
      flightNotes: JSON.parse(r.flightNotes || "[]"),
      reachedFinalCalendar: !!r.reachedFinalCalendar
    }));
  });
}

export async function getTripEvents(tripId: string): Promise<EventItem[]> {
  await initDatabase();
  if (_useFallback) {
    const list = JSON.parse(localStorage.getItem("calentrip:trips") || "[]");
    return list.find((t: any) => t.id === tripId)?.savedEvents || [];
  }
  return await runDb(async (db) => {
    const res = await db.query("SELECT * FROM events WHERE trip_id = ? ORDER BY date ASC, time ASC", [tripId]);
    return res?.values || [];
  });
}

export async function removeTrip(id: string) {
  await initDatabase();
  if (_useFallback) {
    const list = JSON.parse(localStorage.getItem("calentrip:trips") || "[]");
    localStorage.setItem("calentrip:trips", JSON.stringify(list.filter((t: any) => t.id !== id)));
    return;
  }
  await runDb(async (db) => {
    await db.run("DELETE FROM trips WHERE id = ?", [id]);
  });
}

export async function saveTripAttachments(tripId: string, atts: any[]) {
  await initDatabase();
  if (_useFallback) return;
  await runDb(async (db) => {
    await db.run("DELETE FROM attachments WHERE trip_id = ? AND category IS NULL", [tripId]);
    for (const a of atts) {
      await db.run(
        "INSERT INTO attachments (trip_id, leg, name, type, size, file_id) VALUES (?, ?, ?, ?, ?, ?)",
        [tripId, a.leg, a.name, a.type, a.size, a.id]
      );
    }
  });
}

export async function getTripAttachments(tripId: string, leg?: string) {
  await initDatabase();
  if (_useFallback) return [];
  return await runDb(async (db) => {
    let sql = "SELECT name, type, size, file_id as id, leg FROM attachments WHERE trip_id = ?";
    const params = [tripId];
    if (leg) { sql += " AND leg = ?"; params.push(leg); }
    const res = await db.query(sql, params);
    return res?.values || [];
  });
}

export async function saveRefAttachments(tripId: string, category: string, ref: string, atts: any[]) {
  await initDatabase();
  if (_useFallback) return;
  await runDb(async (db) => {
    for (const a of atts) {
      await db.run(
        "INSERT INTO attachments (trip_id, leg, name, type, size, file_id, category, ref) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [tripId, category, a.name, a.type, a.size, a.id, category, ref]
      );
    }
  });
}

export async function getRefAttachments(tripId: string, category?: string, ref?: string) {
  await initDatabase();
  if (_useFallback) return [];
  return await runDb(async (db) => {
    let sql = "SELECT name, type, size, file_id as id FROM attachments WHERE trip_id = ?";
    const params: any[] = [tripId];
    if (category) { sql += " AND category = ?"; params.push(category); }
    if (ref) { sql += " AND ref = ?"; params.push(ref); }
    const res = await db.query(sql, params);
    return res?.values || [];
  });
}
