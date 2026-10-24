import type { ClaimActor, ClaimPriority, ClaimStatus, Complaint } from "./types";

// Resolve Hub rules shared by the server and the pages: status, priority, SLA and stages.

export const CLAIM_STATUSES: ClaimStatus[] = ["open", "in_review", "awaiting_customer", "awaiting_karigar", "resolved", "rejected", "withdrawn"];
export const CLAIM_PRIORITIES: ClaimPriority[] = ["low", "medium", "high", "critical"];
export const CLOSED: ClaimStatus[] = ["resolved", "rejected", "withdrawn"];

/** Hours the Sudhaar team has to decide, by priority. */
export const SLA_HOURS: Record<ClaimPriority, number> = { critical: 24, high: 48, medium: 72, low: 120 };

/** Starting priority from what went wrong. The team can change it. */
export const DEFAULT_PRIORITY: Record<Complaint["issue"], ClaimPriority> = {
  missing: "critical",
  damaged: "high",
  repair_failed: "medium",
  overcharged: "low",
  delayed: "low",
};

/** Status of a claim, including claims saved before statuses existed. */
export function claimStatusOf(c: Complaint): ClaimStatus {
  if (c.status) return c.status;
  if (c.resolution) return c.resolution.action === "rejected" ? "rejected" : "resolved";
  return "open";
}

export const isOpenClaim = (c: Complaint) => !CLOSED.includes(claimStatusOf(c));
export const priorityOf = (c: Complaint): ClaimPriority => c.priority ?? DEFAULT_PRIORITY[c.issue] ?? "medium";
export const slaDueOf = (c: Complaint) => c.slaDueAt ?? slaDue(c.createdAt, priorityOf(c));
export const pastSla = (c: Complaint, now = Date.now()) => isOpenClaim(c) && new Date(slaDueOf(c)).getTime() < now;

/** The stage stepper: Submitted → AI review → Investigation → Decision → Closed. */
export const CLAIM_STAGES = ["submitted", "ai_review", "investigation", "decision", "closed"] as const;
export type ClaimStage = (typeof CLAIM_STAGES)[number];

export function claimStage(c: Complaint): ClaimStage {
  const s = claimStatusOf(c);
  if (s === "withdrawn") return "closed";
  if (s === "resolved" || s === "rejected") return c.closedAt || c.resolution ? "closed" : "decision";
  if (s === "in_review" || s === "awaiting_customer" || s === "awaiting_karigar") return "investigation";
  return c.ai ? "ai_review" : "submitted";
}

export const MAX_EVIDENCE = 8;

export function slaDue(createdAt: string, priority: ClaimPriority) {
  return new Date(new Date(createdAt).getTime() + SLA_HOURS[priority] * 3600_000).toISOString();
}

export function activity(c: Complaint, by: ClaimActor, name: string, action: string, remarks?: string) {
  (c.activity ??= []).push({ at: new Date().toISOString(), by, name, action, ...(remarks ? { remarks } : {}) });
}
