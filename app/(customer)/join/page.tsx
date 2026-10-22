"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { BadgeCheck, Bike, Clock, HandCoins, IdCard, Wallet } from "lucide-react";
import { api } from "@/components/api";
import { CATEGORY_ICON } from "@/components/CategoryIcon";
import { NeedleThread, Wrench } from "@/components/Doodles";
import { useLang } from "@/components/LanguageProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { catKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Category, KarigarApplication, SaathiVehicle } from "@/lib/types";

const SKILLS: Category[] = ["shoes", "bags", "clothes", "small-appliance", "electronics", "furniture", "plumbing", "electrical"];
const ID_TYPES: KarigarApplication["idType"][] = ["aadhaar", "voter", "driving", "pan", "none"];
const VEHICLES: SaathiVehicle[] = ["bicycle", "scooter", "motorbike", "walk"];
const HOURS = ["mornings", "evenings", "weekends", "full_day"] as const;
// Stored by their English name; shown in their own script.
const LANGUAGES: [string, string][] = [
  ["Hindi", "हिंदी"],
  ["English", "English"],
  ["Bengali", "বাংলা"],
  ["Marathi", "मराठी"],
  ["Tamil", "தமிழ்"],
  ["Telugu", "తెలుగు"],
  ["Kannada", "ಕನ್ನಡ"],
  ["Gujarati", "ગુજરાતી"],
  ["Urdu", "اردو"],
  ["Punjabi", "ਪੰਜਾਬੀ"],
  ["Malayalam", "മലയാളം"],
  ["Odia", "ଓଡ଼ିଆ"],
];

/** "Join as a karigar" or "Become a Repair Saathi": onboarding with checks done in person, never by collecting ID numbers. */
export default function JoinPage() {
  return (
    <Suspense>
      <Join />
    </Suspense>
  );
}

