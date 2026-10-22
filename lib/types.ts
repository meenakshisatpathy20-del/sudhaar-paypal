export type Category =
  | "shoes"
  | "bags"
  | "clothes"
  | "small-appliance"
  | "electronics"
  | "furniture"
  | "plumbing"
  | "electrical";

export type ItemSize = "small" | "medium" | "large";

export type ServiceMode = "pickup" | "home-visit";

export interface Karigar {
  id: string;
  name: string;
  shop: string;
  skills: Category[];
  rating: number;
  jobsDone: number;
  lat: number;
  lng: number;
  area: string;
  languages: string[];
  /** Multiplier on the base repair price (0.9 = 10% cheaper than average). */
  priceFactor: number;
  /** Typical turnaround in days. */
  turnaroundDays: number;
  verified: boolean;
  /** PayPal sandbox email that receives payouts. */
  payoutEmail: string;
  avatarColor: string;
  yearsExperience: number;
  /** One line in the karigar's own words. */
  bio: string;
  craft: string;
  services: { name: string; price: number }[];
  reviews: { name: string; rating: number; text: string }[];
  /** Joined through the onboarding flow (not demo seed data). */
  onboarded?: boolean;
}

/** A karigar ("Join as a karigar") or Saathi ("Become a Repair Saathi") applying, reviewed by the Sudhaar team. */
export interface KarigarApplication {
  id: string;
  kind?: "karigar" | "saathi";
  createdAt: string;
  name: string;
  phone: string;
  shop: string;
  craft: string;
  area: string;
  skills: Category[];
  yearsExperience: number;
  languages: string[];
  bio: string;
  /** Optional: without it, sandbox payouts go to the demo karigar account. */
  payoutEmail?: string;
  /** Which ID they can show. We never store ID numbers; staff verify in person or via DigiLocker. */
  idType: "aadhaar" | "voter" | "driving" | "pan" | "none";
  status: "pending" | "approved" | "rejected";
  /** Karigars: ID, shop visit, trial repair. Saathis: ID, OTP-handover training, trial trip. */
  checks: Partial<Record<"idVerified" | "shopVisited" | "trialRepair" | "trained" | "trialTrip", boolean>>;
  karigarId?: string;
  saathiId?: string;
  decidedAt?: string;
  /** Saathi applicants only. */
  vehicle?: SaathiVehicle;
  hours?: ("mornings" | "evenings" | "weekends" | "full_day")[];
  student?: boolean;
}

export interface Saathi {
  id: string;
  name: string;
  rating: number;
  payoutEmail: string;
  /** Joined through "Become a Repair Saathi" (not demo seed data). */
  onboarded?: boolean;
  area?: string;
  vehicle?: SaathiVehicle;
}

export type SaathiVehicle = "bicycle" | "scooter" | "motorbike" | "walk";

export interface Quote {
  id: string;
  createdAt: string;
  item: string;
  category: Category;
  size: ItemSize;
  issue: string;
  repairable: boolean;
  repairLow: number;
  repairHigh: number;
  newPrice: number;
  repairDays: number;
  confidence: "low" | "medium" | "high";
  notes: string;
  photo?: string;
  description?: string;
  source: "claude" | "simulated";
}

export type OrderStatus =
  | "awaiting_payment"
  | "authorized"
  | "picked_up"
  | "at_karigar"
  | "repairing"
  | "repaired"
  | "out_for_delivery"
  | "delivered"
  | "paid_out"
  | "cancelled";

export interface OrderEvent {
  at: string;
  status?: OrderStatus;
  actor: "customer" | "saathi" | "karigar" | "system" | "agent" | "admin";
  message: string;
  /** PayPal ids / debug ids, shown on the order page so judges can verify in the sandbox. */
  ref?: string;
  kind?: "info" | "paypal" | "ai" | "error";
}

export interface PriceChange {
  jobId?: string;
  item: string;
  /** Repair price in USD before and after (pickup fee and tool fund don't change). */
  from: number;
  to: number;
  reason: string;
  status: "pending" | "awaiting_payment" | "approved" | "declined";
  requestedAt: string;
  decidedAt?: string;
  /** A price increase is held as a second PayPal authorization for just the difference. */
  topUp?: { amount: number; paypalOrderId?: string; authorizationId?: string; captureId?: string };
}

