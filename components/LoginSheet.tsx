"use client";

import { LoginForm } from "./LoginForm";
import { useLang } from "./LanguageProvider";
import { useSession } from "./SessionProvider";
import { Card, CardContent } from "./ui/card";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "./ui/sheet";

/** Log in without leaving the page, so a quote or basket isn't lost. */
export function LoginSheet({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const { t } = useLang();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetTitle>{t("loginTitle")}</SheetTitle>
        <SheetDescription>{t("loginSub")}</SheetDescription>
        <LoginForm
          onDone={() => {
            onOpenChange(false);
            onDone();
          }}
        />
      </SheetContent>
    </Sheet>
  );
}

/** Wraps a page that needs a logged-in customer (or one of the allowed roles). */
export function RequireLogin({ children, roles = ["customer"] }: { children: React.ReactNode; roles?: string[] }) {
  return <Gate roles={roles}>{children}</Gate>;
}

function Gate({ children, roles }: { children: React.ReactNode; roles: string[] }) {
  const { account, loading } = useSession();
  const { t } = useLang();
  if (loading) return <Card className="h-48 animate-pulse" />;
  if (account && roles.includes(account.role)) return <>{children}</>;
  return (
    <Card className="mx-auto max-w-md">
      <CardContent className="space-y-3">
        <h1 className="text-xl font-bold">{t("loginTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("needLogin")}</p>
        <LoginForm />
      </CardContent>
    </Card>
  );
}
