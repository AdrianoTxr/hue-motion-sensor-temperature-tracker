import { getAuth } from "@/lib/hue";
import { lastReading, TIMEZONE } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Setup({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  const missing = ["DATABASE_URL", "HUE_CLIENT_ID", "HUE_CLIENT_SECRET", "CRON_SECRET", "APP_PASSWORD"].filter(
    (k) => !process.env[k],
  );

  let auth: Awaited<ReturnType<typeof getAuth>> = null;
  let last: Awaited<ReturnType<typeof lastReading>> = null;
  let dbError: string | null = null;
  if (!missing.includes("DATABASE_URL")) {
    try {
      [auth, last] = await Promise.all([getAuth(), lastReading()]);
    } catch (err) {
      dbError = err instanceof Error ? err.message : String(err);
    }
  }
  const connected = Boolean(auth?.app_key);
  const fmtDate = (d: string | Date) =>
    new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: TIMEZONE }).format(new Date(d));

  return (
    <>
      <h1>Configuration</h1>
      {params.ok && <div className="alert ok">Compte Hue connecté avec succès.</div>}
      {params.error && <div className="alert error">Erreur : {params.error}</div>}

      <div className="card">
        <h2>1. Variables d&apos;environnement</h2>
        {missing.length === 0 ? (
          <p>✅ Toutes les variables sont définies.</p>
        ) : (
          <p>❌ Manquantes dans Vercel : <code>{missing.join(", ")}</code></p>
        )}
        {dbError && <p className="alert error">Base de données : {dbError}</p>}
      </div>

      <div className="card">
        <h2>2. Compte Philips Hue</h2>
        {connected ? (
          <p>
            ✅ Connecté. Jeton valable jusqu&apos;au {fmtDate(auth!.access_expires_at)} (renouvelé
            automatiquement).
          </p>
        ) : (
          <p>❌ Pas encore connecté.</p>
        )}
        <a className="button" href="/api/hue/login">
          {connected ? "Reconnecter mon compte Hue" : "Connecter mon compte Hue"}
        </a>
      </div>

      <div className="card">
        <h2>3. Collecte automatique</h2>
        {last ? (
          <p>
            Dernière mesure : <strong>{Number(last.temperature).toFixed(1)} °C</strong> ({last.name}) le{" "}
            {fmtDate(last.recorded_at)}.
          </p>
        ) : (
          <p className="muted">Aucune mesure reçue pour l&apos;instant.</p>
        )}
        <p className="muted">
          Sur cron-job.org, crée une tâche toutes les 5 minutes vers <code>/api/cron</code> avec
          l&apos;en-tête <code>Authorization: Bearer &lt;CRON_SECRET&gt;</code>. Voir le README.
        </p>
      </div>
    </>
  );
}
