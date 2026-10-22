"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, HandHeart, RotateCcw, Star } from "lucide-react";
import { api } from "./api";
import { rupees } from "./Inr";
import { useLang } from "./LanguageProvider";
import { PayPalCheckout } from "./PayPalCheckout";
import { Avatar } from "./ui/avatar";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Textarea } from "./ui/input";
import { INR_PER_USD } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import type { Category, Order } from "@/lib/types";

/** Kept in step with TIP_CHOICES_INR in lib/orders.ts, which the server enforces. */
const TIP_CHOICES_INR = [20, 50, 100];

export type DeliveredKarigar = { id: string; name: string; shop: string; avatarColor: string; issue: string; category: Category };

/** After delivery: rate each karigar, optionally tip them through PayPal, or book them again. */
export function AfterDelivery({ order, karigars, onChange }: { order: Order; karigars: DeliveredKarigar[]; onChange: () => void }) {
  const { t } = useLang();
  return (
    <Card>
      <CardContent className="space-y-4">
        <h2 className="font-bold">{t("rtTitle")}</h2>
        {karigars.map((k) => (
          <KarigarThanks key={k.id} order={order} k={k} onChange={onChange} />
        ))}
      </CardContent>
    </Card>
  );
}

function KarigarThanks({ order, k, onChange }: { order: Order; k: DeliveredKarigar; onChange: () => void }) {
  const { t } = useLang();
  const rated = order.ratings?.find((r) => r.karigarId === k.id);
  const paidTip = order.tips?.find((x) => x.karigarId === k.id && x.status === "paid");
  const pendingTip = order.tips?.find((x) => x.karigarId === k.id && x.status === "awaiting_payment");
  const [stars, setStars] = useState(0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = (path: string, body: unknown) => {
    setBusy(true);
    setError(null);
    api(path, body)
      .then(onChange)
      .catch((e) => setError((e as Error).message))
      .finally(() => setBusy(false));
  };

  return (
    <div className="space-y-3 rounded-2xl bg-muted/50 p-3 ring-1 ring-border">
      <div className="flex items-center gap-3">
        <Avatar name={k.name} color={k.avatarColor} className="size-9" />
        <p className="min-w-0 flex-1 truncate font-semibold">{k.shop}</p>
        <Link href={`/fix?d=${encodeURIComponent(k.issue)}&c=${k.category}&k=${k.id}`} className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary">
          <RotateCcw className="size-3.5" /> {t("bookAgain")}
        </Link>
      </div>

      {rated ? (
        <p className="flex items-center gap-1.5 text-sm text-teal">
          <Check className="size-4" /> {t("rtThanks", { shop: k.shop, stars: rated.stars })}
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-1" role="radiogroup" aria-label={t("rtFor", { shop: k.shop })}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={t("rtStars", { n })} onClick={() => setStars(n)} className="rounded-lg p-1 hover:bg-muted">
                <Star className={cn("size-7", n <= stars ? "fill-gold text-gold" : "text-muted-foreground")} />
              </button>
            ))}
          </div>
          <Textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 300))} placeholder={t("rtPlaceholder")} rows={2} />
          <Button size="sm" disabled={!stars || busy} onClick={() => send(`/api/orders/${order.id}/rate`, { karigarId: k.id, stars, text })}>
            {t("rtSubmit")}
          </Button>
        </div>
      )}

      <div className="space-y-2 border-t border-border pt-3">
        {paidTip ? (
          <p className="flex items-center gap-1.5 text-sm text-teal">
            <HandHeart className="size-4" /> {t("tipPaid", { shop: k.shop, amount: rupees(paidTip.amount) })}
          </p>
        ) : (
          <>
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <HandHeart className="size-4 text-primary" /> {t("tipTitle")}
            </p>
            <div className="flex flex-wrap gap-2">
              {TIP_CHOICES_INR.map((inr) => {
                const active = pendingTip && Math.abs(pendingTip.amount * INR_PER_USD - inr) < 1;
                return (
                  <button
                    key={inr}
                    type="button"
                    disabled={busy}
                    onClick={() => send(`/api/orders/${order.id}/tip`, { karigarId: k.id, inr })}
                    className={cn("rounded-full px-4 py-1.5 text-sm font-semibold ring-1", active ? "bg-primary text-primary-foreground ring-primary" : "bg-card ring-border hover:bg-muted")}
                  >
                    ₹{inr}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">{t("tipNote", { shop: k.shop })}</p>
            {pendingTip?.paypalOrderId && <PayPalCheckout orderId={order.id} paypalOrderId={pendingTip.paypalOrderId} total={pendingTip.amount} tipId={pendingTip.id} onApproved={onChange} />}
          </>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
