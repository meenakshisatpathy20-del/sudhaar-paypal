"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, money } from "@/components/api";
import { PayPalCheckout } from "@/components/PayPalCheckout";
import { PhotoPicker } from "@/components/PhotoPicker";
import { StatusPill } from "@/components/StatusPill";
import { useAppConfig } from "@/components/useAppConfig";
import type { Order } from "@/lib/types";

type Card =
  | { type: "quote"; quoteId: string; item: string; repairLow: number; repairHigh: number; newPrice: number; source: string }
  | { type: "booking"; orderId: string; paypalOrderId?: string; total: number; karigar: string; status: string }
  | { type: "refund"; orderId: string; amount: number; refundId?: string };
type Msg = { role: "user" | "agent"; text: string; cards?: Card[]; steps?: { tool: string; ok: boolean; paypalToolkit: boolean }[]; photo?: string };

const PROMPTS = [
  "My mixer jar blade is loose. Get it fixed under $8 by Friday.",
  "The zip on my daughter's school bag broke. Book the cheapest good option.",
  "What is the status of my last repair?",
  "My shoe sole came off again after the repair. Please sort it out.",
];

export default function AgentPage() {
  const cfg = useAppConfig();
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "agent", text: "Hi! I'm the Sudhaar Repair Agent. Tell me what's broken (add a photo if you can) and your budget or deadline. I'll find the right karigar, book it and set up the PayPal payment for you to approve." },
  ]);
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<string>();
  const [photoKey, setPhotoKey] = useState(0);
  const [sessionId, setSessionId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth" }), [msgs]);

  async function send(message: string) {
    if (!message.trim() || busy) return;
    setMsgs((m) => [...m, { role: "user", text: message, photo }]);
    setText("");
    setBusy(true);
    try {
      const r = await api<{ sessionId: string; reply: string; cards: Card[]; steps: Msg["steps"] }>("/api/agent", { sessionId, message, photo });
      setSessionId(r.sessionId);
      setMsgs((m) => [...m, { role: "agent", text: r.reply, cards: r.cards, steps: r.steps }]);
      setPhoto(undefined);
      setPhotoKey((k) => k + 1);
    } catch (e) {
      setMsgs((m) => [...m, { role: "agent", text: `⚠️ ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3">
      <div>
        <h1 className="text-xl font-bold">Repair Agent</h1>
        <p className="text-sm text-muted">
          An AI agent that books and pays on your behalf: it quotes, chooses a karigar and creates the PayPal order. You approve every payment.
        </p>
        {cfg?.ai.mode === "simulated" && <p className="mt-1 text-xs text-amber-700">The agent needs ANTHROPIC_API_KEY on the server.</p>}
      </div>
      <div className="card flex min-h-[50vh] flex-col gap-3">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[88%] space-y-2 rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "bg-brand text-white" : "bg-gray-100"}`}>
              {m.photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/uploads/${m.photo}`} alt="Attached" className="h-28 rounded-lg object-cover" />
              )}
              <p className="whitespace-pre-wrap">{m.text}</p>
              {m.steps && m.steps.length > 0 && (
                <p className="flex flex-wrap gap-1">
                  {m.steps.map((s, j) => (
                    <span key={j} className={`pill ${s.paypalToolkit ? "bg-[#e8f0fe] text-[#003087]" : "bg-white text-muted"}`}>
                      {s.ok ? "✓" : "✗"} {s.tool}
                      {s.paypalToolkit && " · PayPal Agent Toolkit"}
                    </span>
                  ))}
                </p>
              )}
              {m.cards?.map((c, j) => <AgentCard key={j} card={c} />)}
            </div>
          </div>
        ))}
        {busy && <p className="text-xs text-muted">Agent is working…</p>}
        <div ref={end} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PROMPTS.map((p) => (
          <button key={p} onClick={() => send(p)} disabled={busy} className="rounded-full border border-line bg-white px-3 py-1 text-xs text-muted hover:border-brand hover:text-brand">
            {p}
          </button>
        ))}
      </div>
      <div className="card grid gap-2 sm:grid-cols-[120px_1fr_auto] sm:items-end">
        <PhotoPicker key={photoKey} compact label="Photo" onUploaded={(f) => setPhoto(f)} />
        <textarea
          className="input min-h-24"
          placeholder="e.g. My chair leg is wobbly, fix it by Sunday under $15"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(text);
            }
          }}
        />
        <button className="btn" disabled={busy || !text.trim()} onClick={() => send(text)}>
          Send
        </button>
      </div>
    </div>
  );
}

function AgentCard({ card }: { card: Card }) {
  if (card.type === "quote")
    return (
      <div className="rounded-xl bg-white p-2 text-xs text-ink">
        <b>{card.item}</b>: repair {money(card.repairLow)}–{money(card.repairHigh)}
        {card.newPrice > 0 && ` vs new ${money(card.newPrice)}`} <span className="text-muted">({card.source})</span>
      </div>
    );
  if (card.type === "refund")
    return (
      <div className="rounded-xl bg-white p-2 text-xs text-ink">
        PayPal refund {money(card.amount)} issued <span className="font-mono">{card.refundId}</span>
      </div>
    );
  return <BookingCard card={card} />;
}

function BookingCard({ card }: { card: Extract<Card, { type: "booking" }> }) {
  const [order, setOrder] = useState<Order | null>(null);
  const refresh = () => api<{ order: Order }>(`/api/orders/${card.orderId}`).then((r) => setOrder(r.order)).catch(() => {});
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.orderId]);
  return (
    <div className="space-y-2 rounded-xl bg-white p-3 text-xs text-ink">
      <div className="flex items-center justify-between gap-2">
        <span>
          <b>{card.karigar}</b> · {money(card.total)} ·{" "}
          <Link className="font-mono text-brand underline" href={`/orders/${card.orderId}`}>
            {card.orderId}
          </Link>
        </span>
        {order && <StatusPill status={order.status} />}
      </div>
      {order?.status === "awaiting_payment" && card.paypalOrderId && (
        <PayPalCheckout orderId={card.orderId} paypalOrderId={card.paypalOrderId} total={card.total} onApproved={refresh} />
      )}
      {order && order.status !== "awaiting_payment" && (
        <p className="text-muted">
          Payment held by PayPal. Pickup OTP <b className="font-mono text-ink">{order.pickupOtp}</b>.{" "}
          <Link className="text-brand underline" href={`/orders/${card.orderId}`}>
            Track it
          </Link>
        </p>
      )}
    </div>
  );
}
