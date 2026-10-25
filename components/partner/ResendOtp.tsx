"use client";

import { useState } from "react";
import { MessageSquareText } from "lucide-react";
import { api } from "../api";
import { useLang } from "../LanguageProvider";

/** "Customer can't find the OTP?": texts it again to the customer's registered number. */
export function ResendOtp({ orderId }: { orderId: string }) {
  const { t } = useLang();
  const [state, setState] = useState<{ busy?: boolean; done?: string; error?: string }>({});
  async function send() {
    setState({ busy: true });
    try {
      const r = await api<{ sentTo: string }>(`/api/orders/${orderId}/otp-sms`, {});
      setState({ done: r.sentTo });
    } catch (e) {
      setState({ error: (e as Error).message });
    }
  }
  return (
    <div className="text-xs">
      {state.done ? (
        <p className="text-teal">{t("otpSent", { to: state.done })}</p>
      ) : (
        <button onClick={send} disabled={state.busy} className="inline-flex items-center gap-1 font-semibold text-primary underline disabled:opacity-50">
          <MessageSquareText className="size-3.5" /> {t("otpResend")}
        </button>
      )}
      {state.error && <p className="text-destructive">{state.error}</p>}
    </div>
  );
}
