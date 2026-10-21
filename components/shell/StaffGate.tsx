"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Logo } from "../Logo";

/** Demo access code for the partner side (karigars, Saathis, admins). Shared with judges in the README. */
export const STAFF_CODE = "sudhaar2026";

/**
 * Keeps the partner apps out of the customer experience. This is a demo gate (stored in the
 * browser), not real authentication; production would use per-partner logins.
 */
export function StaffGate({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    try {
      setOk(localStorage.getItem("sudhaar.staff") === "1");
    } catch {
      setOk(false);
    }
  }, []);

  if (ok === null) return null;
  if (ok) return <>{children}</>;
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-4">
      <Logo href="/" suffix="Partners" />
      <Card>
        <CardContent className="space-y-3">
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <Lock className="size-5 text-primary" /> Partner & admin login
          </h1>
          <p className="text-sm text-muted-foreground">For karigars, Repair Saathis and the Sudhaar team. Customers don&apos;t need this.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim().toLowerCase() === STAFF_CODE) {
                try {
                  localStorage.setItem("sudhaar.staff", "1");
                } catch {}
                setOk(true);
              } else setError(true);
            }}
            className="space-y-2"
          >
            <Input placeholder="Access code" value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
            {error && <p className="text-xs text-destructive">That code isn&apos;t right.</p>}
            <Button className="w-full" type="submit">
              Sign in
            </Button>
          </form>
          <p className="text-[11px] text-muted-foreground">Judges: the demo access code is in the README and the Devpost testing notes.</p>
        </CardContent>
      </Card>
    </div>
  );
}

export function signOutStaff() {
  try {
    localStorage.removeItem("sudhaar.staff");
  } catch {}
  window.location.href = "/";
}
