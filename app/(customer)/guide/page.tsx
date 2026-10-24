"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bike, Compass, Hammer, LayoutDashboard, ShoppingBag } from "lucide-react";
import { api } from "@/components/api";
import { useSession } from "@/components/SessionProvider";
import { useAppConfig } from "@/components/useAppConfig";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// The demo guide for judges and first-time visitors: the four apps, a five-minute walkthrough,
// and every page with what to try there and which PayPal / Gemini API it uses. (English only.)

const ROLES = [
  { role: "customer", title: "Customer", icon: ShoppingBag, home: "/", login: "9999999999 / PIN 1234", does: "Gets an AI quote, books a karigar, pays with PayPal (held until delivery), tracks the Saathi live, rates and tips." },
  { role: "saathi", title: "Repair Saathi", icon: Bike, home: "/saathi", login: "9100000001 / PIN 2222", does: "Picks up and delivers with OTPs, follows a route map, shares live location (or a demo ride), gets paid by PayPal Payouts." },
  { role: "karigar", title: "Karigar", icon: Hammer, home: "/karigar", login: "9000000003 / PIN 1111", does: "Inspects, changes the price if needed, repairs, uploads an after photo, sees payouts, reviews and edits their rate card." },
  { role: "admin", title: "Sudhaar team (admin)", icon: LayoutDashboard, home: "/admin", login: "9000000000 / PIN 2026", does: "Money flow, every PayPal call, refunds in Resolve Hub, coupons, Care members, live Saathi fleet, applications." },
] as const;

const STORY: [string, string, string][] = [
  ["Customer", "Open Get a quote, add a photo or type “mixer jar blade is loose”, and get a Gemini quote with the fix-or-replace meter.", "/fix"],
  ["Customer", "Choose a karigar (list + map), pick a pickup time, try coupon FIRSTFIX, then Book & pay with PayPal. The sandbox buyer login is shown under the button.", "/fix"],
  ["Customer", "On the order page: money is “Paid · on hold” (PayPal authorization). Note the pickup OTP and copy the live tracking link.", "/repairs"],
  ["Saathi", "In a private window, open Partner login → Saathi. Press Demo ride: the customer's map and tracking page show the Saathi moving with an ETA. Enter the pickup OTP.", "/partner"],
  ["Karigar", "Partner login → Karigar. Inspect & start repair, optionally Change price (the customer approves a second PayPal hold), upload an after photo, Mark repaired (Gemini checks the photo).", "/partner"],
  ["Saathi", "Collect from karigar, then enter the delivery OTP. This captures the PayPal payment and sends Payouts to the karigar (90%) and Saathi (75% of pickup).", "/partner"],
  ["Customer", "See the PayPal invoice, item passport, rate the karigar and send a ₹20–100 tip (100% paid out). Open Resolve Hub, pick the repair and raise a claim to see Gemini's suggestion.", "/resolve"],
  ["Admin", "Partner login → Admin: money flow, PayPal activity, refund the claim, create a coupon, see Care members and the live fleet map.", "/partner"],
];

const PAGES: [string, string, string, string][] = [
  ["/", "Customer", "Home: search, voice, Ghar Safai, impact numbers, map of karigars", "—"],
  ["/fix", "Customer", "AI quote → compare karigars → bill with coupon / Care → pickup slot → Family Pay → book", "Gemini (vision, JSON) · PayPal Orders v2 (AUTHORIZE, discount breakdown)"],
  ["/ghar-safai", "Customer", "Many items, one Saathi trip, one payment, split payouts; GHARSAFAI coupon", "Gemini · PayPal Orders v2 + Payouts (one batch, many karigars)"],
  ["/orders/[id]", "Customer", "Pay, OTPs, live Saathi on the map + ETA, share tracking, price change approval, invoice, rate & tip, Resolve Hub", "PayPal JS SDK v6, Authorizations, Captures, Refunds, Invoicing, Payouts · Gemini photo check & complaint review"],
  ["/track/[id]?t=…", "Anyone with the link", "Shiprocket-style tracking: timeline, live map, ETA. No OTPs or prices", "—"],
  ["/resolve", "Customer", "Resolve Hub: pick a delivered repair within warranty, raise a claim (PayPal invoice attached), follow AI review → team decision → PayPal refund", "Gemini complaint review · PayPal Refunds"],
  ["/profile", "Customer", "Details, saved location, Sudhaar Care, PayPal payments and invoices, impact, language and voice, change PIN", "—"],
  ["/agent", "Customer", "Talk to Sudhaar in 8 languages by voice: quote, book, track, cancel, warranty claim", "Gemini function calling (7 tools) · PayPal Orders v2 · PayPal Agent Toolkit (read orders, invoices, refunds, transactions, disputes)"],
  ["/care", "Customer", "Sudhaar Care monthly plan: free pickups, 30-day warranty; subscribe and cancel", "PayPal Catalog Products, Billing Plans, Subscriptions, Webhooks"],
  ["/pay/[id]?t=…", "Family member", "Family Pay: a relative pays from their own PayPal", "PayPal JS SDK v6 + Orders v2"],
  ["/join", "New partner", "Apply as a karigar or Repair Saathi (in 8 languages)", "—"],
  ["/saathi", "Saathi", "Trips, route map with numbered stops, live GPS / demo ride, OTP handovers, earnings, profile", "PayPal Payouts (GET batch status)"],
  ["/karigar", "Karigar", "Job board by stage, price change, after photo, earnings chart, reviews, rate card", "PayPal Payouts · Gemini photo check"],
  ["/admin", "Admin", "Money flow, PayPal activity, orders, Resolve Hub, photo checks, applications, coupons, Care, fleet, webhooks, system check", "PayPal Refunds, Payouts, Webhooks · Gemini"],
];

