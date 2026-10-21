"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type { Order } from "@/lib/types";

export type KarigarBrief = { name: string; shop: string; avatarColor: string; area: string };

/** The signed-in account's orders (the API decides which ones), refreshed every few seconds. */
export function useOrders(intervalMs = 3000) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [karigars, setKarigars] = useState<Record<string, KarigarBrief>>({});
  const load = useCallback(() => {
    api<{ orders: Order[]; karigars: Record<string, KarigarBrief> }>("/api/orders")
      .then((r) => {
        setOrders(r.orders);
        setKarigars(r.karigars);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, intervalMs);
    return () => clearInterval(t);
  }, [load, intervalMs]);
  return { orders, karigars, reload: load };
}
