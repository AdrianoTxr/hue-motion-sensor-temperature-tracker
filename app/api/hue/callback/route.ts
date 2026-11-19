import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { completeAuthorization } from "@/lib/hue";

export const dynamic = "force-dynamic";

/** URL de callback à déclarer dans l'application Hue : https://<ton-site>/api/hue/callback */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  const expected = jar.get("hue_oauth_state")?.value;
  jar.delete("hue_oauth_state");

  if (!code || !state || state !== expected) {
    redirect("/setup?error=" + encodeURIComponent("Autorisation invalide ou expirée, réessaie."));
  }

  let error: string | null = null;
  try {
    await completeAuthorization(code);
  } catch (err) {
    console.error(err);
    error = err instanceof Error ? err.message : String(err);
  }
  redirect(error ? "/setup?error=" + encodeURIComponent(error) : "/setup?ok=1");
}
