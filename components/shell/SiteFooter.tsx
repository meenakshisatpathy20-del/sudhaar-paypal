"use client";

import Link from "next/link";
import { useLang } from "../LanguageProvider";
import { Logo } from "../Logo";

/** Every page in one place, so nothing (partner apps, admin, Care, the guide) is hidden. */
export function SiteFooter() {
  const { t } = useLang();
  const cols: { title: string; links: [string, string][] }[] = [
    {
      title: t("ftCustomers"),
      links: [
        ["/fix", t("getQuote")],
        ["/ghar-safai", t("ftGhar")],
        ["/agent", t("navTalk")],
        ["/care", "Sudhaar Care"],
        ["/repairs", t("navRepairs")],
      ],
    },
    {
      title: t("ftPartners"),
      links: [
        ["/partner", t("ftPartnerLogin")],
        ["/join", t("joinCta")],
        ["/join?as=saathi", t("saCta")],
      ],
    },
    {
      title: t("ftAbout"),
      links: [
        ["/guide", t("ftGuide")],
        ["https://github.com/meenakshisatpathy20-del/sudhaar-paypal", "GitHub"],
      ],
    },
  ];
  return (
    <footer className="mt-12 border-t border-border bg-card/60">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="space-y-2">
          <Logo />
          <p className="max-w-xs text-xs text-muted-foreground">{t("footerLine")}</p>
          <p className="text-xs text-muted-foreground">{t("footerCare")}</p>
        </div>
        {cols.map((c) => (
          <div key={c.title} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{c.title}</p>
            <ul className="space-y-1.5 text-sm">
              {c.links.map(([href, label]) => (
                <li key={href}>
                  {href.startsWith("http") ? (
                    <a href={href} target="_blank" rel="noreferrer" className="hover:text-primary">
                      {label}
                    </a>
                  ) : (
                    <Link href={href} className="hover:text-primary">
                      {label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </footer>
  );
}