function Join() {
  const { t } = useLang();
  const [kind, setKind] = useState<"karigar" | "saathi">(useSearchParams().get("as") === "saathi" ? "saathi" : "karigar");
  const [vehicle, setVehicle] = useState<SaathiVehicle | null>(null);
  const [hours, setHours] = useState<string[]>([]);
  const [student, setStudent] = useState(false);
  const saathi = kind === "saathi";
  const [form, setForm] = useState({ name: "", phone: "", shop: "", craft: "", area: "", yearsExperience: "", bio: "", payoutEmail: "" });
  const [skills, setSkills] = useState<Category[]>([]);
  const [languages, setLanguages] = useState<string[]>(["Hindi"]);
  const [idType, setIdType] = useState<KarigarApplication["idType"]>("aadhaar");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const ready = form.name.trim() && form.phone.replace(/\D/g, "").length >= 10 && form.area.trim() && consent && (saathi ? vehicle && hours.length > 0 : form.shop.trim() && skills.length > 0);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ application: { id: string } }>("/api/applications", saathi ? { ...form, kind, vehicle, hours, student, languages, idType } : { ...form, kind, skills, languages, idType });
      setDone(r.application.id);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done)
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="space-y-4 py-8 text-center">
          <BadgeCheck className="mx-auto size-12 text-teal" />
          <h1 className="text-2xl font-bold">{t("joinDoneTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("joinDoneRef", { id: done })}</p>
          <div className="space-y-2 rounded-2xl bg-muted/60 p-4 text-left text-sm ring-1 ring-border">
            <p className="font-semibold">{t("joinNext")}</p>
            {[t("joinStep1"), saathi ? t("saStep2") : t("joinStep2"), saathi ? t("saStep3") : t("joinStep3")].map((s, i) => (
              <p key={s} className="flex gap-2">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{i + 1}</span> {s}
              </p>
            ))}
          </div>
          <Button asChild variant="outline">
            <Link href="/">{t("navHome")}</Link>
          </Button>
        </CardContent>
      </Card>
    );

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="mx-auto grid max-w-md grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        {(
          [
            ["karigar", t("joinAsKarigar")],
            ["saathi", t("joinAsSaathi")],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setKind(k)} className={cn("rounded-lg py-2 text-sm font-semibold", kind === k ? "bg-card shadow-sm" : "text-muted-foreground")}>
            {label}
          </button>
        ))}
      </div>
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#d8efe9] via-[#fff1dc] to-[#ffe1b8] p-5 ring-1 ring-border md:p-7">
        <Wrench className="absolute -right-1 top-2 w-20 md:right-8 md:w-28" />
        <NeedleThread className="absolute bottom-2 right-16 hidden w-24 md:block" />
        <Badge variant="gold">{saathi ? t("saJoinKicker") : t("joinKicker")}</Badge>
        <h1 className="mt-2 pr-20 text-3xl font-bold md:text-4xl">{saathi ? t("saJoinTitle") : t("joinTitle")}</h1>
        <p className="mt-1 max-w-xl pr-16 text-sm text-muted-foreground md:pr-0 md:text-base">{saathi ? t("saJoinSub") : t("joinSub")}</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {(saathi
            ? [
                [HandCoins, t("saPerk1")],
                [Clock, t("saPerk2")],
                [Wallet, t("joinPerk3")],
              ]
            : [
                [HandCoins, t("joinPerk1")],
                [Bike, t("joinPerk2")],
                [Wallet, t("joinPerk3")],
              ]
          ).map(([Icon, text]) => {
            const I = Icon as typeof HandCoins;
            return (
              <p key={text as string} className="flex items-center gap-2 rounded-2xl bg-card/80 p-2.5 text-sm font-medium ring-1 ring-border">
                <I className="size-4 shrink-0 text-primary" /> {text as string}
              </p>
            );
          })}
        </div>
      </section>

      <Card>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("joinName")}>
              <Input value={form.name} onChange={set("name")} autoComplete="name" />
            </Field>
            <Field label={t("joinPhone")}>
              <Input value={form.phone} onChange={set("phone")} inputMode="tel" autoComplete="tel" placeholder={t("joinPhonePh")} />
            </Field>
            {!saathi && (
              <Field label={t("joinShop")}>
                <Input value={form.shop} onChange={set("shop")} />
              </Field>
            )}
            <Field label={t("joinArea")}>
              <Input value={form.area} onChange={set("area")} />
            </Field>
            {!saathi && (
              <>
                <Field label={t("joinCraft")}>
                  <Input value={form.craft} onChange={set("craft")} />
                </Field>
                <Field label={t("joinYears")}>
                  <Input value={form.yearsExperience} onChange={set("yearsExperience")} inputMode="numeric" />
                </Field>
              </>
            )}
          </div>

          {saathi && (
            <>
              <Field label={t("saVehicle")}>
                <div className="flex flex-wrap gap-1.5">
                  {VEHICLES.map((v) => (
                    <Chip key={v} on={vehicle === v} onClick={() => setVehicle(v)}>
                      {t(`veh_${v}`)}
                    </Chip>
                  ))}
                </div>
              </Field>
              <Field label={t("saHours")}>
                <div className="flex flex-wrap gap-1.5">
                  {HOURS.map((h) => (
                    <Chip key={h} on={hours.includes(h)} onClick={() => setHours((x) => toggle(x, h))}>
                      {t(`hrs_${h}`)}
                    </Chip>
                  ))}
                </div>
              </Field>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-[#d9572b]" checked={student} onChange={(e) => setStudent(e.target.checked)} /> {t("saStudent")}
              </label>
            </>
          )}

          {!saathi && (
            <Field label={t("joinSkills")}>
              <div className="flex flex-wrap gap-1.5">
                {SKILLS.map((c) => {
                  const Icon = CATEGORY_ICON[c];
                  const on = skills.includes(c);
                  return (
                    <Chip key={c} on={on} onClick={() => setSkills((s) => toggle(s, c))}>
                      <Icon className="size-3.5" /> {t(catKey(c))}
                    </Chip>
                  );
                })}
              </div>
            </Field>
          )}

          <Field label={t("joinLanguages")}>
            <div className="flex flex-wrap gap-1.5">
              {LANGUAGES.map(([en, native]) => (
                <Chip key={en} on={languages.includes(en)} onClick={() => setLanguages((l) => toggle(l, en))}>
                  {native}
                </Chip>
              ))}
            </div>
          </Field>

          {!saathi && (
            <Field label={t("joinBio")}>
              <Textarea value={form.bio} onChange={set("bio")} placeholder={t("joinBioPh")} />
            </Field>
          )}

          <div className="space-y-2 rounded-2xl bg-muted/60 p-3 ring-1 ring-border">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <IdCard className="size-4 text-primary" /> {t("joinId")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ID_TYPES.map((id) => (
                <Chip key={id} on={idType === id} onClick={() => setIdType(id)}>
                  {t(`id_${id}`)}
                </Chip>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{t("joinIdNote")}</p>
          </div>

          <Field label={t("joinPaypal")}>
            <Input value={form.payoutEmail} onChange={set("payoutEmail")} inputMode="email" autoComplete="email" />
            <p className="mt-1 text-xs text-muted-foreground">{saathi ? t("saPaypalNote") : t("joinPaypalNote")}</p>
          </Field>

          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 size-4 accent-[#d9572b]" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> {saathi ? t("saConsent") : t("joinConsent")}
          </label>
          <Button size="lg" className="w-full" disabled={!ready || busy} onClick={submit}>
            {busy ? t("joinSending") : t("joinSubmit")}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition",
        on ? "bg-primary text-primary-foreground ring-primary" : "bg-card ring-border hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
