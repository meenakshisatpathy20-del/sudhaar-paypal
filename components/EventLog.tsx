import type { OrderEvent } from "@/lib/types";

const KIND: Record<string, string> = {
  paypal: "bg-[#e8f0fe] text-[#003087]",
  ai: "bg-brand-light text-brand-dark",
  error: "bg-red-100 text-red-700",
  info: "bg-gray-100 text-gray-700",
};

export function EventLog({ events }: { events: OrderEvent[] }) {
  return (
    <ul className="space-y-2">
      {[...events].reverse().map((e, i) => (
        <li key={i} className="flex gap-2 text-sm">
          <span className={`pill h-fit shrink-0 ${KIND[e.kind ?? "info"]}`}>{e.kind === "paypal" ? "PayPal" : e.kind === "ai" ? "AI" : e.kind === "error" ? "Error" : e.actor}</span>
          <div className="min-w-0">
            <p>{e.message}</p>
            <p className="text-xs text-muted">
              {new Date(e.at).toLocaleString()}
              {e.ref && <span className="ml-2 break-all font-mono">{e.ref}</span>}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
