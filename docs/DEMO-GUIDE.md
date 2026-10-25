# Sudhaar demo guide

A walkthrough of every page and feature, written for judges and first-time visitors. The same guide is inside the app at **`/guide`**, with one-tap logins for each role.

Sudhaar is **one website** with four roles. Customers use Home, My Repairs, Resolve Hub, Talk and Care. The karigar, Saathi and admin dashboards are on the same site behind a partner login (the **Partners** menu at the top right, or `/partner`):

| App | Who | Where | Demo login (phone / PIN) |
|---|---|---|---|
| Customer app | People who want something repaired | `/` | 9999999999 / 1234, or **Try the demo account** |
| Saathi app | Repair Saathis who pick up and deliver | `/saathi` via `/partner` | 9100000001 / 2222, or the **Saathi** button |
| Karigar app | Karigars who do the repair | `/karigar` via `/partner` | 9000000003 / 1111, or the **Karigar** button |
| Admin console | The Sudhaar team | `/admin` via `/partner` | 9000000000 / 2026, or the **Admin** button |

**Tip:** keep the customer in a normal browser window and open the partner apps in a private window, so both logins stay active side by side. The **Saathi** and **Karigar** demo buttons open whoever is working on the most recent booking.

**PayPal** runs in the **sandbox** (test money, USD). The app shows rupees at ₹85 = $1, with the exact USD amount under every total. Pay with the sandbox buyer account shown under the PayPal button. **AI** is Google **Gemini**.

---

## The whole journey in 8 steps (about 5 minutes)

1. **Customer, get a quote.** Open **Get AI quote** (`/fix`). Add a photo or type “mixer jar blade is loose”, pick *Mixer & fan*, then **Get AI quote**. Gemini returns the item, the damage, a repair price range and the price of buying new. The fix-or-replace meter shows the saving.
2. **Customer, book.** **Choose your karigar.** On desktop the list and the map sit side by side, ranked by price, distance, rating and ready time. Next, on the bill:
   - tap the coupon **FIRSTFIX**;
   - pick a pickup time;
   - optionally tick **Someone else pays** (Family Pay);
   - press **Book & pay with PayPal** and approve with the sandbox buyer.

   The order now reads **Paid · on hold**: PayPal has *authorized* the money but not taken it.
3. **Customer, order page.** You'll see the pickup and delivery OTPs, the bill with the coupon line, the PayPal ids and the map. **Copy link** under the map gives the public tracking page (`/track/…`).
4. **Saathi, ride and pick up.** In a private window, open **Partner login → Saathi**.
   - **Demo ride** moves the Saathi's dot towards the customer. The customer's order page and the tracking link show it live with an ETA.
   - The **Route map** tab numbers the day's stops.
   - Ask the customer for the **pickup OTP**, enter it, then press **Handed to karigar**.
5. **Karigar, repair.** Open **Partner login → Karigar**. The job board groups work by stage. Press **Inspect & start repair**.
   - Optionally use **Change price after inspection**. The customer approves it, and the extra is held as a second PayPal authorization.
   - Upload an after photo and press **Mark repaired**. Gemini compares the before and after photos; a photo the AI can't pass goes to a person, and the money stays held.
6. **Saathi, deliver.** Press **Collect from karigar** and enter the **delivery OTP**. PayPal then:
   - captures the payment;
   - pays the karigar 90% of the repair and the Saathi 75% of the pickup fee (Payouts);
   - issues a paid invoice (Invoicing).
7. **Customer, after delivery.**
   - **Item passport**: money saved and kg kept out of landfill.
   - **Rate** the karigar, and send a **₹20–100 tip** through PayPal; all of it goes to the karigar.
   - **Book again** starts a new quote with the same karigar.
   - **Resolve Hub** (top menu): pick the repair and raise a claim in 3 steps (what went wrong → details and photos → review). The claim page shows the claim id, priority and decision deadline, the stage stepper, Gemini's suggestion, a conversation with the team and the karigar, the photos and the activity log. You can add photos, reply, or withdraw the claim.
