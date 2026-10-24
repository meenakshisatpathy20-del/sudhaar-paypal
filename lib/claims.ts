import crypto from "node:crypto";
import { canView } from "./access";
import { activity, CLAIM_PRIORITIES, claimStatusOf, isOpenClaim, MAX_EVIDENCE, priorityOf, slaDue, slaDueOf } from "./claims-shared";
import { readDB, updateDB } from "./db";
import { FlowError, resolveComplaint } from "./orders";
import { orderFor } from "./privacy";
import { warrantyDaysLeft } from "./warranty";
import type { Account, ClaimPriority, ClaimStatus, Complaint, DB, Notification, Order } from "./types";

// Resolve Hub, the claim desk: conversation, evidence, status, assignment and notifications.
// Raising a claim and the money decision (PayPal refund) live in orders.ts.

const now = () => new Date().toISOString();
const rid = () => crypto.randomBytes(4).toString("hex");

/** Everyone on the order who should hear about a claim, except the person who acted. */
function audience(db: DB, o: Order, who: { customer?: boolean; karigar?: boolean; admin?: boolean }, except?: string) {
  const ids = new Set<string>();
  if (who.customer && o.customerId) ids.add(o.customerId);
  for (const a of db.accounts) {
    if (who.admin && a.role === "admin") ids.add(a.id);
    if (who.karigar && a.role === "karigar" && a.karigarId && (o.karigarId === a.karigarId || o.jobs?.some((j) => j.karigarId === a.karigarId))) ids.add(a.id);
  }
  if (except) ids.delete(except);
  return [...ids];
}

export function notify(db: DB, accountIds: string[], key: string, params: Record<string, string>, href: string) {
  db.notifications ??= [];
  for (const accountId of accountIds) db.notifications.unshift({ id: rid(), accountId, at: now(), key, params, href });
  // Keep the file small: the newest 60 per account is plenty for a bell.
  const seen = new Map<string, number>();
  db.notifications = db.notifications.filter((n) => {
    const k = (seen.get(n.accountId) ?? 0) + 1;
    seen.set(n.accountId, k);
    return k <= 60;
  });
}

export const claimHref = (c: Complaint) => `/resolve/${c.id}`;

/** Tell the team (and the karigar) about a new claim. Called after raiseComplaint. */
export async function announceClaim(orderId: string, claimIdValue: string) {
  await updateDB((db) => {
    const o = db.orders.find((x) => x.id === orderId);
    const c = o?.complaints.find((x) => x.id === claimIdValue);
    if (!o || !c) return;
    notify(db, audience(db, o, { admin: true, karigar: true }), "nClaimNew", { claim: c.id, item: o.item }, claimHref(c));
  });
}

/** Tell the customer and karigar the outcome. Called after resolveComplaint. */
export async function announceDecision(orderId: string, claimIdValue: string, byId?: string) {
  await updateDB((db) => {
    const o = db.orders.find((x) => x.id === orderId);
    const c = o?.complaints.find((x) => x.id === claimIdValue);
    if (!o || !c) return;
    notify(db, audience(db, o, { customer: true, karigar: true, admin: true }, byId), "nClaimStatus", { claim: c.id, status: claimStatusOf(c) }, claimHref(c));
  });
}

// ---------- Reading ----------

function canSeeClaim(a: Account, o: Order) {
  if (a.role === "saathi") return false;
  return canView(a, o);
}

/** A claim as this account may see it: internal team notes are only for admins. */
export function claimFor(a: Account, c: Complaint): Complaint {
  const status = claimStatusOf(c);
  const base: Complaint = {
    ...c,
    status,
    priority: priorityOf(c),
    slaDueAt: slaDueOf(c),
    evidence: [...(c.photo && !c.evidence?.some((e) => e.url === c.photo) ? [{ url: c.photo, at: c.createdAt, by: "customer" as const, name: "Customer" }] : []), ...(c.evidence ?? [])],
    thread: c.thread ?? [],
    activity: c.activity ?? [],
  };
  if (a.role === "admin") return base;
  return { ...base, thread: base.thread!.filter((m) => !m.internal) };
}

