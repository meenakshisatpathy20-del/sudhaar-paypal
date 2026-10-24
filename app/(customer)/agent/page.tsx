"use client";

import { PhoneLine } from "@/components/PhoneLine";
import { RequireLogin } from "@/components/LoginSheet";
import { rupees } from "@/components/Inr";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Camera, Send, Sparkles, Volume2, VolumeX } from "lucide-react";
import { api } from "@/components/api";
import { useLang } from "@/components/LanguageProvider";
import { FamilyPayShare } from "@/components/FamilyPay";
import { LangToggle } from "@/components/LangToggle";
import { MicButton } from "@/components/MicButton";
import { PayPalCheckout } from "@/components/PayPalCheckout";
import { StatusPill } from "@/components/StatusPill";
import { useAppConfig } from "@/components/useAppConfig";
import { speak, stopSpeaking } from "@/components/voice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { PhotoPicker } from "@/components/PhotoPicker";
import { cn } from "@/lib/utils";
import type { Order } from "@/lib/types";

type AgentCard =
  | { type: "quote"; quoteId: string; item: string; repairLow: number; repairHigh: number; newPrice: number; source: string }
  | { type: "booking"; orderId: string; paypalOrderId?: string; total: number; karigar: string; status: string; familyPayer?: string }
  | { type: "refund"; orderId: string; amount: number; refundId?: string };
type Msg = { role: "user" | "agent"; text: string; cards?: AgentCard[]; steps?: { tool: string; ok: boolean; paypalToolkit: boolean }[]; photo?: string };


export default function TalkPage() {
  return (
    <RequireLogin>
      <TalkPageInner />
    </RequireLogin>
  );
}