8. **Admin, follow the money.** Open **Partner login → Admin**.
   - **Overview**: what PayPal holds, has captured, paid out and refunded, plus every PayPal API in use.
   - **PayPal activity**: each call with its id.
   - **Resolve Hub**: the claims desk (open, past SLA, resolution rate, average time to decide, refunded, CSV). Open a claim: assign it, set priority, ask the customer or karigar ("Move the case"), add an internal note, then decide: PayPal refund, free re-repair or close with a reason. A refunded claim can't be reopened; a rejected or withdrawn one can.
   - The **bell** in the header shows new claims, replies and decisions to whoever they concern.
   - **Coupons**: create a code or switch one off.
   - **Sudhaar Care**: the members list.
   - **Live fleet**: Saathis on the map.

---

## Every page

### Customer app

| Page | What to try | APIs |
|---|---|---|
| `/` Home | Search or speak (🎤) a problem, Ghar Safai banner, karigar map, impact numbers, join links | — |
| `/fix` Repair request | Photo or text → Gemini quote → compare karigars (list + map) → bill with **coupon** or **Care** discount → pickup time → **Family Pay** → book. A sidebar keeps the summary and how you're protected | Gemini vision + JSON schema; PayPal Orders v2 (AUTHORIZE, discount breakdown) |
| `/orders/[id]` Order | Pay (JS SDK v6), OTPs, **live Saathi + ETA**, share tracking, approve a price change, before/after photos, invoice, item passport, rate & tip, Resolve Hub, full activity log | PayPal Authorizations, Captures, Payouts, Invoicing, Refunds; Gemini photo check and complaint review |
| `/track/[id]?t=…` Tracking | Public link for family: timeline with times, map, live Saathi, ETA. No OTPs, prices or exact address | — |
| `/ghar-safai` Ghar Safai | Add several items, one Saathi trip and one payment; coupon **GHARSAFAI** | Gemini; PayPal Orders v2 + Payouts (several karigars from one payment) |
| `/agent` Talk | Speak or type in 8 languages: *“My school bag zip broke, fix it under ₹400.”* The agent quotes, books and creates the PayPal order; you approve it in the chat | Gemini function calling (7 tools); PayPal Agent Toolkit (orders, invoices, refunds, transactions, disputes) |
| `/care` Sudhaar Care | Subscribe with PayPal → approve → return as a member; free pickups and a 30-day warranty; cancel | PayPal Catalog Products, Billing Plans, Subscriptions, Webhooks |
| `/resolve` Resolve Hub | Your claims (search, open/closed filter) and the 3-step claim form: pick a delivered repair (days of warranty left shown) → what went wrong (sets priority + deadline) → details and up to 5 photos → review (PayPal invoice attached). One open claim per repair; the warranty is enforced on the server | Gemini complaint review |
| `/resolve/RH-…` Claim | Claim id, status, priority, decision deadline (SLA), stage stepper, Gemini's suggestion, conversation (customer, karigar, team; internal notes for the team only), photo evidence, activity log, withdraw. Admins get Team actions: assign, priority, move the case, decide (refund / re-repair / close), reopen. Karigars on the job can reply and add photos | PayPal Refunds; notifications |
| `/repairs` My Repairs | Active repairs with pickup times and progress; item passports; impact totals; Care status | — |
| `/profile` Profile | Your details (edit name), saved location, Sudhaar Care status, PayPal payments and invoices, impact, language and voice, change PIN, help links | — |
| `/karigars/[id]` Karigar profile | Craft, experience, price list, verified reviews, map, “Get a quote from …” | — |
| `/pay/[id]?t=…` Family Pay | A relative pays from their own PayPal; the money is still only held until delivery | PayPal JS SDK v6 + Orders v2 |
| `/join` Join | Apply as a karigar or as a Repair Saathi, in your own language | — |
| `/guide` Demo guide | This guide, with one-tap logins | — |

### Saathi app (`/saathi`)

- **Header**: earnings, this week, trips, completed, km ridden and rating.
- **Trips tab**: one card per trip, with the stops (home and karigar shop), the pickup time, the OTP box and the next action.
- **Route map tab**:
  - every stop numbered, nearest first;
  - a line from the Saathi's position;
  - a **Directions** link for each stop.
- **Live location panel**:
  - **Share GPS** sends the phone's position every few seconds;
  - **Demo ride** moves the dot to the next stop in about 40 seconds and is labelled “demo ride” for the customer.
