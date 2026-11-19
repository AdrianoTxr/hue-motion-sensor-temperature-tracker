import { collect } from "@/lib/collect";

export const dynamic = "force-dynamic";

/**
 * Appelé toutes les 30 minutes par cron-job.org avec l'en-tête
 * "Authorization: Bearer <CRON_SECRET>".
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await collect();
    return Response.json({ ok: true, ...result });
  } catch (err) {
    console.error(err);
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
