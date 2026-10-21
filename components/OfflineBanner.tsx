"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { useLang } from "./LanguageProvider";

/** Weak networks are normal for our users: say so plainly instead of showing empty screens. */
export function OfflineBanner() {
  const { t } = useLang();
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (!offline) return null;
  return (
    <div role="status" className="flex items-center justify-center gap-2 bg-marigold/25 px-4 py-2 text-center text-xs font-medium text-[#7a4a06]">
      <WifiOff className="size-4 shrink-0" /> {t("offlineBanner")}
    </div>
  );
}