export interface ClaimRow {
  claim: Complaint;
  order: Order;
}

export function listClaims(a: Account): ClaimRow[] {
  const db = readDB();
  return db.orders
    .filter((o) => o.complaints.length && canSeeClaim(a, o))
    .flatMap((o) => o.complaints.map((c) => ({ claim: claimFor(a, c), order: orderFor(a, o) })))
    .sort((x, y) => y.claim.createdAt.localeCompare(x.claim.createdAt));
}

function locate(db: DB, id: string) {
  for (const o of db.orders) {
    const c = o.complaints.find((x) => x.id === id);
    if (c) return { o, c };
  }
  return null;
}

export function getClaim(a: Account, id: string) {
  const db = readDB();
  const hit = locate(db, id);
  if (!hit || !canSeeClaim(a, hit.o)) throw new FlowError("Claim not found", 404);
  const team = a.role === "admin" ? db.accounts.filter((x) => x.role === "admin").map((x) => ({ id: x.id, name: x.name })) : undefined;
  return { claim: claimFor(a, hit.c), order: orderFor(a, hit.o), team, warrantyDaysLeft: warrantyDaysLeft(hit.o) };
}

// ---------- Acting ----------

export type ClaimAction =
  | { action: "comment"; text?: unknown; internal?: unknown }
  | { action: "evidence"; url?: unknown; caption?: unknown }
  | { action: "withdraw"; remarks?: unknown }
  | { action: "status"; status?: unknown; remarks?: unknown }
  | { action: "assign"; to?: unknown }
  | { action: "priority"; priority?: unknown; remarks?: unknown }
  | { action: "decide"; decision?: unknown; amount?: unknown; remarks?: unknown }
  | { action: "reopen"; remarks?: unknown };

const text = (v: unknown, max = 1000) => String(v ?? "").trim().slice(0, max);
const STAFF_STATUSES: ClaimStatus[] = ["in_review", "awaiting_customer", "awaiting_karigar"];
const roleName = (a: Account) => (a.role === "admin" ? (/sudhaar/i.test(a.name) ? a.name : `${a.name} (Sudhaar team)`) : a.role === "karigar" ? `${a.name} (karigar)` : a.name);

