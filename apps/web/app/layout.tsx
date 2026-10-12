import { connection } from "next/server";
import type { Metadata } from "next";
import "@fontsource/baloo-2/700.css";
import "@fontsource/baloo-2/800.css";
import "@fontsource/nunito-sans/400.css";
import "@fontsource/nunito-sans/600.css";
import "@fontsource/nunito-sans/700.css";
import "./globals.css";
import { LanguageRoot } from "../components/language";
export const metadata: Metadata = {
  title: "Timely — Un pequeño espacio para tu día",
  description: "Tu agenda personal, a tu ritmo.",
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  return (
    <html lang="es">
      <body>
        <LanguageRoot>{children}</LanguageRoot>
      </body>
    </html>
  );
}
