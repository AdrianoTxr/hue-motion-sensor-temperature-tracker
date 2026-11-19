import { neon } from "@neondatabase/serverless";

type Sql = ReturnType<typeof neon>;

let client: Sql | null = null;
let schemaReady: Promise<void> | null = null;

function getClient(): Sql {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL n'est pas défini");
    client = neon(url);
  }
  return client;
}

/** Crée les tables si elles n'existent pas encore (idempotent). */
async function ensureSchema(): Promise<void> {
  const sql = getClient();
  await sql`
    CREATE TABLE IF NOT EXISTS hue_auth (
      id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      access_token text NOT NULL,
      refresh_token text NOT NULL,
      access_expires_at timestamptz NOT NULL,
      app_key text,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS sensors (
      id text PRIMARY KEY,
      name text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS readings (
      id bigserial PRIMARY KEY,
      sensor_id text NOT NULL REFERENCES sensors(id),
      recorded_at timestamptz NOT NULL DEFAULT now(),
      reported_at timestamptz,
      temperature real NOT NULL
    )`;
  await sql`
    CREATE INDEX IF NOT EXISTS readings_sensor_time_idx
      ON readings (sensor_id, recorded_at)`;
}

/** Client SQL prêt à l'emploi (schéma garanti). */
export async function db(): Promise<Sql> {
  if (!schemaReady) {
    schemaReady = ensureSchema().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  await schemaReady;
  return getClient();
}
