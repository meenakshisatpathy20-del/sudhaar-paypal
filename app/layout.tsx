import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Sudhaar – Repair, don't replace",
  description:
    "Doorstep repair marketplace for local karigars. AI repair quotes, PayPal-held payments released on delivery OTP, instant payouts and AI-assisted refunds.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f766e" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <Nav />
        <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-4">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pb-8 text-center text-xs text-muted">
          Sudhaar runs on the PayPal sandbox. No real money moves. Built for the PayPal AI Hackathon 2026.
        </footer>
      </body>
    </html>
  );
}
