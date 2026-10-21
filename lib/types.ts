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
}

export interface Saathi {
  id: string;
  name: string;
  rating: number;
  payoutEmail: string;
}

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

export interface PayoutLine {
  to: "karigar" | "saathi";
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
  completionCheck?: { passed: boolean; reasoning: string; source: "claude" | "simulated" };
}

/** Family Pay: someone else (e.g. a son in another city) approves the PayPal payment. */
export interface FamilyPay {
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
  };
  beforePhoto?: string;
  afterPhoto?: string;
  completionCheck?: { passed: boolean; reasoning: string; source: "claude" | "simulated" };
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
}
