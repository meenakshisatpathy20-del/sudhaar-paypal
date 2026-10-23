import type { Account, Coupon, DB, Karigar, Saathi } from "./types";
import { config } from "./config";

const c = config.demoCenter;

// Offsets in km (~0.009 deg ≈ 1 km) so the demo karigars sit around the demo customer.
function at(dLatKm: number, dLngKm: number) {
  return { lat: c.lat + dLatKm * 0.009, lng: c.lng + dLngKm * 0.0093 };
}

export function seedKarigars(): Karigar[] {
  const k = config.paypal.karigarPayoutEmail;
  return [
    {
      id: "k-ramesh", name: "Ramesh Kumar", shop: "Ramesh Electricals", craft: "Appliance & wiring repair",
      skills: ["small-appliance", "electrical", "electronics"], rating: 4.8, jobsDone: 412, ...at(0.8, 0.9), area: "Market Road",
      languages: ["Hindi", "English"], priceFactor: 1.0, turnaroundDays: 1, verified: true, payoutEmail: k, avatarColor: "#0f766e", yearsExperience: 18,
      bio: "I have fixed mixers, fans and irons in this market for 18 years. Most things just need a new part, not a new machine.",
      services: [{ name: "Mixer coupler / blade", price: 4 }, { name: "Ceiling fan winding", price: 9 }, { name: "Iron thermostat", price: 3.5 }],
      reviews: [{ name: "Priya", rating: 5, text: "Mixer works like new, and it came back the next day." }, { name: "Arjun", rating: 4.5, text: "Honest price, explained what was wrong." }],
    },
    {
      id: "k-salma", name: "Salma Begum", shop: "Salma Tailoring & Bags", craft: "Tailoring, zips & bag repair",
      skills: ["bags", "clothes"], rating: 4.9, jobsDone: 655, ...at(-0.5, 0.4), area: "Old Town",
      languages: ["Urdu", "Hindi"], priceFactor: 0.95, turnaroundDays: 1, verified: true, payoutEmail: k, avatarColor: "#b45309", yearsExperience: 22,
      bio: "School bags, sarees, suitcases: if it has a zip or a seam, I can save it.",
      services: [{ name: "Bag zip replacement", price: 2.5 }, { name: "Strap re-stitching", price: 1.5 }, { name: "Saree fall & pico", price: 2 }],
      reviews: [{ name: "Meera", rating: 5, text: "Saved my daughter's school bag in one day." }, { name: "Kabir", rating: 5, text: "Neat stitching, very fair." }],
    },
    {
      id: "k-mohan", name: "Mohan Lal", shop: "Mohan Shoe Works", craft: "Cobbler, leather & soles",
      skills: ["shoes", "bags"], rating: 4.7, jobsDone: 980, ...at(0.3, -0.6), area: "Station Road",
      languages: ["Hindi"], priceFactor: 0.85, turnaroundDays: 1, verified: true, payoutEmail: k, avatarColor: "#7c3aed", yearsExperience: 30,
      bio: "My father sat at this same corner. Good leather lasts a lifetime if you look after it.",
      services: [{ name: "Sole re-pasting", price: 2 }, { name: "Full resole", price: 5 }, { name: "Heel fix", price: 1.5 }],
      reviews: [{ name: "Rohit", rating: 5, text: "My 6-year-old boots got a second life." }, { name: "Ananya", rating: 4.5, text: "Quick and cheap." }],
    },
    {
      id: "k-anil", name: "Anil Verma", shop: "Anil Home Fix", craft: "Plumbing, electrical & carpentry",
      skills: ["plumbing", "electrical", "furniture"], rating: 4.9, jobsDone: 301, ...at(-1.6, -1.1), area: "Sector 4",
      languages: ["Hindi", "English"], priceFactor: 1.15, turnaroundDays: 0, verified: true, payoutEmail: k, avatarColor: "#be123c", yearsExperience: 12,
      bio: "Same-day home visits for leaks, switches and wobbly furniture.",
      services: [{ name: "Tap / leak fix", price: 5 }, { name: "Switchboard repair", price: 4 }, { name: "Chair / table joint", price: 8 }],
      reviews: [{ name: "Sana", rating: 5, text: "Came within two hours, fixed the leak properly." }],
    },
    {
      id: "k-joseph", name: "Joseph D'Souza", shop: "Joseph Wood Craft", craft: "Furniture & woodwork",
      skills: ["furniture"], rating: 4.6, jobsDone: 214, ...at(2.4, 1.8), area: "Lake View",
      languages: ["English", "Konkani"], priceFactor: 1.05, turnaroundDays: 3, verified: true, payoutEmail: k, avatarColor: "#1d4ed8", yearsExperience: 25,
      bio: "Old wood is better wood. I restore chairs, tables and cupboards.",
      services: [{ name: "Chair re-glue & clamp", price: 9 }, { name: "Drawer runner", price: 6 }, { name: "Polish & finish", price: 15 }],
      reviews: [{ name: "Neha", rating: 4.5, text: "Grandmother's chair is solid again." }],
    },
    {
      id: "k-sunil", name: "Sunil Yadav", shop: "Sunil Repair Point", craft: "Small appliances & gadgets",
      skills: ["small-appliance", "electronics"], rating: 4.6, jobsDone: 520, ...at(1.9, -2.2), area: "College Square",
      languages: ["Hindi", "Bhojpuri"], priceFactor: 0.9, turnaroundDays: 2, verified: true, payoutEmail: k, avatarColor: "#4d7c0f", yearsExperience: 9,
      bio: "Students bring me everything: kettles, chargers, speakers.",
      services: [{ name: "Kettle element", price: 3 }, { name: "Charger repair", price: 2 }, { name: "Speaker jack", price: 3 }],
      reviews: [{ name: "Dev", rating: 4.5, text: "Fixed my speaker for less than a coffee." }],
    },
    {
      id: "k-kavita", name: "Kavita Rao", shop: "Kavita Stitch Studio", craft: "Alterations & clothes repair",
      skills: ["clothes"], rating: 4.8, jobsDone: 377, ...at(-2.8, 2.1), area: "Temple Street",
      languages: ["Kannada", "Telugu", "English"], priceFactor: 1.0, turnaroundDays: 2, verified: true, payoutEmail: k, avatarColor: "#c026d3", yearsExperience: 14,
      bio: "Alterations, darning and buttons, done with care.",
      services: [{ name: "Hem / alteration", price: 1.5 }, { name: "Tear darning", price: 2 }, { name: "Buttons & hooks", price: 1 }],
      reviews: [{ name: "Ritu", rating: 5, text: "You can't even see where the tear was." }],
    },
    {
      id: "k-imran", name: "Imran Shaikh", shop: "Imran Mobile & Gadgets", craft: "Phone & electronics repair",
      skills: ["electronics"], rating: 4.5, jobsDone: 845, ...at(3.6, -0.7), area: "Bus Stand",
      languages: ["Hindi", "Marathi"], priceFactor: 0.95, turnaroundDays: 1, verified: true, payoutEmail: k, avatarColor: "#0369a1", yearsExperience: 11,
      bio: "Screens, batteries and charging ports, mostly the same day.",
      services: [{ name: "Charging port", price: 6 }, { name: "Battery swap", price: 12 }, { name: "Screen guard + clean", price: 2 }],
      reviews: [{ name: "Faiz", rating: 4.5, text: "New battery and the phone lasts all day again." }],
    },
  ];
}