- **Earnings tab**: payouts with PayPal batch ids, and **Check payout status with PayPal** (Payouts API `GET`).
- **Profile tab**: area and vehicle; the vehicle sets the ETA speed.

### Karigar app (`/karigar`)

- **Header**: earnings, this week, active jobs, completed, rating from Sudhaar reviews, and tips.
- **Jobs**: a board in three stages:
  - *Coming to you*;
  - *On your bench*: inspect, change the price, repair, add an after photo;
  - *Ready to go back*.

  Below the board is a list of recently completed jobs with their ratings.
- **Earnings**: PayPal payouts, including tips, and the payout status check.
- **Reviews**: verified reviews from real delivered orders.
- **My shop**: edit the rate card in rupees, the bio and the usual turnaround. These appear on the public profile.
- **Last 7 days** chart and *How you get paid*.

### Admin console (`/admin`)

- **System check**: whether the PayPal and Gemini keys work, and what to fix if not.
- **Overview**:
  - money held, captured, paid out, refunded, tips, discounts and Care billing;
  - a table of **every PayPal API in use** with counts;
  - the latest PayPal calls.
- **Orders**: AG Grid with every PayPal id.
- **PayPal activity**: the full log of PayPal calls, newest first.
- **Queues**:
  - **Resolve Hub**: AI recommendation, then a person approves the refund;
  - **Photo checks**: repairs the AI couldn't pass;
  - **Applications**: KYC checklist, then approve and issue a PIN.
- **Coupons**: list, usage, create, switch off.
- **Sudhaar Care**: members, monthly billing, the PayPal plan id.
- **Live fleet**: each Saathi's live position and current trips.
- **Data tables**: customers, karigars, Saathis, payouts and webhooks.
- **Reset demo data** clears orders.

---

## Money rules

- The **karigar keeps 90%** of the repair price, the **Saathi 75%** of the pickup fee, and **tips 100%**. Sudhaar keeps the rest.
- The customer's money is **held** (authorized) at booking and **captured only after the delivery OTP**. Cancelling before pickup **voids** the hold.
- A higher price after inspection is a **second hold** for the difference, which the customer approves.
- **Coupons** and **Sudhaar Care** discounts come out of Sudhaar's share, and coupons are capped by it. They go to PayPal as a discount line, and the karigar and Saathi are always paid in full.
- Refunds come from the capture (split across both captures if there was a price increase).

## Coupons to try

| Code | Offer | Rule |
|---|---|---|
| `FIRSTFIX` | ₹50 off | First repair only |
| `DIWALI25` | ₹25 off | Orders above ₹200 |
| `GHARSAFAI` | 15% off, up to ₹150 | Ghar Safai baskets only |

Each code works once per customer.

## Honest notes

- PayPal runs in the **sandbox**; no real money moves.
- Karigars marked **Sample profile** are demo data. People who join through `/join` are real records.
- In-app voice uses the browser's speech recognition, so support depends on the browser and phone.
- The **Hindi phone line on Bolna** is built (`/api/voice/*`, the agent prompt and functions in `bolna/`, **Admin → Phone line**). It goes live once a Bolna agent and phone number are connected (see `docs/BOLNA.md`). Until then the website hides the phone card.
- The **conductor** runs every minute: payment reminders (SMS, plus a Bolna call to the payer for phone bookings), expiry notices, a pickup reminder (SMS, plus a call for phone customers), and job texts to the karigar and Saathi. **Admin → Phone line → Run now** runs it immediately.
- **Admin → Phone line → Customer timeline**: type a phone number, name or order number to see that customer's orders, claims, calls (with transcripts), texts and callback requests on one screen.
- With **Upstash Redis** set (`UPSTASH_REDIS_REST_URL` / `_TOKEN`), bookings, claims and photos survive a restart of the free host. **Admin → System check → Data storage** shows whether this is on.
- **SMS** (pay links, OTPs, price changes, claim updates) goes out through Twilio when its keys are set. Without them, each text is shown in **Admin → Phone line → SMS log** as *simulated*, so you can still see exactly what a phone customer would receive.
- Phone bookings have no "before" photo, so their repair photo check always goes to a person in **Admin → Photo checks**.
- The free host sleeps when idle (the first load can take about a minute), and a restart resets demo data.
