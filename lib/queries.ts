import { db } from "./db";

export const TIMEZONE = process.env.APP_TIMEZONE || "Europe/Paris";

export type Sensor = { id: string; name: string };
export type Point = { hour: number; temperature: number };
export type HourStat = { hour: number; min: number; avg: number; max: number; count: number };

/** Date du jour (AAAA-MM-JJ) dans le fuseau configuré. */
export function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date());
}

export async function listSensors(): Promise<Sensor[]> {
  const sql = await db();
  return (await sql`SELECT id, name FROM sensors ORDER BY name`) as Sensor[];
}

/** Mesures d'une journée locale ; `hour` = heure décimale (0–24) pour l'axe X. */
export async function dayPoints(sensorId: string, date: string): Promise<Point[]> {
  const sql = await db();
  const rows = (await sql`
    SELECT
      EXTRACT(EPOCH FROM (recorded_at AT TIME ZONE ${TIMEZONE}) - ${date}::date::timestamp) / 3600 AS hour,
      temperature
    FROM readings
    WHERE sensor_id = ${sensorId}
      AND recorded_at >= (${date}::date::timestamp AT TIME ZONE ${TIMEZONE})
      AND recorded_at <  ((${date}::date + 1)::timestamp AT TIME ZONE ${TIMEZONE})
    ORDER BY recorded_at`) as { hour: string | number; temperature: number }[];
  return rows.map((r) => ({ hour: Number(r.hour), temperature: Number(r.temperature) }));
}

/** Statistiques min / moyenne / max par heure locale. */
export async function hourlyStats(sensorId: string, date: string): Promise<HourStat[]> {
  const sql = await db();
  const rows = (await sql`
    SELECT
      EXTRACT(HOUR FROM recorded_at AT TIME ZONE ${TIMEZONE})::int AS hour,
      MIN(temperature) AS min,
      AVG(temperature) AS avg,
      MAX(temperature) AS max,
      COUNT(*)::int AS count
    FROM readings
    WHERE sensor_id = ${sensorId}
      AND recorded_at >= (${date}::date::timestamp AT TIME ZONE ${TIMEZONE})
      AND recorded_at <  ((${date}::date + 1)::timestamp AT TIME ZONE ${TIMEZONE})
    GROUP BY 1
    ORDER BY 1`) as Record<string, string | number>[];
  return rows.map((r) => ({
    hour: Number(r.hour),
    min: Number(r.min),
    avg: Number(r.avg),
    max: Number(r.max),
    count: Number(r.count),
  }));
}

export async function lastReading(): Promise<{ recorded_at: string; temperature: number; name: string } | null> {
  const sql = await db();
  const rows = (await sql`
    SELECT r.recorded_at, r.temperature, s.name
    FROM readings r JOIN sensors s ON s.id = r.sensor_id
    ORDER BY r.recorded_at DESC LIMIT 1`) as { recorded_at: string; temperature: number; name: string }[];
  return rows[0] ?? null;
}