export default function GuidePage() {
  const router = useRouter();
  const { refresh, account } = useSession();
  const cfg = useAppConfig();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function open(role: string, home: string) {
    setBusy(role);
    setError(null);
    try {
      await api("/api/auth/demo", { role });
      await refresh();
      router.push(home);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }
  return (
    <div className="space-y-6">
      <section className="paper rounded-3xl bg-gradient-to-br from-teal/15 via-card to-marigold/15 p-6 md:p-8">
        <Badge variant="outline">
          <Compass /> Demo guide
        </Badge>
        <h1 className="mt-3 font-display text-4xl font-bold">See all of Sudhaar in 5 minutes</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Sudhaar is one website for everyone: customers, Repair Saathis (pickup partners), karigars (repairers) and the Sudhaar team. Customers use Home, My Repairs, Resolve Hub, Talk and Care; the karigar,
          Saathi and admin dashboards are on the same site behind a partner login (Partners menu, top right). Tip: keep the customer in a normal window and a partner in a private window, so both logins stay
          active side by side.
        </p>
        <p className="mt-3 text-sm">
          PayPal: <b>{cfg?.paypal.mode === "sandbox" ? "live sandbox" : "simulated (no keys on this server)"}</b> · AI: <b>{cfg?.ai.mode === "gemini" ? `Gemini (${cfg.ai.model})` : "simulated"}</b>
          {cfg?.paypal.demoBuyer && (
            <>
              {" "}
              · Sandbox buyer: <span className="font-mono">{cfg.paypal.demoBuyer.email}</span> / <span className="font-mono">{cfg.paypal.demoBuyer.password}</span>
            </>
          )}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">1. Open any app with one tap</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {ROLES.map((r) => (
            <Card key={r.role}>
              <CardContent className="flex h-full flex-col gap-2">
                <r.icon className="size-6 text-primary" />
                <p className="font-semibold">{r.title}</p>
                <p className="flex-1 text-xs text-muted-foreground">{r.does}</p>
                <p className="font-mono text-[11px] text-muted-foreground">{r.login}</p>
                <Button size="sm" disabled={busy !== null} onClick={() => open(r.role, r.home)}>
                  {busy === r.role ? "…" : account?.role === r.role ? `Go to ${r.title}` : `Open as ${r.title}`}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Opening another role logs this browser into that role. Partner dashboards are also in the Partners menu (top right).</p>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">2. The whole journey, step by step</h2>
        <ol className="grid gap-3 md:grid-cols-2">
          {STORY.map(([who, what, href], i) => (
            <li key={i} className="paper flex gap-3 rounded-2xl p-4">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{i + 1}</span>
              <div className="space-y-1 text-sm">
                <Badge variant="outline">{who}</Badge>
                <p>{what}</p>
                <Link href={href} className="text-xs font-semibold text-primary underline">
                  Open {href}
                </Link>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">3. Every page, and the APIs behind it</h2>
        <div className="paper overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Page</th>
                <th className="px-4 py-2.5">Who</th>
                <th className="px-4 py-2.5">What to try</th>
                <th className="px-4 py-2.5">APIs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {PAGES.map(([path, who, what, apis]) => (
                <tr key={path} className="align-top">
                  <td className="px-4 py-2.5 font-mono text-xs">{path.includes("[") ? path : <Link className="text-primary underline" href={path}>{path}</Link>}</td>
                  <td className="px-4 py-2.5 text-xs">{who}</td>
                  <td className="px-4 py-2.5">{what}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{apis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="space-y-1.5 text-sm">
            <p className="font-semibold">Coupons to try</p>
            <p>
              <b className="font-mono">FIRSTFIX</b> ₹50 off a first repair · <b className="font-mono">DIWALI25</b> ₹25 off above ₹200 · <b className="font-mono">GHARSAFAI</b> 15% off baskets
            </p>
            <p className="text-xs text-muted-foreground">Discounts come out of Sudhaar&apos;s share and go to PayPal as a discount line; karigars and Saathis are always paid in full.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1.5 text-sm">
            <p className="font-semibold">Money rules</p>
            <p className="text-xs text-muted-foreground">Karigar keeps 90% of the repair price, the Saathi 75% of the pickup fee, tips 100%. Sudhaar keeps the rest. Payment is captured only after the delivery OTP.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1.5 text-sm">
            <p className="font-semibold">Honest notes</p>
            <p className="text-xs text-muted-foreground">PayPal runs in the sandbox (USD, test money); the app shows rupees at ₹85 = $1. Karigars marked “Sample profile” are demo data. The free host sleeps when idle and resets demo data.</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
