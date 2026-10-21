import Link from "next/link";
import { ArrowRight, Bike, Hammer, LayoutDashboard } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const APPS = [
  { href: "/saathi", icon: Bike, title: "Repair Saathi app", who: "Local students & youth", text: "Pickups and deliveries with OTP handover. Earn 75% of every pickup fee, paid instantly by PayPal Payouts." },
  { href: "/karigar", icon: Hammer, title: "Karigar app", who: "Verified repairers", text: "Accept jobs, upload the after photo for the AI check, and get 90% of the repair charge the moment it's delivered." },
  { href: "/admin", icon: LayoutDashboard, title: "Operations dashboard", who: "Sudhaar team", text: "Every PayPal hold, capture, payout, invoice, refund and webhook, plus impact metrics, in AG Grid." },
];

export default function PartnerHub() {
  return (
    <div className="space-y-6">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold">Sudhaar partner apps</h1>
        <p className="mt-2 text-muted-foreground">
          In production these are separate apps for karigars, Saathis and the operations team. They live here so judges can play every role in one demo. Book a repair in
          the customer app, then open these in other tabs.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {APPS.map((a) => (
          <Link key={a.href} href={a.href}>
            <Card className="h-full transition hover:-translate-y-1 hover:bg-muted">
              <CardContent className="flex h-full flex-col gap-3">
                <span className="grid size-12 place-items-center rounded-2xl bg-primary/15 text-primary">
                  <a.icon className="size-6" />
                </span>
                <div>
                  <p className="text-lg font-bold">{a.title}</p>
                  <p className="text-xs font-semibold text-gold">{a.who}</p>
                </div>
                <p className="flex-1 text-sm text-muted-foreground">{a.text}</p>
                <span className="flex items-center gap-1 text-sm font-semibold text-primary">
                  Open <ArrowRight className="size-4" />
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
