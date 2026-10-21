import crypto from "node:crypto";
import { config } from "./config";
import { readDB, updateDB } from "./db";
import { FlowError } from "./orders";
import type { Category, Karigar, KarigarApplication } from "./types";

// "Join as a karigar": repairers apply, the Sudhaar team checks ID, visits the shop and
// gives a trial repair, and only then does the karigar become bookable. Ratings start
// empty ("New") instead of being made up.

const SKILLS: Category[] = ["shoes", "bags", "clothes", "small-appliance", "electronics", "furniture", "plumbing", "electrical"];
const ID_TYPES: KarigarApplication["idType"][] = ["aadhaar", "voter", "driving", "pan", "none"];
const COLORS = ["#0f766e", "#b45309", "#7c3aed", "#be123c", "#1d4ed8", "#a16207", "#047857", "#c2410c"];
const CHECKS = ["idVerified", "shopVisited", "trialRepair"] as const;
export type CheckKey = (typeof CHECKS)[number];

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function submitApplication(input: Record<string, unknown>): Promise<KarigarApplication> {
  const name = clean(input.name, 60);
  const phone = clean(input.phone, 20).replace(/[^\d+ ]/g, "");
  const shop = clean(input.shop, 60);
  const area = clean(input.area, 60);
  const skills = (Array.isArray(input.skills) ? input.skills : []).filter((s): s is Category => SKILLS.includes(s as Category));
  if (!name || !shop || !area) throw new FlowError("Please fill in your name, shop name and area");
  if (phone.replace(/\D/g, "").length < 10) throw new FlowError("Please enter a 10-digit mobile number");
  if (skills.length === 0) throw new FlowError("Pick at least one thing you repair");
  const payoutEmail = clean(input.payoutEmail, 120);
  if (payoutEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payoutEmail)) throw new FlowError("That PayPal email doesn't look right");
  const idType = ID_TYPES.includes(input.idType as KarigarApplication["idType"]) ? (input.idType as KarigarApplication["idType"]) : "none";

  const app: KarigarApplication = {
    id: `APP${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
    createdAt: new Date().toISOString(),
    name,
    phone,
    shop,
    craft: clean(input.craft, 80) || skills.join(", "),
    area,
    skills,
    yearsExperience: Math.min(60, Math.max(0, Math.round(Number(input.yearsExperience) || 0))),
    languages: (Array.isArray(input.languages) ? input.languages : []).map((l) => clean(l, 20)).filter(Boolean).slice(0, 6),
    bio: clean(input.bio, 240),
    payoutEmail: payoutEmail || undefined,
    idType,
    status: "pending",
    checks: { idVerified: false, shopVisited: false, trialRepair: false },
  };
  await updateDB((db) => {
    db.applications.push(app);
  });
  return app;
}

export async function setCheck(appId: string, check: CheckKey, value: boolean) {
  if (!CHECKS.includes(check)) throw new FlowError("Unknown check");
  return updateDB((db) => {
    const app = pending(db.applications, appId);
    app.checks[check] = value;
    return app;
  });
}

export async function decide(appId: string, approve: boolean) {
  return updateDB((db) => {
    const app = pending(db.applications, appId);
    app.decidedAt = new Date().toISOString();
    if (!approve) {
      app.status = "rejected";
      return app;
    }
    if (!CHECKS.every((c) => app.checks[c])) throw new FlowError("Finish all three KYC checks before approving");
    const karigar = toKarigar(app, db.karigars.length);
    db.karigars.push(karigar);
    app.status = "approved";
    app.karigarId = karigar.id;
    return app;
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
