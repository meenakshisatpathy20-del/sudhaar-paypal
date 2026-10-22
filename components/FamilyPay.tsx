"use client";

import { useState } from "react";
import { Copy, HeartHandshake, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLang } from "./LanguageProvider";

export type FamilyPayValue = { name: string; relation: string } | null;

const RELATIONS = ["son", "daughter", "grandchild", "brother", "sister", "friend"];

/** Toggle + fields for Family Pay at checkout. */
export function FamilyPayPicker({ value, onChange }: { value: FamilyPayValue; onChange: (v: FamilyPayValue) => void }) {
  const { t } = useLang();
  const on = value !== null;
  return (
    <div className={cn("rounded-2xl p-3 ring-1 transition", on ? "bg-teal/10 ring-teal/40" : "bg-muted/50 ring-border")}>
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" className="mt-1 size-4 accent-[#1f8a7a]" checked={on} onChange={(e) => onChange(e.target.checked ? { name: "", relation: "son" } : null)} />
        <span>
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <HeartHandshake className="size-4 text-teal" /> {t("familyPay")}
          </span>
          <span className="block text-xs text-muted-foreground">{t("familyPaySub")}</span>
        </span>
      </label>
      {on && (
        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
          <Input placeholder={t("familyName")} value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} />
          <select value={value.relation} onChange={(e) => onChange({ ...value, relation: e.target.value })} className="h-11 rounded-xl border border-input bg-card px-3 text-sm" aria-label={t("familyRelation")}>
            {RELATIONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

/** Share the Family Pay link by WhatsApp or copy. */
export function FamilyPayShare({ orderId, token, name, item, total }: { orderId: string; token?: string; name: string; item: string; total: string }) {
  const { t } = useLang();
  const [copied, setCopied] = useState(false);
  // The token makes the link work for this one order without an account.
  const path = `/pay/${orderId}${token ? `?t=${token}` : ""}`;
  const url = typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
  const text = `Hi ${name}, could you pay for my repair on Sudhaar (${item}, ${total})? PayPal holds the money until it's fixed and back home: ${url}`;
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild className="bg-[#25d366] text-white hover:bg-[#1fb757]">
        <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
          <MessageCircle /> {t("shareWhatsApp")}
        </a>
      </Button>
      <Button
        variant="outline"
        onClick={() => {
          navigator.clipboard?.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          });
        }}
      >
        <Copy /> {copied ? t("copied") : t("copyLink")}
      </Button>
    </div>
  );
}
