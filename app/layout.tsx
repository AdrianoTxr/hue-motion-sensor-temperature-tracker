import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Températures Hue",
  description: "Relevé de température des capteurs de mouvement Philips Hue",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <header className="top">
          <Link href="/" className="brand">🌡️ Températures Hue</Link>
          <nav>
            <Link href="/">Journée</Link>
            <Link href="/setup">Configuration</Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
