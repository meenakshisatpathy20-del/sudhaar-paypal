"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type { Order } from "@/lib/types";

export type KarigarBrief = { name: string; shop: string; avatarColor: string; area: string };
export type TripStops = Record<string, { home: { lat: number; lng: number }; shops: { id: string; shop: string; lat: number; lng: number }[] }>;

/** The signed-in account's orders (the API decides which ones), refreshed every few seconds. */
export function useOrders(intervalMs = 3000) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [karigars, setKarigars] = useState<Record<string, KarigarBrief>>({});
  const [stops, setStops] = useState<TripStops>({});
  const load = useCallback(() => {
    api<{ orders: Order[]; karigars: Record<string, KarigarBrief>; stops?: TripStops }>("/api/orders")
      .then((r) => {
        setOrders(r.orders);
        setKarigars(r.karigars);
        if (r.stops) setStops(r.stops);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, intervalMs);
    return () => clearInterval(t);
  }, [load, intervalMs]);
  return { orders, karigars, stops, reload: load };
}
