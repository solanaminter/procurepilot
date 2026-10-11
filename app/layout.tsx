import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProcurePilot — Conversational AI Procurement Agent",
  description:
    "ProcurePilot: a conversational AI procurement agent for small businesses. Discover products, compare merchants, approve, and order via PayPal.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">
        {children}
      </body>
    </html>
  );
}
