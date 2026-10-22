import { readDB } from "./db";
import type { Karigar, Order } from "./types";

// Ratings live on the orders they came from, and a karigar's rating, job count and reviews are
// worked out from those orders whenever the karigar is shown. Nothing is copied onto the karigar,
// so the numbers stay right across restarts and demo resets.

const RATEABLE: Order["status"][] = ["delivered", "paid_out"];

/** Karigars who worked on this order (one, or several in a Ghar Safai basket). */
export function orderKarigars(o: Order): string[] {
  return o.jobs?.length ? [...new Set(o.jobs.map((j) => j.karigarId))] : [o.karigarId];
}

export const canRate = (o: Order) => RATEABLE.includes(o.status);

/** "Anita Sharma" -> "Anita S." */
const shortName = (name: string) => {
  const [first, ...rest] = name.trim().split(/\s+/);
  return rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first;
};

/**
 * The karigar with live stats. Sample karigars start from their sample rating and job count;
 * karigars who joined through onboarding start from zero, so their first rating is real.
 * Always computed from the stored record, so calling it twice gives the same answer.
 */
export function liveStats<K extends Karigar>(k: K): K {
  const db = readDB();
  const base = db.karigars.find((x) => x.id === k.id) ?? k;
  const baseCount = base.onboarded ? 0 : base.jobsDone;
  const baseSum = base.onboarded ? 0 : base.rating * baseCount;
  let sum = baseSum;
  let count = baseCount;
  let jobs = base.jobsDone;
  const reviews: Karigar["reviews"] = [];
  for (const o of db.orders) {
    if (o.status === "paid_out" && orderKarigars(o).includes(base.id)) jobs++;
    for (const r of o.ratings ?? []) {
      if (r.karigarId !== base.id) continue;
      sum += r.stars;
      count++;
      if (r.text) reviews.push({ name: shortName(o.customer.name), rating: r.stars, text: r.text, at: r.at, verified: true });
    }
  }
  reviews.sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
  return {
    ...k,
    rating: count ? Math.round((sum / count) * 10) / 10 : 0,
    ratingCount: count,
    jobsDone: jobs,
    reviews: [...reviews, ...base.reviews],
  };
}
