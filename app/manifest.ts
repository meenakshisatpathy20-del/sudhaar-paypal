import type { MetadataRoute } from "next";

// Installable on Android/iOS home screens, so Sudhaar feels like an app on everyday phones.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sudhaar – Repair, don't replace",
    short_name: "Sudhaar",
    description: "Verified local karigars, doorstep pickup and PayPal-protected repair payments.",
    start_url: "/",
    display: "standalone",
    background_color: "#fff8ee",
    theme_color: "#d9572b",
    lang: "en-IN",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
