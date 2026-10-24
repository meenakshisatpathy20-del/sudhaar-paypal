"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Compass, X } from "lucide-react";
import { useLang } from "../LanguageProvider";

const KEY = "sudhaar.guideBar";

/** A slim bar pointing first-time visitors (and judges) to the demo guide and the partner apps. */
export function JudgeBar() {
  const { t } = useLang();
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      setShow(localStorage.getItem(KEY) !== "hidden");
    } catch {
      setShow(true);
    }
  }, []);
  if (!show) return null;
  return (
    <div className="border-b border-border bg-teal/10">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 text-xs sm:text-sm">
        <Compass className="size-4 shrink-0 text-teal" />
        <p className="min-w-0 flex-1">
          {t("jbText")}{" "}
          <Link href="/guide" className="font-semibold text-teal underline">
            {t("jbGuide")}
          </Link>
          <span className="text-muted-foreground"> · </span>
          <Link href="/partner" className="font-semibold text-teal underline">
            {t("jbPartners")}
          </Link>
        </p>
        <button
          aria-label={t("jbHide")}
          onClick={() => {
            setShow(false);
            try {
              localStorage.setItem(KEY, "hidden");
            } catch {}
          }}
          className="rounded-full p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
