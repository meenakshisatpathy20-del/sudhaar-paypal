"use client";

import { useCallback, useState } from "react";
import { useLang } from "./LanguageProvider";

type LatLng = { lat: number; lng: number };

/** Asks the browser for the device's current position (the user sees the browser's own permission prompt). */
export function useGeolocate() {
  const { t } = useLang();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locate = useCallback(
    () =>
      new Promise<LatLng | null>((resolve) => {
        setError(null);
        if (typeof navigator === "undefined" || !navigator.geolocation) {
          setError(t("locFailed"));
          return resolve(null);
        }
        setBusy(true);
        navigator.geolocation.getCurrentPosition(
          (p) => {
            setBusy(false);
            resolve({ lat: Math.round(p.coords.latitude * 1e5) / 1e5, lng: Math.round(p.coords.longitude * 1e5) / 1e5 });
          },
          (e) => {
            setBusy(false);
            setError(t(e.code === e.PERMISSION_DENIED ? "locDenied" : "locFailed"));
            resolve(null);
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
        );
      }),
    [t],
  );
  return { locate, busy, error };
}