export function seedSaathis(): Saathi[] {
  const s = config.paypal.saathiPayoutEmail;
  return [
    { id: "s-vikas", name: "Vikas (college student)", rating: 4.9, payoutEmail: s, area: "Market Road", vehicle: "bicycle" },
    { id: "s-pooja", name: "Pooja (part-time)", rating: 4.8, payoutEmail: s, area: "Old Town", vehicle: "scooter" },
  ];
}

export function seedDB(): DB {
  return { karigars: seedKarigars(), saathis: seedSaathis(), quotes: [], orders: [], webhooks: [], applications: [], accounts: [], coupons: seedCoupons() };
}

/** Starter coupons. Each discount comes out of Sudhaar's share (capped by it). */
export function seedCoupons(): Coupon[] {
  const createdAt = new Date().toISOString();
  return [
    { code: "FIRSTFIX", description: "₹50 off your first repair", kind: "flat", value: 50, firstOrderOnly: true, active: true, uses: 0, createdAt },
    { code: "GHARSAFAI", description: "15% off a Ghar Safai basket (up to ₹150)", kind: "percent", value: 15, maxInr: 150, basketOnly: true, active: true, uses: 0, createdAt },
    { code: "DIWALI25", description: "₹25 off any repair above ₹200", kind: "flat", value: 25, minOrderInr: 200, active: true, uses: 0, createdAt },
  ];
}

/**
 * Shared demo logins for judges (listed in the README). Real karigars get a random PIN when
 * they are approved, and customers choose their own.
 */
export const DEMO_LOGINS = {
  customer: { phone: "9999999999", pin: "1234" },
  admin: { phone: "9000000000", pin: "2026" },
  karigarPin: "1111",
  saathiPin: "2222",
};

export function demoAccountSpecs(): Omit<Account, "pinHash" | "createdAt">[] {
  const c = config.demoCenter;
  return [
    { id: "C-DEMO", role: "customer", name: "Anita Sharma", phone: DEMO_LOGINS.customer.phone, address: "Flat 12, Lake View Apartments", lat: c.lat, lng: c.lng, demo: true },
    { id: "A-ADMIN", role: "admin", name: "Sudhaar team", phone: DEMO_LOGINS.admin.phone, demo: true },
    // Karigar logins: 9000000001, 9000000002 … in seed order; Saathi logins: 9100000001, 9100000002.
    ...seedKarigars().map((k, i) => ({ id: `K-${k.id}`, role: "karigar" as const, name: k.name, phone: `90000000${String(i + 1).padStart(2, "0")}`, karigarId: k.id, demo: true })),
    ...seedSaathis().map((s, i) => ({ id: `S-${s.id}`, role: "saathi" as const, name: s.name, phone: `91000000${String(i + 1).padStart(2, "0")}`, saathiId: s.id, demo: true })),
  ];
}

export const demoPinFor = (role: Account["role"]) =>
  role === "customer" ? DEMO_LOGINS.customer.pin : role === "admin" ? DEMO_LOGINS.admin.pin : role === "karigar" ? DEMO_LOGINS.karigarPin : DEMO_LOGINS.saathiPin;