export interface PayoutLine {
  to: "karigar" | "saathi";
  /** Which karigar / Saathi was paid, for their earnings history. */
  partnerId?: string;
  /** Who received it (shop or Saathi name), for baskets paying several karigars. */
  label?: string;
  receiver: string;
  amount: number;
  status: string;
  payoutItemId?: string;
}

export interface Complaint {
  id: string;
  createdAt: string;
  issue: "repair_failed" | "damaged" | "overcharged" | "delayed" | "missing";
  details: string;
  photo?: string;
  ai?: {
    recommendation: "re_repair" | "partial_refund" | "full_refund" | "reject";
    refundAmount: number;
    reasoning: string;
    source: "claude" | "simulated";
  };
  resolution?: {
    action: "re_repair" | "refund" | "rejected";
    amount?: number;
    refundId?: string;
    at: string;
  };
}

/** The before/after photo check that gates the PayPal capture. */
export interface CompletionCheck {
  passed: boolean;
  reasoning: string;
  source: "claude" | "simulated" | "admin";
  /** True when the AI could not decide (or failed) and a Sudhaar reviewer must compare the photos. */
  needsReview?: boolean;
}

/** One item inside a Ghar Safai basket order. */
export interface Job {
  id: string;
  quoteId: string;
  item: string;
  category: Category;
  size: ItemSize;
  issue: string;
  karigarId: string;
  price: number;
  newPrice: number;
  beforePhoto?: string;
  afterPhoto?: string;
  status: "waiting" | "repairing" | "repaired";
  completionCheck?: CompletionCheck;
}

/** Family Pay: someone else (e.g. a son in another city) approves the PayPal payment. */
export interface FamilyPay {
  /** Secret in the payment link, so a relative can pay without an account but nobody can guess other orders. */
  token?: string;
  name: string;
  relation: string;
  email?: string;
  paidBy?: string;
  paidAt?: string;
}

export interface Order {
  id: string;
  /** "basket" = Ghar Safai Mode: several items, one pickup, one PayPal payment. */
  kind?: "single" | "basket";
  jobs?: Job[];
  familyPay?: FamilyPay;
  createdAt: string;
  status: OrderStatus;
  quoteId: string;
  item: string;
  category: Category;
  size: ItemSize;
  issue: string;
  mode: ServiceMode;
  karigarId: string;
  saathiId: string;
  /** The customer account that booked it; only they (and admins) can see the order. */
  customerId?: string;
  customer: { name: string; email: string; address: string; lat: number; lng: number };
  distanceKm: number;
  repairCharge: number;
  pickupFee: number;
  donation: number;
  total: number;
  currency: "USD";
  split: { karigar: number; saathi: number; platform: number; donation: number };
  pickupOtp: string;
  deliveryOtp: string;
  paypal: {
    mode: "sandbox" | "simulated";
    orderId?: string;
    authorizationId?: string;
    captureId?: string;
    payoutBatchId?: string;
    invoiceId?: string;
    invoiceUrl?: string;
    refunds: { id: string; amount: number; status: string }[];
    /** Amount the main authorization holds, and how much of it was captured. */
    heldAmount?: number;
    capturedAmount?: number;
  };
  /** The karigar's price change after inspecting the item; the customer must approve it. */
  priceChange?: PriceChange;
  beforePhoto?: string;
  afterPhoto?: string;
  completionCheck?: CompletionCheck;
  payouts: PayoutLine[];
  complaints: Complaint[];
  events: OrderEvent[];
  bookedBy: "customer" | "agent";
}

export interface DB {
  karigars: Karigar[];
  saathis: Saathi[];
  quotes: Quote[];
  orders: Order[];
  webhooks: { at: string; type: string; resource?: string; verified: boolean }[];
  applications: KarigarApplication[];
  accounts: Account[];
  /** Karigar and Saathi ids that switched themselves offline (no new jobs). */
  offline?: string[];
}

export type Role = "customer" | "karigar" | "saathi" | "admin";

/** A login. Phone + PIN; the PIN is stored only as a scrypt hash. */
export interface Account {
  id: string;
  role: Role;
  name: string;
  /** 10-digit Indian mobile number, digits only. */
  phone: string;
  pinHash: string;
  createdAt: string;
  /** Customers: where pickups happen. */
  address?: string;
  lat?: number;
  lng?: number;
  /** Partners: which karigar / Saathi profile this login runs. */
  karigarId?: string;
  saathiId?: string;
  /** Shared demo login listed for judges. */
  demo?: boolean;
}
