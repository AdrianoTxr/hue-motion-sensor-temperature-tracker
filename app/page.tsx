import Link from "next/link";
import DayChart from "./components/DayChart";
import { dayPoints, hourlyStats, listSensors, today, TIMEZONE } from "@/lib/queries";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const fmt = (n: number) => n.toFixed(1);

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; sensor?: string }>;
}) {
  const params = await searchParams;
  const current = today();
  const date = params.date && DATE_RE.test(params.date) ? params.date : current;

  const sensors = await listSensors();
  if (sensors.length === 0) {
    return (
      <div className="card">
        <h1>Aucune mesure pour l&apos;instant</h1>
        <p className="muted">
          Connecte ton compte Hue et configure la collecte depuis la page{" "}
          <Link href="/setup">Configuration</Link>.
        </p>
      </div>
    );
  }
  const sensor = sensors.find((s) => s.id === params.sensor) ?? sensors[0];
  const [points, hours] = await Promise.all([
    dayPoints(sensor.id, date),
    hourlyStats(sensor.id, date),
  ]);

  const temps = points.map((p) => p.temperature);
  const dayMin = temps.length ? Math.min(...temps) : null;
  const dayMax = temps.length ? Math.max(...temps) : null;
  const dayAvg = temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : null;

  const link = (d: string) => `/?date=${d}&sensor=${encodeURIComponent(sensor.id)}`;
  const longDate = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));

  return (
    <>
      <h1>
        {sensor.name} — <span style={{ textTransform: "capitalize" }}>{longDate}</span>
      </h1>

      <form className="card controls" method="get">
        <label>
          Capteur
          <select name="sensor" defaultValue={sensor.id}>
            {sensors.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label>
          Date
          <input type="date" name="date" defaultValue={date} max={current} />
        </label>
        <button type="submit">Afficher</button>
        <div className="nav-days">
          <Link href={link(shiftDate(date, -1))} aria-label="Jour précédent">←</Link>
          {date !== current && <Link href={link(current)}>Aujourd&apos;hui</Link>}
          {date < current && (
            <Link href={link(shiftDate(date, 1))} aria-label="Jour suivant">→</Link>
          )}
        </div>
      </form>

      {points.length === 0 ? (
        <div className="card muted">Aucune mesure ce jour-là.</div>
      ) : (
        <>
          <div className="card stats">
            <div className="stat"><div className="value" style={{ color: "var(--cold)" }}>{fmt(dayMin!)}°</div><div className="label">Minimum</div></div>
            <div className="stat"><div className="value">{fmt(dayAvg!)}°</div><div className="label">Moyenne</div></div>
            <div className="stat"><div className="value" style={{ color: "var(--warm)" }}>{fmt(dayMax!)}°</div><div className="label">Maximum</div></div>
          </div>

          <div className="card">
            <h2>Courbe de la journée</h2>
            <DayChart points={points} />
          </div>

          <div className="card">
            <h2>Par heure</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Heure</th><th>Min</th><th>Moy.</th><th>Max</th>
                    <th className="bar-col">Amplitude</th><th>Mesures</th>
                  </tr>
                </thead>
                <tbody>
                  {hours.map((h) => {
                    const span = dayMax! - dayMin! || 1;
                    const left = ((h.min - dayMin!) / span) * 100;
                    const width = Math.max(((h.max - h.min) / span) * 100, 2);
                    return (
                      <tr key={h.hour}>
                        <td>{String(h.hour).padStart(2, "0")}h</td>
                        <td>{fmt(h.min)}</td>
                        <td><strong>{fmt(h.avg)}</strong></td>
                        <td>{fmt(h.max)}</td>
                        <td className="bar-col">
                          <div className="bar"><span style={{ left: `${left}%`, width: `${width}%` }} /></div>
                        </td>
                        <td className="muted">{h.count}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      <p className="muted" style={{ fontSize: "0.8rem" }}>Fuseau horaire : {TIMEZONE}</p>
    </>
  );
}
