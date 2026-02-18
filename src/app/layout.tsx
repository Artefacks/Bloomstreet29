import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bloomstreet 1929",
  description: "Application de paper trading en temps réel",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}


