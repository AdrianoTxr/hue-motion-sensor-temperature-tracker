import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authorizeUrl } from "@/lib/hue";

export const dynamic = "force-dynamic";

/** Démarre l'autorisation OAuth Hue (protégé par le mot de passe du site). */
export async function GET() {
  const state = crypto.randomUUID();
  (await cookies()).set("hue_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  redirect(authorizeUrl(state));
}
