"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type { Order } from "@/lib/types";

export function useOrders(intervalMs = 3000) {
  const [orders, setOrders] = useState<Order[]>([]);
  const load = useCallback(() => {
    api<{ orders: Order[] }>("/api/orders").then((r) => setOrders(r.orders)).catch(() => {});
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, intervalMs);
    return () => clearInterval(t);
  }, [load, intervalMs]);
  return { orders, reload: load };
}
