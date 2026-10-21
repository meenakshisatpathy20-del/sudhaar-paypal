import { Badge } from "@/components/ui/badge";
import type { OrderEvent } from "@/lib/types";

export function EventLog({ events }: { events: OrderEvent[] }) {
  return (
    <ul className="space-y-3">
      {[...events].reverse().map((e, i) => (
        <li key={i} className="flex gap-2.5 text-sm">
          <Badge className="mt-0.5 h-fit" variant={e.kind === "paypal" ? "paypal" : e.kind === "ai" ? "default" : e.kind === "error" ? "destructive" : "outline"}>
            {e.kind === "paypal" ? "PayPal" : e.kind === "ai" ? "AI" : e.kind === "error" ? "Error" : e.actor}
          </Badge>
          <div className="min-w-0">
            <p className="leading-snug">{e.message}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(e.at).toLocaleString()}
              {e.ref && <span className="ml-2 break-all font-mono">{e.ref}</span>}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
