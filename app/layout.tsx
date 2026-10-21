import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/baloo-2";
import "@fontsource/noto-sans-devanagari/400.css";
import "@fontsource/noto-sans-devanagari/600.css";
import "./globals.css";
import { LanguageProvider } from "@/components/LanguageProvider";

export const metadata: Metadata = {
  title: "Sudhaar – Repair, don't replace",
  description:
    "Give your things a second life. Verified local karigars, doorstep pickup, AI repair quotes and PayPal-protected payments released only on delivery.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#fff8ee" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
