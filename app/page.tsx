"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, money } from "@/components/api";
import { PhotoPicker } from "@/components/PhotoPicker";
import { StatusPill } from "@/components/StatusPill";
import { CATEGORY_LABEL, PICKUP_RATE_CARD } from "@/lib/pricing";
import type { Karigar, Order, Quote } from "@/lib/types";

type Offer = { karigar: Karigar; distanceKm: number; price: number; pickupFee: number; total: number; readyInDays: number; best?: boolean };

const EXAMPLES = [
  "Mixer grinder jar blade is loose and it makes a grinding noise",
  "School bag zip is broken and one strap is torn",
  "Sole of my leather shoe is coming off at the front",
  "Wooden chair leg is wobbly",
  "Kitchen tap is leaking",
];

export default function Home() {
  const router = useRouter();
  const [photo, setPhoto] = useState<string>();
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<(Quote & { warning?: string }) | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [donate, setDonate] = useState(true);
  const [booking, setBooking] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [impact, setImpact] = useState<{ itemsRepaired: number; kgSaved: number; moneySaved: number; karigarEarnings: number } | null>(null);

  useEffect(() => {
    api<{ orders: Order[] }>("/api/orders").then((r) => setOrders(r.orders.slice(0, 5))).catch(() => {});
    api<{ impact: typeof impact }>("/api/admin").then((r) => setImpact(r.impact)).catch(() => {});
  }, []);

  async function getQuote() {
    setError(null);
    setLoading(true);
    setQuote(null);
    setOffers([]);
    try {
      const r = await api<{ quote: Quote & { warning?: string }; offers: Offer[] }>("/api/quote", { photo, description });
      setQuote(r.quote);
      setOffers(r.offers);
      setSelected(r.offers.find((o) => o.best)?.karigar.id ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function book() {
    if (!quote || !selected) return;
    setBooking(true);
    setError(null);
    try {
      const r = await api<{ order: Order }>("/api/orders", { quoteId: quote.id, karigarId: selected, donation: donate ? 1 : 0 });
      router.push(`/orders/${r.order.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBooking(false);
    }
  }

  const offer = offers.find((o) => o.karigar.id === selected);
  const mid = quote ? (quote.repairLow + quote.repairHigh) / 2 : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <section className="min-w-0 space-y-4">
        <div className="rounded-3xl bg-gradient-to-br from-brand-dark via-brand to-[#14958a] p-6 text-white">
          <p className="text-sm font-semibold text-amber-200">Repair, don&apos;t replace.</p>
          <h1 className="mt-1 text-3xl font-extrabold leading-tight">Get it fixed by a verified local karigar, without leaving home.</h1>
          <p className="mt-3 text-sm text-teal-50">
            Snap a photo and AI tells you what the repair should cost compared with buying new. A Repair Saathi picks it up, and your PayPal payment stays on
            hold until the repaired item is back in your hands.
          </p>
          <ol className="mt-4 grid grid-cols-3 gap-2 text-xs">
            {["Snap & get an AI quote", "Pay with PayPal: money is held", "Delivered: karigar paid instantly"].map((s, i) => (
              <li key={s} className="rounded-xl bg-white/10 p-2">
                <span className="mb-1 grid h-5 w-5 place-items-center rounded-full bg-white text-[11px] font-bold text-brand">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        </div>

        <div className="card text-sm">
          <p className="font-semibold text-accent">Why we built this</p>
          <p className="mt-1 text-muted">
            This Diwali, my mother was sorting old things at home that only needed a small repair. Even though we live in a city, she struggled to find anyone to
            fix them. The karigars are right there in our neighbourhood, but nobody can find them, and nobody comes home to collect the items.
          </p>
        </div>

        {impact && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Items repaired", String(impact.itemsRepaired)],
              ["Kept from landfill", `${impact.kgSaved} kg`],
              ["Saved vs. buying new", money(impact.moneySaved)],
              ["Paid to karigars", money(impact.karigarEarnings)],
            ].map(([k, v]) => (
              <div key={k} className="card p-3">
                <p className="text-lg font-extrabold text-brand">{v}</p>
                <p className="text-xs text-muted">{k}</p>
              </div>
            ))}
          </div>
        )}

        {orders.length > 0 && (
          <div className="card">
            <p className="label">Your recent repairs</p>
            <ul className="divide-y divide-line">
              {orders.map((o) => (
                <li key={o.id}>
                  <Link href={`/orders/${o.id}`} className="flex items-center justify-between gap-2 py-2 text-sm hover:text-brand">
                    <span className="truncate">
                      <span className="font-mono text-xs text-muted">{o.id}</span> {o.item}
                    </span>
                    <StatusPill status={o.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="min-w-0 space-y-4">
        <div className="card space-y-3">
          <h2 className="text-lg font-bold">What needs fixing?</h2>
          <PhotoPicker label="Snap or upload a photo" onUploaded={(f) => setPhoto(f)} />
          <div>
            <label className="label" htmlFor="desc">
              Describe the problem (optional with a photo)
            </label>
            <textarea id="desc" className="input min-h-20" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Mixer jar blade is loose" />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {EXAMPLES.map((ex) => (
                <button key={ex} type="button" onClick={() => setDescription(ex)} className="rounded-full border border-line px-2.5 py-1 text-xs text-muted hover:border-brand hover:text-brand">
                  {ex.split(" ").slice(0, 3).join(" ")}…
                </button>
              ))}
            </div>
          </div>
          <button className="btn w-full" onClick={getQuote} disabled={loading || (!photo && !description.trim())}>
            {loading ? "AI is looking at your item…" : "Get AI repair quote"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        {quote && (
          <div className="card space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="label">AI quote · {CATEGORY_LABEL[quote.category]}</p>
                <h3 className="text-lg font-bold">{quote.item}</h3>
                <p className="text-sm text-muted">{quote.issue}</p>
              </div>
              <span className={`pill ${quote.source === "claude" ? "bg-brand-light text-brand-dark" : "bg-amber-100 text-amber-800"}`}>
                {quote.source === "claude" ? "Claude vision" : "Simulated"} · {quote.confidence}
              </span>
            </div>
            {quote.repairable ? (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-brand-light p-2">
                  <p className="text-xs text-muted">Repair</p>
                  <p className="font-extrabold text-brand-dark">
                    {money(quote.repairLow)}–{money(quote.repairHigh)}
                  </p>
                </div>
                <div className="rounded-xl bg-gray-100 p-2">
                  <p className="text-xs text-muted">Buy new</p>
                  <p className="font-extrabold">{quote.newPrice ? money(quote.newPrice) : "n/a"}</p>
                </div>
                <div className="rounded-xl bg-accent-light p-2">
                  <p className="text-xs text-muted">You save</p>
                  <p className="font-extrabold text-amber-700">{quote.newPrice ? `~${money(Math.max(0, quote.newPrice - mid))}` : "n/a"}</p>
                </div>
              </div>
            ) : (
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                This doesn&apos;t look worth repairing. Sudhaar can send a raddiwala or recycler to collect it for scrap value instead of it going to landfill.
              </p>
            )}
            <p className="text-xs text-muted">{quote.notes}</p>
            {quote.warning && <p className="text-xs text-amber-700">{quote.warning}</p>}
          </div>
        )}

        {quote?.repairable && (
          <div className="card space-y-3">
            <div className="flex items-baseline justify-between">
              <h3 className="font-bold">Verified karigars near you</h3>
              <span className="text-xs text-muted">{offers.length} found · sorted by best value</span>
            </div>
            {offers.length === 0 && <p className="text-sm text-muted">No karigar with this skill within 8 km yet.</p>}
            <ul className="space-y-2">
              {offers.map((o) => (
                <li key={o.karigar.id}>
                  <button
                    onClick={() => setSelected(o.karigar.id)}
                    className={`w-full rounded-xl border p-3 text-left transition ${selected === o.karigar.id ? "border-brand bg-brand-light/60 ring-2 ring-brand/20" : "border-line hover:border-brand/50"}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: o.karigar.avatarColor }}>
                        {o.karigar.name[0]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate font-semibold">
                          {o.karigar.shop}
                          {o.karigar.verified && <span className="pill bg-brand text-white">✓ KYC</span>}
                          {o.best && <span className="pill bg-accent-light text-amber-800">Best value</span>}
                        </p>
                        <p className="text-xs text-muted">
                          {o.karigar.rating.toFixed(1)}★ · {o.karigar.jobsDone} jobs · <b>{o.distanceKm} km</b> · {o.readyInDays === 0 ? "same day" : `${o.readyInDays} day${o.readyInDays > 1 ? "s" : ""}`} ·{" "}
                          {o.karigar.languages.join(", ")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-extrabold">{money(o.price)}</p>
                        <p className="text-[11px] text-muted">+{money(o.pickupFee)} pickup</p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>

            {offer && (
              <div className="space-y-2 rounded-xl border border-line p-3 text-sm">
                <div className="flex justify-between">
                  <span>Repair ({offer.karigar.shop})</span>
                  <span>{money(offer.price)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{quote.category === "plumbing" || quote.category === "electrical" ? "Home visit fee" : `Pickup & delivery (${offer.distanceKm} km)`}</span>
                  <span>{money(offer.pickupFee)}</span>
                </div>
                <label className="flex cursor-pointer items-center justify-between">
                  <span>
                    <input type="checkbox" className="mr-2 accent-brand" checked={donate} onChange={(e) => setDonate(e.target.checked)} />
                    Add $1 to the karigar tool fund
                  </span>
                  <span>{donate ? money(1) : money(0)}</span>
                </label>
                <div className="flex justify-between border-t border-line pt-2 font-bold">
                  <span>Total (held by PayPal until delivery)</span>
                  <span>{money(offer.total + (donate ? 1 : 0))}</span>
                </div>
                <button className="btn w-full" onClick={book} disabled={booking}>
                  {booking ? "Creating PayPal order…" : "Book & continue to PayPal"}
                </button>
              </div>
            )}
            <details className="text-xs text-muted">
              <summary className="cursor-pointer">Pickup rate card (distance × size)</summary>
              <table className="mt-2 w-full text-left">
                <thead>
                  <tr>
                    <th className="py-1">Distance</th>
                    <th>Small</th>
                    <th>Medium</th>
                    <th>Large</th>
                  </tr>
                </thead>
                <tbody>
                  {PICKUP_RATE_CARD.map((z) => (
                    <tr key={z.label} className="border-t border-line">
                      <td className="py-1">{z.label}</td>
                      <td>{money(z.fee.small)}</td>
                      <td>{money(z.fee.medium)}</td>
                      <td>{money(z.fee.large)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </div>
        )}
      </section>
    </div>
  );
}
