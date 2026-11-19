import { db } from "./db";

/**
 * Accès à l'API distante (cloud) de Philips Hue.
 * - OAuth2 : https://api.meethue.com/v2/oauth2/...
 * - Bridge via le cloud : https://api.meethue.com/route/... (même API que le pont local,
 *   préfixée par /route).
 */
const HUE_BASE = "https://api.meethue.com";
const DEVICE_TYPE = "hue-temp-tracker#vercel";

/** Marge avant expiration à partir de laquelle on rafraîchit le jeton. */
const REFRESH_MARGIN_MS = 60 * 60 * 1000;

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} n'est pas défini`);
  return v;
}

export function authorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env("HUE_CLIENT_ID"),
    response_type: "code",
    state,
  });
  return `${HUE_BASE}/v2/oauth2/authorize?${params}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number | string;
};

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const basic = Buffer.from(
    `${env("HUE_CLIENT_ID")}:${env("HUE_CLIENT_SECRET")}`,
  ).toString("base64");
  const res = await fetch(`${HUE_BASE}/v2/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Hue OAuth: HTTP ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as TokenResponse;
}

async function saveTokens(t: TokenResponse): Promise<void> {
  const sql = await db();
  const expiresAt = new Date(Date.now() + Number(t.expires_in) * 1000);
  await sql`
    INSERT INTO hue_auth (id, access_token, refresh_token, access_expires_at, updated_at)
    VALUES (1, ${t.access_token}, ${t.refresh_token}, ${expiresAt.toISOString()}, now())
    ON CONFLICT (id) DO UPDATE SET
      access_token = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token,
      access_expires_at = EXCLUDED.access_expires_at,
      updated_at = now()`;
}

type AuthRow = {
  access_token: string;
  refresh_token: string;
  access_expires_at: string | Date;
  app_key: string | null;
};

export async function getAuth(): Promise<AuthRow | null> {
  const sql = await db();
  const rows = (await sql`SELECT * FROM hue_auth WHERE id = 1`) as AuthRow[];
  return rows[0] ?? null;
}

/** Échange le code OAuth reçu sur le callback, puis crée la clé d'application. */
export async function completeAuthorization(code: string): Promise<void> {
  const tokens = await tokenRequest({ grant_type: "authorization_code", code });
  await saveTokens(tokens);
  await createAppKey(tokens.access_token);
}

async function refresh(refreshToken: string): Promise<string> {
  const tokens = await tokenRequest({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  await saveTokens(tokens);
  return tokens.access_token;
}

/** Appuie virtuellement sur le bouton du pont puis enregistre une clé d'application. */
async function createAppKey(accessToken: string): Promise<void> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
  const press = await fetch(`${HUE_BASE}/route/api/0/config`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ linkbutton: true }),
    cache: "no-store",
  });
  if (!press.ok) throw new Error(`Hue linkbutton: HTTP ${press.status}`);

  const res = await fetch(`${HUE_BASE}/route/api`, {
    method: "POST",
    headers,
    body: JSON.stringify({ devicetype: DEVICE_TYPE }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Hue app key: HTTP ${res.status}`);
  const body = (await res.json()) as Array<{
    success?: { username: string };
    error?: { description: string };
  }>;
  const key = body[0]?.success?.username;
  if (!key) {
    throw new Error(`Hue app key: ${body[0]?.error?.description ?? "réponse inattendue"}`);
  }
  const sql = await db();
  await sql`UPDATE hue_auth SET app_key = ${key}, updated_at = now() WHERE id = 1`;
}

/** GET authentifié sur l'API CLIP v2 du pont via le cloud, avec rafraîchissement auto du jeton. */
export async function clipGet<T>(resource: string): Promise<T[]> {
  const auth = await getAuth();
  if (!auth || !auth.app_key) {
    throw new Error("Hue non connecté : ouvre /setup pour autoriser l'application");
  }
  let token = auth.access_token;
  const expiresAt = new Date(auth.access_expires_at).getTime();
  if (expiresAt - Date.now() < REFRESH_MARGIN_MS) {
    token = await refresh(auth.refresh_token);
  }

  const call = (t: string) =>
    fetch(`${HUE_BASE}/route/clip/v2/resource/${resource}`, {
      headers: {
        Authorization: `Bearer ${t}`,
        "hue-application-key": auth.app_key!,
      },
      cache: "no-store",
    });

  let res = await call(token);
  if (res.status === 401) {
    token = await refresh(auth.refresh_token);
    res = await call(token);
  }
  if (!res.ok) {
    throw new Error(`Hue ${resource}: HTTP ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { data: T[]; errors?: { description: string }[] };
  if (json.errors?.length) {
    throw new Error(`Hue ${resource}: ${json.errors.map((e) => e.description).join(", ")}`);
  }
  return json.data;
}
