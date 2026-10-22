"use client";

import { useEffect, useRef, useState } from "react";
import { loadCoreSdkScript } from "@paypal/paypal-js/sdk-v6";
import { api, money } from "./api";
import { rupees } from "./Inr";
import { useLang } from "./LanguageProvider";
import { useAppConfig } from "./useAppConfig";

/**
 * PayPal JS SDK v6 checkout. The server already created the PayPal order with intent AUTHORIZE;
 * on approval we ask the server to authorize it, which places a hold on the buyer's funds.
 * A thank-you tip (`tipId`) is the exception: its PayPal order is intent CAPTURE, so it is paid at once.
 * In simulated mode (no sandbox keys) a plain button stands in for the PayPal popup.
 */
export function PayPalCheckout({
  orderId,
  paypalOrderId,
  total,
  onApproved,
  token,
  topUp,
  tipId,
}: {
  orderId: string;
  paypalOrderId: string;
  total: number;
  onApproved: () => void;
  token?: string;
  topUp?: boolean;
  tipId?: string;
}) {
  const cfg = useAppConfig();
  const { t } = useLang();
  const holder = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "working" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cfg || cfg.paypal.mode !== "sandbox" || !cfg.paypal.clientId) return;
    let cancelled = false;
    (async () => {
      try {
        const paypal = await loadCoreSdkScript({ environment: "sandbox" });
        if (!paypal || cancelled) return;
        const sdk = await paypal.createInstance({ clientId: cfg.paypal.clientId!, components: ["paypal-payments"], pageType: "checkout" });
        const eligibility = await sdk.findEligibleMethods({ currencyCode: "USD" });
        if (!eligibility.isEligible("paypal")) throw new Error("PayPal is not eligible for this buyer");
        const session = sdk.createPayPalOneTimePaymentSession({
          onApprove: async ({ orderId: approvedId }) => {
            setStatus("working");
            try {
              await api(`/api/orders/${orderId}/approve`, { paypalOrderId: approvedId, token, topUp, tipId });
              onApproved();
            } catch (e) {
              setError((e as Error).message);
              setStatus("error");
            }
          },
          onCancel: () => setStatus("ready"),
          onError: (e) => {
            setError(e instanceof Error ? e.message : "PayPal could not complete the payment");
            setStatus("error");
          },
        });
        if (cancelled || !holder.current) return;
        const button = document.createElement("paypal-button");
        button.type = "pay";
        button.addEventListener("click", async () => {
          setError(null);
          try {
            await session.start({ presentationMode: "auto" }, Promise.resolve({ orderId: paypalOrderId }));
          } catch (e) {
            setError((e as Error).message);
          }
        });
        holder.current.replaceChildren(button);
        setStatus("ready");
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setStatus("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cfg, orderId, paypalOrderId, onApproved, token, topUp, tipId]);

  if (!cfg) return null;

  if (cfg.paypal.mode !== "sandbox") {
    return (
      <div className="space-y-2">
        <button
          className="w-full rounded-xl bg-[#ffc439] px-4 py-3 text-sm font-bold text-[#003087] hover:brightness-95 disabled:opacity-50"
          disabled={status === "working"}
          onClick={async () => {
            setStatus("working");
            try {
              await api(`/api/orders/${orderId}/approve`, { paypalOrderId, token, topUp, tipId });
              onApproved();
            } catch (e) {
              setError((e as Error).message);
              setStatus("error");
            }
          }}
        >
          {status === "working" ? (tipId ? t("ppPaying", { amount: money(total) }) : t("ppAuthorizing")) : t("ppPaySim", { inr: rupees(total), usd: money(total) })}
        </button>
        <p className="text-xs text-gold">{t("ppSimNote")}</p>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div ref={holder} className="min-h-12 overflow-hidden rounded-xl bg-white p-2" />
      {status === "loading" && <p className="text-xs text-muted-foreground">{t("ppLoading")}</p>}
      {status === "working" && <p className="text-xs text-muted-foreground">{t(tipId ? "ppPaying" : "ppHolding", { amount: money(total) })}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
