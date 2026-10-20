import type { DB, Karigar, Saathi } from "./types";
import { config } from "./config";

const c = config.demoCenter;

// Offsets in degrees (~0.009 deg ≈ 1 km) so the demo karigars sit around the demo customer.
function at(dLatKm: number, dLngKm: number) {
  return { lat: c.lat + dLatKm * 0.009, lng: c.lng + dLngKm * 0.0093 };
}

export function seedKarigars(): Karigar[] {
  const k = config.paypal.karigarPayoutEmail;
  return [
    { id: "k-ramesh", name: "Ramesh Kumar", shop: "Ramesh Electricals", skills: ["small-appliance", "electrical", "electronics"], rating: 4.8, jobsDone: 412, ...at(0.8, 0.9), area: "Market Road", languages: ["Hindi", "English"], priceFactor: 1.0, turnaroundDays: 1, verified: true, payoutEmail: k, avatarColor: "#0f766e" },
    { id: "k-salma", name: "Salma Begum", shop: "Salma Tailoring & Bags", skills: ["bags", "clothes"], rating: 4.9, jobsDone: 655, ...at(-0.5, 0.4), area: "Old Town", languages: ["Urdu", "Hindi"], priceFactor: 0.95, turnaroundDays: 1, verified: true, payoutEmail: k, avatarColor: "#b45309" },
    { id: "k-mohan", name: "Mohan Lal", shop: "Mohan Shoe Works", skills: ["shoes", "bags"], rating: 4.7, jobsDone: 980, ...at(0.3, -0.6), area: "Station Road", languages: ["Hindi"], priceFactor: 0.85, turnaroundDays: 1, verified: true, payoutEmail: k, avatarColor: "#7c3aed" },
    { id: "k-anil", name: "Anil Verma", shop: "Anil Home Fix", skills: ["plumbing", "electrical", "furniture"], rating: 4.9, jobsDone: 301, ...at(-1.6, -1.1), area: "Sector 4", languages: ["Hindi", "English"], priceFactor: 1.15, turnaroundDays: 0, verified: true, payoutEmail: k, avatarColor: "#be123c" },
    { id: "k-joseph", name: "Joseph D'Souza", shop: "Joseph Wood Craft", skills: ["furniture"], rating: 4.6, jobsDone: 214, ...at(2.4, 1.8), area: "Lake View", languages: ["English", "Konkani"], priceFactor: 1.05, turnaroundDays: 3, verified: true, payoutEmail: k, avatarColor: "#1d4ed8" },
    { id: "k-sunil", name: "Sunil Yadav", shop: "Sunil Repair Point", skills: ["small-appliance", "electronics"], rating: 4.6, jobsDone: 520, ...at(1.9, -2.2), area: "College Square", languages: ["Hindi", "Bhojpuri"], priceFactor: 0.9, turnaroundDays: 2, verified: true, payoutEmail: k, avatarColor: "#4d7c0f" },
    { id: "k-kavita", name: "Kavita Rao", shop: "Kavita Stitch Studio", skills: ["clothes"], rating: 4.8, jobsDone: 377, ...at(-2.8, 2.1), area: "Temple Street", languages: ["Kannada", "Telugu", "English"], priceFactor: 1.0, turnaroundDays: 2, verified: true, payoutEmail: k, avatarColor: "#c026d3" },
    { id: "k-imran", name: "Imran Shaikh", shop: "Imran Mobile & Gadgets", skills: ["electronics"], rating: 4.5, jobsDone: 845, ...at(3.6, -0.7), area: "Bus Stand", languages: ["Hindi", "Marathi"], priceFactor: 0.95, turnaroundDays: 1, verified: true, payoutEmail: k, avatarColor: "#0369a1" },
  ];
}

export function seedSaathis(): Saathi[] {
  const s = config.paypal.saathiPayoutEmail;
  return [
    { id: "s-vikas", name: "Vikas (college student)", rating: 4.9, payoutEmail: s },
    { id: "s-pooja", name: "Pooja (part-time)", rating: 4.8, payoutEmail: s },
  ];
}

export function seedDB(): DB {
  return { karigars: seedKarigars(), saathis: seedSaathis(), quotes: [], orders: [], webhooks: [] };
}
