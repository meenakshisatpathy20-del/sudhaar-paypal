"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { PublicAccount } from "@/lib/auth";
import { api } from "./api";

type Ctx = { account: PublicAccount | null; loading: boolean; refresh: () => Promise<PublicAccount | null>; logout: () => Promise<void> };
const SessionContext = createContext<Ctx | null>(null);

/** Who is logged in (from the HttpOnly session cookie, via /api/me). */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<PublicAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try {
      const r = await api<{ account: PublicAccount | null }>("/api/me");
      setAccount(r.account);
      return r.account;
    } catch {
      setAccount(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);
  const logout = useCallback(async () => {
    await api("/api/auth/logout", {}).catch(() => {});
    setAccount(null);
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return <SessionContext.Provider value={{ account, loading, refresh, logout }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
