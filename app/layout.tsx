import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/baloo-2";
import "@fontsource/noto-sans-devanagari/400.css";
import "@fontsource/noto-sans-devanagari/600.css";
import "@fontsource/noto-sans-bengali/400.css";
import "@fontsource/noto-sans-bengali/600.css";
import "@fontsource/noto-sans-tamil/400.css";
import "@fontsource/noto-sans-tamil/600.css";
import "@fontsource/noto-sans-telugu/400.css";
import "@fontsource/noto-sans-telugu/600.css";
import "@fontsource/noto-sans-kannada/400.css";
import "@fontsource/noto-sans-kannada/600.css";
import "@fontsource/noto-sans-oriya/400.css";
import "@fontsource/noto-sans-oriya/600.css";
import "./globals.css";
import { LanguageProvider } from "@/components/LanguageProvider";
import { RegisterSW } from "@/components/RegisterSW";
import { SessionProvider } from "@/components/SessionProvider";

export const metadata: Metadata = {
  title: "Sudhaar – Repair, don't replace",
  description:
    "Give your things a second life. Verified local karigars, doorstep pickup, AI repair quotes and PayPal-protected payments released only on delivery.",
  appleWebApp: { capable: true, title: "Sudhaar", statusBarStyle: "default" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#fff8ee" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // Browser extensions (Grammarly, translators, dark-mode tools) add attributes to <html>/<body>
    // before React loads; this tells React to ignore only those two elements' attributes.
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen font-sans" suppressHydrationWarning>
        <LanguageProvider>
          <SessionProvider>{children}</SessionProvider>
        </LanguageProvider>
        <RegisterSW />
      </body>
    </html>
  );
}
