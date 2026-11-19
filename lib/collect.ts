import { db } from "./db";
import { clipGet } from "./hue";

type TemperatureResource = {
  id: string;
  owner: { rid: string; rtype: string };
  enabled: boolean;
  temperature: {
    temperature?: number;
    temperature_valid?: boolean;
    temperature_report?: { changed: string; temperature: number };
  };
};

type DeviceResource = {
  id: string;
  metadata: { name: string };
};

export type CollectResult = {
  saved: { sensor: string; temperature: number }[];
  skipped: string[];
};

/** Lit la température de tous les capteurs Hue et l'enregistre. */
export async function collect(): Promise<CollectResult> {
  const [temps, devices] = await Promise.all([
    clipGet<TemperatureResource>("temperature"),
    clipGet<DeviceResource>("device"),
  ]);
  const names = new Map(devices.map((d) => [d.id, d.metadata.name]));
  const sql = await db();
  const result: CollectResult = { saved: [], skipped: [] };

  for (const t of temps) {
    const name = names.get(t.owner.rid) ?? t.id;
    const report = t.temperature.temperature_report;
    const value = report?.temperature ?? t.temperature.temperature;
    if (!t.enabled || t.temperature.temperature_valid === false || value == null) {
      result.skipped.push(name);
      continue;
    }
    await sql`
      INSERT INTO sensors (id, name, updated_at) VALUES (${t.id}, ${name}, now())
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = now()`;
    await sql`
      INSERT INTO readings (sensor_id, reported_at, temperature)
      VALUES (${t.id}, ${report?.changed ?? null}, ${value})`;
    result.saved.push({ sensor: name, temperature: value });
  }
  return result;
}
