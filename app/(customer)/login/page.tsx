"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";
import { useLang } from "@/components/LanguageProvider";
import { Card, CardContent } from "@/components/ui/card";

function Login() {
  const { t } = useLang();
  const router = useRouter();
  const next = useSearchParams().get("next");
  // Only same-site paths, so the login page can't be used to bounce people elsewhere.
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/repairs";
  return (
    <Card className="mx-auto max-w-md">
      <CardContent className="space-y-3">
        <h1 className="text-2xl font-bold">{t("loginTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("loginSub")}</p>
        <LoginForm onDone={() => router.push(target)} />
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}
