import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

/**
 * SQLite vía libsql.
 *
 * El driver es libsql y no better-sqlite3 porque este último no tiene binario
 * nativo compatible con Node 23 y provoca un segfault al abrir la conexión.
 * libsql habla el mismo SQLite y trae sus propios prebuilds. La contrapartida
 * es que la API es asíncrona, de ahí los `await` en toda la capa de datos.
 *
 * El esquema se crea con SQL directo al abrir la conexión: evita depender de un
 * paso de migración para arrancar y permite que los tests levanten una base en
 * memoria idéntica a la real en una línea.
 */
const DDL = [
  `CREATE TABLE IF NOT EXISTS clock (
    id INTEGER PRIMARY KEY,
    now INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS rules (
    id INTEGER PRIMARY KEY,
    first_reminder_hours INTEGER NOT NULL DEFAULT 24,
    second_reminder_hours INTEGER NOT NULL DEFAULT 2,
    alert_after_hours INTEGER NOT NULL DEFAULT 6,
    clinic_open_hour INTEGER NOT NULL DEFAULT 8,
    clinic_close_hour INTEGER NOT NULL DEFAULT 20
  )`,
  `CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    email TEXT,
    previous_no_shows INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS dentists (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    specialty TEXT NOT NULL,
    color TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  )`,
  `CREATE TABLE IF NOT EXISTS treatments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    duration_min INTEGER NOT NULL,
    price_cents INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(id),
    dentist_id TEXT NOT NULL REFERENCES dentists(id),
    treatment_id TEXT NOT NULL REFERENCES treatments(id),
    starts_at INTEGER NOT NULL,
    ends_at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled',
    reminded_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    appointment_id TEXT NOT NULL REFERENCES appointments(id),
    patient_id TEXT NOT NULL REFERENCES patients(id),
    direction TEXT NOT NULL,
    body TEXT NOT NULL,
    sent_at INTEGER NOT NULL,
    kind TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    appointment_id TEXT NOT NULL REFERENCES appointments(id),
    kind TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    resolved_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS user_events (
    id TEXT PRIMARY KEY,
    at INTEGER NOT NULL,
    appointment_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    seq REAL NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_appt_starts ON appointments(starts_at)`,
  `CREATE INDEX IF NOT EXISTS idx_msg_appt ON messages(appointment_id)`,
  `CREATE INDEX IF NOT EXISTS idx_ev_at ON user_events(at, seq)`,
];

export type Db = ReturnType<typeof drizzle<typeof schema>>;

export async function createDb(url: string): Promise<Db> {
  const client: Client = createClient({ url });
  for (const stmt of DDL) await client.execute(stmt);
  return drizzle(client, { schema });
}

/** Base en memoria con el esquema aplicado. Para tests. */
export function memoryDb(): Promise<Db> {
  return createDb(":memory:");
}

const DB_URL = process.env.ODONTOFLOW_DB ?? "file:odontoflow.db";

// Next recarga los módulos en caliente durante el desarrollo; sin este cache se
// abrirían decenas de conexiones contra el mismo archivo.
const globalForDb = globalThis as unknown as { __odontoflowDb?: Promise<Db> };
export const dbPromise: Promise<Db> = globalForDb.__odontoflowDb ?? createDb(DB_URL);
if (process.env.NODE_ENV !== "production") globalForDb.__odontoflowDb = dbPromise;

export const getDb = () => dbPromise;
export { schema };
