import crypto from "node:crypto";
import { config } from "./config";
import { readDB, updateDB } from "./db";
import { FlowError } from "./orders";
import { hashPin } from "./pin";
import type { Category, Karigar, KarigarApplication, Saathi, SaathiVehicle } from "./types";

// "Join as a karigar" and "Become a Repair Saathi": people apply, the Sudhaar team runs the
// checks in person (karigars: ID, shop visit, trial repair; Saathis: ID, OTP-handover training,
// trial trip), and only then do they get work and a login. Ratings start empty ("New").

const SKILLS: Category[] = ["shoes", "bags", "clothes", "small-appliance", "electronics", "furniture", "plumbing", "electrical"];
const ID_TYPES: KarigarApplication["idType"][] = ["aadhaar", "voter", "driving", "pan", "none"];
const COLORS = ["#0f766e", "#b45309", "#7c3aed", "#be123c", "#1d4ed8", "#a16207", "#047857", "#c2410c"];
export const CHECKS_FOR = { karigar: ["idVerified", "shopVisited", "trialRepair"], saathi: ["idVerified", "trained", "trialTrip"] } as const;
export type CheckKey = (typeof CHECKS_FOR)["karigar" | "saathi"][number];
const VEHICLES: SaathiVehicle[] = ["bicycle", "scooter", "motorbike", "walk"];
const HOURS = ["mornings", "evenings", "weekends", "full_day"] as const;
const kindOf = (app: KarigarApplication) => app.kind ?? "karigar";

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function submitApplication(input: Record<string, unknown>): Promise<KarigarApplication> {
  const kind = input.kind === "saathi" ? "saathi" : "karigar";
  const name = clean(input.name, 60);
  const phone = clean(input.phone, 20).replace(/[^\d+ ]/g, "");
  const shop = kind === "karigar" ? clean(input.shop, 60) : "";
  const area = clean(input.area, 60);
  const skills = kind === "karigar" ? (Array.isArray(input.skills) ? input.skills : []).filter((s): s is Category => SKILLS.includes(s as Category)) : [];
  const vehicle = VEHICLES.includes(input.vehicle as SaathiVehicle) ? (input.vehicle as SaathiVehicle) : undefined;
  const hours = (Array.isArray(input.hours) ? input.hours : []).filter((h): h is (typeof HOURS)[number] => HOURS.includes(h));
  if (!name || !area || (kind === "karigar" && !shop)) throw new FlowError(kind === "karigar" ? "Please fill in your name, shop name and area" : "Please fill in your name and area");
  if (phone.replace(/\D/g, "").length < 10) throw new FlowError("Please enter a 10-digit mobile number");
  if (kind === "karigar" && skills.length === 0) throw new FlowError("Pick at least one thing you repair");
  if (kind === "saathi" && !vehicle) throw new FlowError("How will you travel?");
  if (kind === "saathi" && hours.length === 0) throw new FlowError("Pick when you're free");
  const payoutEmail = clean(input.payoutEmail, 120);
  if (payoutEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payoutEmail)) throw new FlowError("That PayPal email doesn't look right");
  const idType = ID_TYPES.includes(input.idType as KarigarApplication["idType"]) ? (input.idType as KarigarApplication["idType"]) : "none";

  const app: KarigarApplication = {
    id: `APP${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
    kind,
    createdAt: new Date().toISOString(),
    name,
    phone,
    shop,
    craft: kind === "saathi" ? "Repair Saathi" : clean(input.craft, 80) || skills.join(", "),
    area,
    skills,
    yearsExperience: Math.min(60, Math.max(0, Math.round(Number(input.yearsExperience) || 0))),
    languages: (Array.isArray(input.languages) ? input.languages : []).map((l) => clean(l, 20)).filter(Boolean).slice(0, 6),
    bio: clean(input.bio, 240),
    payoutEmail: payoutEmail || undefined,
    idType,
    status: "pending",
    checks: Object.fromEntries(CHECKS_FOR[kind].map((c) => [c, false])),
    ...(kind === "saathi" ? { vehicle, hours, student: Boolean(input.student) } : {}),
  };
  await updateDB((db) => {
    db.applications.push(app);
  });
  return app;
}

export async function setCheck(appId: string, check: CheckKey, value: boolean) {
  return updateDB((db) => {
    const app = pending(db.applications, appId);
    if (!(CHECKS_FOR[kindOf(app)] as readonly string[]).includes(check)) throw new FlowError("Unknown check");
    app.checks[check] = value;
    return { application: app };
  });
}

/**
 * Approving creates the karigar profile and their login. The PIN is returned once so the
 * team can hand it over in person; only its hash is stored.
 */
export async function decide(appId: string, approve: boolean, pin?: string): Promise<{ application: KarigarApplication; pin?: string }> {
  const pinHash = pin ? hashPin(pin) : undefined;
  return updateDB((db) => {
    const app = pending(db.applications, appId);
    app.decidedAt = new Date().toISOString();
    if (!approve) {
      app.status = "rejected";
      return { application: app };
    }
    if (!CHECKS_FOR[kindOf(app)].every((c) => app.checks[c])) throw new FlowError("Finish all three checks before approving");
    if (!pin || !pinHash) throw new FlowError("A login PIN is needed to approve");
    const phone = app.phone.replace(/\D/g, "").slice(-10);
    if (db.accounts.some((a) => a.phone === phone && a.role !== "customer")) throw new FlowError("This phone number already has a partner login");
    if (kindOf(app) === "saathi") {
      const saathi: Saathi = {
        id: `s-${app.id.toLowerCase()}`,
        name: app.name,
        rating: 0,
        payoutEmail: app.payoutEmail ?? config.paypal.saathiPayoutEmail,
        onboarded: true,
        area: app.area,
        vehicle: app.vehicle,
      };
      db.saathis.push(saathi);
      db.accounts.push({ id: `S-${saathi.id}`, role: "saathi", name: app.name, phone, pinHash, createdAt: new Date().toISOString(), saathiId: saathi.id });
      app.status = "approved";
      app.saathiId = saathi.id;
      return { application: app, pin };
    }
    const karigar = toKarigar(app, db.karigars.length);
    db.karigars.push(karigar);
    db.accounts.push({ id: `K-${karigar.id}`, role: "karigar", name: app.name, phone, pinHash, createdAt: new Date().toISOString(), karigarId: karigar.id });
    app.status = "approved";
    app.karigarId = karigar.id;
    return { application: app, pin };
  });
}

function pending(apps: KarigarApplication[], appId: string) {
  const app = apps.find((a) => a.id === appId);
  if (!app) throw new FlowError("Application not found", 404);
  if (app.status !== "pending") throw new FlowError(`This application was already ${app.status}`);
  return app;
}

function toKarigar(app: KarigarApplication, n: number): Karigar {
  // The real shop pin is captured during the shop visit; the demo places it near the
  // neighbourhood centre, at a stable spot derived from the application id.
  const h = crypto.createHash("sha256").update(app.id).digest();
  const angle = (h[0] / 255) * 2 * Math.PI;
  const km = 0.6 + (h[1] / 255) * 1.8;
  const c = config.demoCenter;
  return {
    id: `k-${app.id.toLowerCase()}`,
    name: app.name,
    shop: app.shop,
    craft: app.craft,
    skills: app.skills,
    rating: 0,
    jobsDone: 0,
    lat: c.lat + Math.sin(angle) * km * 0.009,
    lng: c.lng + Math.cos(angle) * km * 0.0093,
    area: app.area,
    languages: app.languages.length ? app.languages : ["Hindi"],
    priceFactor: 1,
    turnaroundDays: 2,
    verified: true,
    payoutEmail: app.payoutEmail ?? config.paypal.karigarPayoutEmail,
    avatarColor: COLORS[n % COLORS.length],
    yearsExperience: app.yearsExperience,
    bio: app.bio || `${app.craft} in ${app.area}.`,
    services: [],
    reviews: [],
    onboarded: true,
  };
}

export const listApplications = () => readDB().applications;
