"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { langMeta } from "@/lib/i18n";
import type { Notification } from "@/lib/types";
import { api } from "../api";
import { useLang } from "../LanguageProvider";

/** Header bell: Resolve Hub updates (new claims, replies, status changes) for whoever is logged in. */
export function NotificationBell() {
  const { t, lang } = useLang();
  const path = usePathname();
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const load = useCallback(() => {
    api<{ items: Notification[]; unread: number }>("/api/notifications")
      .then((r) => {
        setItems(r.items);
        setUnread(r.unread);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load, path]);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const text = (n: Notification) => t(n.key as never, { ...n.params, ...(n.params.status ? { status: t(`rhSt_${n.params.status}` as never) } : {}) });
  async function readAll() {
    const r = await api<{ items: Notification[]; unread: number }>("/api/notifications", {}).catch(() => null);
    if (r) {
      setItems(r.items);
      setUnread(r.unread);
    }
  }
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} aria-label={t("nTitle")} aria-expanded={open} className="relative grid size-8 place-items-center rounded-full bg-muted ring-1 ring-border">
        <Bell className="size-4" />
        {unread > 0 && <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-2xl border border-border bg-card p-2 shadow-xl">
          <div className="flex items-center justify-between px-2 py-1">
            <p className="text-sm font-semibold">{t("nTitle")}</p>
            {unread > 0 && (
              <button onClick={readAll} className="text-xs font-semibold text-primary">
                {t("nReadAll")}
              </button>
            )}
          </div>
          {items.length === 0 && <p className="px-2 py-4 text-center text-xs text-muted-foreground">{t("nEmpty")}</p>}
          <div className="max-h-96 overflow-y-auto">
            {items.map((n) => (
              <Link
                key={n.id}
                href={n.href}
                onClick={() => api("/api/notifications", { ids: [n.id] }).then(load).catch(() => {})}
                className={`block rounded-xl px-2 py-2 text-sm hover:bg-muted ${n.read ? "text-muted-foreground" : ""}`}
              >
                <span className="flex gap-2">
                  {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
                  <span>
                    {text(n)}
                    <span className="block text-[11px] text-muted-foreground">{new Date(n.at).toLocaleString(langMeta(lang).locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