function TalkPageInner() {
  const cfg = useAppConfig();
  const { t, lang, speakReplies, setSpeakReplies } = useLang();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<string>();
  const [photoKey, setPhotoKey] = useState(0);
  const [sessionId, setSessionId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // scrollIntoView returns a Promise in newer Chrome; never return it from an effect.
    void end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, busy]);
  useEffect(() => () => stopSpeaking(), []);

  async function send(message: string) {
    if (!message.trim() || busy) return;
    stopSpeaking();
    setMsgs((m) => [...m, { role: "user", text: message, photo }]);
    setText("");
    setBusy(true);
    try {
      const r = await api<{ sessionId: string; reply: string; cards: AgentCard[]; steps: Msg["steps"] }>("/api/agent", { sessionId, message, photo, lang }, { timeoutMs: 75_000 });
      setSessionId(r.sessionId);
      setMsgs((m) => [...m, { role: "agent", text: r.reply, cards: r.cards, steps: r.steps }]);
      if (speakReplies) speak(r.reply, lang);
      setPhoto(undefined);
      setPhotoKey((k) => k + 1);
    } catch (e) {
      setMsgs((m) => [...m, { role: "agent", text: `⚠️ ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-5xl items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
    <div className="flex min-w-0 flex-col gap-4">
      {/* voice orb */}
      <Card className="relative overflow-hidden bg-gradient-to-b from-marigold/20 to-card">
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="relative">
            <span className={cn("absolute -inset-6 rounded-full bg-primary/20 blur-2xl transition", busy && "animate-pulse")} />
            <MicButton size="lg" onText={setText} onFinal={(v) => send(v)} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t("talkTitle")}</h1>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{t("talkSub")}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* The assistant listens and replies in the language picked here */}
            <LangToggle />
            <button onClick={() => setSpeakReplies(!speakReplies)} className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-muted-foreground ring-1 ring-border hover:text-foreground">
              {speakReplies ? <Volume2 className="size-3" /> : <VolumeX className="size-3" />} {t("voiceReplies")}
            </button>
          </div>
          {cfg?.ai.mode === "simulated" && <p className="text-xs text-gold">{t("agentNeedsKey")}</p>}
        </CardContent>
      </Card>

      {msgs.length === 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {[t("prompt1"), t("prompt2"), t("prompt3"), t("prompt4")].map((p) => (
            <button key={p} onClick={() => send(p)} disabled={busy} className="paper rounded-2xl p-3 text-left text-sm text-muted-foreground transition hover:text-foreground">
              <Sparkles className="mb-1 size-4 text-primary" />
              {p}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {msgs.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[88%] space-y-2 rounded-3xl px-4 py-3 text-sm", m.role === "user" ? "rounded-br-lg bg-primary text-primary-foreground" : "paper rounded-bl-lg")}>
              {m.photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/uploads/${m.photo}`} alt="" className="h-28 rounded-2xl object-cover" />
              )}
              <p className="whitespace-pre-wrap leading-relaxed">{m.role === "agent" ? <RichText text={m.text} /> : m.text}</p>
              {m.role === "agent" && m.text && !m.text.startsWith("⚠️") && (
                <button onClick={() => speak(m.text, lang)} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
                  <Volume2 className="size-3" /> Listen
                </button>
              )}
              {m.steps && m.steps.length > 0 && (
                <p className="flex flex-wrap gap-1">
                  {m.steps.map((s, j) => (
                    <Badge key={j} variant={s.paypalToolkit ? "paypal" : "outline"}>
                      {s.ok ? "✓" : "✗"} {s.tool}
                      {s.paypalToolkit && " · PayPal Agent Toolkit"}
                    </Badge>
                  ))}
                </p>
              )}
              {m.cards?.map((c, j) => <AgentCardView key={j} card={c} />)}
            </div>
          </div>
        ))}
        {busy && <Working />}
        <div ref={end} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
        className="paper sticky bottom-24 flex items-center gap-2 rounded-2xl p-2 md:bottom-4"
      >
        <Sheet>
          <SheetTrigger asChild>
            <button type="button" className={cn("grid size-10 shrink-0 place-items-center rounded-xl ring-1 ring-border", photo ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted")} aria-label="Attach photo">
              <Camera className="size-5" />
            </button>
          </SheetTrigger>
          <SheetContent>
            <SheetTitle>{t("attachPhoto")}</SheetTitle>
            <PhotoPicker key={photoKey} onUploaded={(f) => setPhoto(f)} />
          </SheetContent>
        </Sheet>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("talkPlaceholder")} className="min-w-0 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground" />
        <MicButton onText={setText} />
        <Button type="submit" size="icon" disabled={busy || !text.trim()} aria-label={t("send")}>
          <Send />
        </Button>
      </form>
    </div>
    <aside className="hidden space-y-3 lg:sticky lg:top-24 lg:block">
      <Card>
        <CardContent className="space-y-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("tkCan")}</p>
          {(
            [
              ["get_repair_quote", t("tkQuote")],
              ["book_repair", t("tkBook")],
              ["book_ghar_safai_basket", t("tkBasket")],
              ["get_order_status", t("tkStatus")],
              ["cancel_booking", t("tkCancel")],
              ["raise_warranty_claim", t("tkClaim")],
              ["issue_refund", t("tkRefund")],
            ] as const
          ).map(([tool, what]) => (
            <div key={tool} className="text-xs">
              <p className="font-mono text-[11px] text-primary">{tool}</p>
              <p className="text-muted-foreground">{what}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      <p className="rounded-2xl bg-[#0070e0]/10 p-3 text-xs text-paypal-blue ring-1 ring-[#0070e0]/30">{t("tkSafe")}</p>
      <PhoneLine className="flex-col items-start" />
    </aside>
    </div>
  );
}

function AgentCardView({ card }: { card: AgentCard }) {
  if (card.type === "quote")
    return (
      <div className="rounded-2xl bg-muted p-3 text-xs">
        <b>{card.item}</b>: repair {rupees(card.repairLow)}–{rupees(card.repairHigh)}
        {card.newPrice > 0 && ` vs new ${rupees(card.newPrice)}`} <span className="text-muted-foreground">{card.source === "simulated" ? "(simulated estimate)" : "· AI quote by Gemini"}</span>
      </div>
    );
  if (card.type === "refund")
    return (
      <div className="rounded-2xl bg-muted p-3 text-xs">
        PayPal refund {rupees(card.amount)} issued <span className="font-mono">{card.refundId}</span>
      </div>
    );
  return <BookingCard card={card} />;
}

function BookingCard({ card }: { card: Extract<AgentCard, { type: "booking" }> }) {
  const [order, setOrder] = useState<Order | null>(null);
  const { t } = useLang();
  const refresh = () => api<{ order: Order }>(`/api/orders/${card.orderId}`).then((r) => setOrder(r.order)).catch(() => {});
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.orderId]);
  return (
    <div className="space-y-2 rounded-2xl bg-muted p-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span>
          <b>{card.karigar}</b> · {rupees(card.total)} ·{" "}
          <Link className="font-mono text-primary underline" href={`/orders/${card.orderId}`}>
            {card.orderId}
          </Link>
        </span>
        {order && <StatusPill status={order.status} />}
      </div>
      {order?.status === "awaiting_payment" && card.familyPayer && <FamilyPayShare orderId={card.orderId} token={order.familyPay?.token} name={card.familyPayer} item={order.item} total={rupees(card.total)} />}
      {order?.status === "awaiting_payment" && !card.familyPayer && card.paypalOrderId && <PayPalCheckout orderId={card.orderId} paypalOrderId={card.paypalOrderId} total={card.total} onApproved={refresh} />}
      {order && order.status !== "awaiting_payment" && (
        <p className="text-muted-foreground">
          {t("agentHeld")} <b className="font-mono text-foreground">{order.pickupOtp}</b> ·{" "}
          <Link className="text-primary underline" href={`/orders/${card.orderId}`}>
            {t("trackIt")}
          </Link>
        </p>
      )}
    </div>
  );
}

/** Shows **bold** from the assistant as bold and never shows stray Markdown symbols. */
function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*\n]+\*\*)/g).map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part.replace(/\*\*/g, "").replace(/^\s*[*-]\s+/gm, "• "),
      )}
    </>
  );
}

/** Typing dots, then an honest note after a few seconds so a slow AI reply never looks frozen. */
function Working() {
  const { t } = useLang();
  const [long, setLong] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setLong(true), 4000);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className="paper flex w-fit max-w-[85%] items-center gap-3 rounded-3xl rounded-bl-lg px-4 py-3">
      <span className="flex gap-1.5">
        {[0, 1, 2].map((d) => (
          <span key={d} className="size-2 rounded-full bg-primary" style={{ animation: `float-slow 1s ${d * 0.15}s ease-in-out infinite` }} />
        ))}
      </span>
      {long && <span className="text-xs text-muted-foreground">{t("talkWorking")}</span>}
    </div>
  );
}
