"use client";

import { useEffect, useState } from "react";
import { TicketPercent, X } from "lucide-react";
import { api } from "./api";
import { rupees } from "./Inr";
import { useLang } from "./LanguageProvider";
import { useSession } from "./SessionProvider";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export type AppliedCoupon = { code: string; amount: number; description: string } | null;
type Offer = { code: string; description: string; basketOnly?: boolean };

/**
 * Coupon code at checkout. The server checks the code (and checks it again when booking); the
 * discount comes out of Sudhaar's share, so the karigar and Saathi are always paid in full.
 */
export function CouponBox({ repairCharge, pickupFee, basket = false, value, onChange }: { repairCharge: number; pickupFee: number; basket?: boolean; value: AppliedCoupon; onChange: (c: AppliedCoupon) => void }) {
  const { t } = useLang();
  const { account } = useSession();
  const [code, setCode] = useState("");
  const [offers, setOffers] = useState<Offer[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<{ coupons: Offer[] }>("/api/coupons")
      .then((r) => setOffers(r.coupons.filter((c) => basket || !c.basketOnly)))
      .catch(() => {});
  }, [basket]);

  // Re-check when the price changes (e.g. another karigar), since the discount may change.
  const applied = value?.code;
  useEffect(() => {
    if (applied && account?.role === "customer") void apply(applied, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repairCharge, pickupFee]);

  async function apply(raw: string, quiet = false) {
    if (!raw.trim()) return;
    if (account?.role !== "customer") {
      setError(t("cpLogin"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await api<NonNullable<AppliedCoupon>>("/api/coupons", { action: "check", code: raw, repairCharge, pickupFee, basket });
      onChange(r);
      setCode("");
    } catch (e) {
      onChange(null);
      if (!quiet || raw === applied) setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-2xl bg-muted/40 p-3 ring-1 ring-border">
      <p className="flex items-center gap-1.5 text-xs font-semibold">
        <TicketPercent className="size-4 text-primary" /> {t("cpTitle")}
      </p>
      {value ? (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-teal/10 px-3 py-2 text-sm ring-1 ring-teal/25">
          <span>
            <b className="font-mono">{value.code}</b> · {value.description}
          </span>
          <span className="flex items-center gap-2 font-semibold text-teal">
            −{rupees(value.amount)}
            <button aria-label={t("cpRemove")} onClick={() => onChange(null)} className="rounded-full p-0.5 text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </span>
        </div>
      ) : (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void apply(code);
          }}
        >
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={t("cpPlaceholder")} className="h-10 font-mono uppercase" aria-label={t("cpTitle")} />
          <Button type="submit" variant="outline" disabled={busy || !code.trim()}>
            {t("cpApply")}
          </Button>
        </form>
      )}
      {!value && offers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {offers.map((o) => (
            <button key={o.code} type="button" onClick={() => void apply(o.code)} className="rounded-full border border-dashed border-primary/50 bg-card px-2.5 py-1 text-[11px] hover:bg-primary/10" title={o.description}>
              <b className="font-mono">{o.code}</b> · {o.description}
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <p className="text-[11px] text-muted-foreground">{t("cpFair")}</p>
    </div>
  );
}