export async function actOnClaim(a: Account, id: string, input: ClaimAction) {
  // The PayPal refund runs inside resolveComplaint, which has its own DB transaction.
  if (input.action === "decide") {
    if (a.role !== "admin") throw new FlowError("Only the Sudhaar team decides claims.", 403);
    const hit = locate(readDB(), id);
    if (!hit) throw new FlowError("Claim not found", 404);
    if (!isOpenClaim(hit.c)) throw new FlowError("This claim is already closed.");
    const decision = input.decision;
    if (decision !== "refund" && decision !== "re_repair" && decision !== "rejected") throw new FlowError("Pick a decision");
    const remarks = text(input.remarks, 500);
    if (decision === "rejected" && remarks.length < 5) throw new FlowError("Tell the customer why the claim is closed.");
    await resolveComplaint(hit.o.id, id, { action: decision, amount: Number(input.amount) || undefined, remarks, by: a });
    return getClaim(a, id);
  }

  await updateDB((db) => {
    const hit = locate(db, id);
    if (!hit || !canSeeClaim(a, hit.o)) throw new FlowError("Claim not found", 404);
    const { o, c } = hit;
    const status = claimStatusOf(c);
    const open = isOpenClaim(c);
    const staff = a.role === "admin";
    const href = claimHref(c);
    const toOthers = (key: string, params: Record<string, string>, who = { customer: true, karigar: true, admin: true }) =>
      notify(db, audience(db, o, who, a.id), key, { claim: c.id, ...params }, href);
    c.status = status;

    switch (input.action) {
      case "comment": {
        const msg = text(input.text);
        if (msg.length < 2) throw new FlowError("Write a message first.");
        const internal = staff && input.internal === true;
        if (!open && !staff) throw new FlowError("This claim is closed. Raise a new claim if the problem is back.");
        (c.thread ??= []).push({ id: rid(), at: now(), by: a.role, name: roleName(a), text: msg, ...(internal ? { internal: true } : {}) });
        if (internal) {
          activity(c, a.role, a.name, "Internal note added");
          break;
        }
        // A reply from the person the team was waiting on puts the claim back in review.
        if ((status === "awaiting_customer" && a.role === "customer") || (status === "awaiting_karigar" && a.role === "karigar")) {
          c.status = "in_review";
          activity(c, a.role, a.name, `Replied; status set to in review`);
        } else activity(c, a.role, a.name, "Message sent");
        toOthers("nClaimMessage", { name: a.name.split(" ")[0] });
        break;
      }
      case "evidence": {
        if (a.role === "admin") throw new FlowError("Evidence comes from the customer or the karigar.", 403);
        if (!open) throw new FlowError("This claim is closed.");
        const url = text(input.url, 120);
        if (!/^[\w-]+\.(jpg|jpeg|png|webp)$/i.test(url)) throw new FlowError("Upload a photo first.");
        const count = (c.evidence?.length ?? 0) + (c.photo && !c.evidence?.some((e) => e.url === c.photo) ? 1 : 0);
        if (count >= MAX_EVIDENCE) throw new FlowError(`A claim can hold up to ${MAX_EVIDENCE} photos.`);
        (c.evidence ??= []).push({ url, at: now(), by: a.role, name: a.name, ...(text(input.caption, 120) ? { caption: text(input.caption, 120) } : {}) });
        activity(c, a.role, a.name, "Photo evidence added", text(input.caption, 120) || undefined);
        if (status === "awaiting_customer" && a.role === "customer") c.status = "in_review";
        if (status === "awaiting_karigar" && a.role === "karigar") c.status = "in_review";
        toOthers("nClaimEvidence", { name: a.name.split(" ")[0] });
        break;
      }
      case "withdraw": {
        if (a.role !== "customer") throw new FlowError("Only the customer can withdraw a claim.", 403);
        if (!open) throw new FlowError("This claim is already closed.");
        c.status = "withdrawn";
        c.closedAt = now();
        activity(c, a.role, a.name, "Claim withdrawn by the customer", text(input.remarks, 300) || undefined);
        o.events.push({ at: now(), actor: "customer", message: `Resolve Hub claim ${c.id} withdrawn.` });
        toOthers("nClaimStatus", { status: "withdrawn" }, { customer: false, karigar: true, admin: true });
        break;
      }
      case "status": {
        if (!staff) throw new FlowError("Only the Sudhaar team changes the status.", 403);
        if (!open) throw new FlowError("Reopen the claim first.");
        const next = input.status as ClaimStatus;
        if (!STAFF_STATUSES.includes(next)) throw new FlowError("Pick a status");
        if (next === status) break;
        c.status = next;
        const remarks = text(input.remarks, 500);
        activity(c, a.role, a.name, `Status changed to ${next.replaceAll("_", " ")}`, remarks || undefined);
        if (remarks) (c.thread ??= []).push({ id: rid(), at: now(), by: "admin", name: roleName(a), text: remarks });
        toOthers("nClaimStatus", { status: next }, { customer: true, karigar: next === "awaiting_karigar", admin: true });
        break;
      }
      case "assign": {
        if (!staff) throw new FlowError("Only the Sudhaar team assigns claims.", 403);
        const to = input.to === "me" ? a : db.accounts.find((x) => x.id === input.to && x.role === "admin");
        if (input.to === "" || input.to === null) {
          c.assignedTo = undefined;
          activity(c, a.role, a.name, "Unassigned");
          break;
        }
        if (!to) throw new FlowError("Pick a team member");
        c.assignedTo = { id: to.id, name: to.name };
        if (status === "open") c.status = "in_review";
        activity(c, a.role, a.name, `Assigned to ${to.name}`);
        if (to.id !== a.id) notify(db, [to.id], "nClaimAssigned", { claim: c.id, item: o.item }, href);
        break;
      }
      case "priority": {
        if (!staff) throw new FlowError("Only the Sudhaar team sets priority.", 403);
        const p = input.priority as ClaimPriority;
        if (!CLAIM_PRIORITIES.includes(p)) throw new FlowError("Pick a priority");
        if (p === priorityOf(c)) break;
        c.priority = p;
        c.slaDueAt = slaDue(c.createdAt, p);
        activity(c, a.role, a.name, `Priority set to ${p}`, text(input.remarks, 300) || undefined);
        break;
      }
      case "reopen": {
        if (!staff) throw new FlowError("Only the Sudhaar team can reopen a claim.", 403);
        if (open) throw new FlowError("This claim is already open.");
        if (c.resolution?.action === "refund") throw new FlowError("A refunded claim can't be reopened. The customer can raise a new one.");
        if (o.complaints.some((x) => x.id !== c.id && isOpenClaim(x))) throw new FlowError("This repair already has another open claim.");
        const remarks = text(input.remarks, 500);
        if (remarks.length < 5) throw new FlowError("Say why the claim is reopened.");
        c.status = "in_review";
        c.resolution = undefined;
        c.closedAt = undefined;
        c.slaDueAt = slaDue(now(), priorityOf(c));
        activity(c, a.role, a.name, "Claim reopened", remarks);
        (c.thread ??= []).push({ id: rid(), at: now(), by: "admin", name: roleName(a), text: remarks });
        toOthers("nClaimStatus", { status: "in_review" });
        break;
      }
      default:
        throw new FlowError("Unknown action");
    }
  });
  return getClaim(a, id);
}

// ---------- Notifications ----------

export function notificationsFor(a: Account): { items: Notification[]; unread: number } {
  const items = (readDB().notifications ?? []).filter((n) => n.accountId === a.id).slice(0, 30);
  return { items, unread: items.filter((n) => !n.read).length };
}

export async function markRead(a: Account, ids?: string[]) {
  await updateDB((db) => {
    for (const n of db.notifications ?? []) if (n.accountId === a.id && (!ids || ids.includes(n.id))) n.read = true;
  });
}

/** Admin report: volume, resolution rate, speed, SLA and refunds. */
export function claimReport(rows: ClaimRow[]) {
  const claims = rows.map((r) => r.claim);
  const closed = claims.filter((c) => !isOpenClaim(c));
  const decided = closed.filter((c) => c.closedAt);
  const hours = decided.map((c) => (new Date(c.closedAt!).getTime() - new Date(c.createdAt).getTime()) / 3600_000);
  const byIssue: Record<string, number> = {};
  for (const c of claims) byIssue[c.issue] = (byIssue[c.issue] ?? 0) + 1;
  return {
    total: claims.length,
    open: claims.length - closed.length,
    resolved: claims.filter((c) => claimStatusOf(c) === "resolved").length,
    rejected: claims.filter((c) => claimStatusOf(c) === "rejected").length,
    withdrawn: claims.filter((c) => claimStatusOf(c) === "withdrawn").length,
    pastSla: claims.filter((c) => isOpenClaim(c) && new Date(slaDueOf(c)).getTime() < Date.now()).length,
    avgHours: hours.length ? Math.round((hours.reduce((s, h) => s + h, 0) / hours.length) * 10) / 10 : null,
    refunded: Math.round(claims.reduce((s, c) => s + (c.resolution?.action === "refund" ? (c.resolution.amount ?? 0) : 0), 0) * 100) / 100,
    byIssue,
  };
}
