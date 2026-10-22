# Sudhaar screenshots

A walk through the app, screen by screen. These were captured from a local run of the production build in **simulation mode** (no PayPal or Gemini keys), so the quote shows a "Simulated" badge and map streets are not loaded. The [live demo](../README.md#testing-instructions-for-judges) runs the real PayPal sandbox and Gemini.

## Customer app

| | |
|---|---|
| ![Home page](screenshots/01-home.png) | **Home.** Snap or speak what's broken, Ghar Safai Mode, and the PayPal promise: your money is held until the item is back. |

| Quote | Choose a karigar | Review and pickup time |
|---|---|---|
| ![AI quote with the Fix-or-Replace meter](screenshots/02-quote-fix-or-replace.png) | ![Karigars compared by price, distance, rating and ready time](screenshots/03-choose-karigar.png) | ![Booking summary with pickup time and Family Pay](screenshots/04-review-pickup-time.png) |
| AI quote in rupees next to the price of buying new (Fix-or-Replace meter). | Verified karigars compared by price, distance, rating and ready time. | Pick when the Saathi comes. The tool-fund donation is opt-in. Family Pay lets someone else pay. |

| Ghar Safai basket | Family Pay link | Live order |
|---|---|---|
| ![Ghar Safai basket with three items](screenshots/05-ghar-safai-basket.png) | ![A relative pays from the shared link](screenshots/06-family-pay-link.png) | ![Order page with OTPs and live tracking](screenshots/07-order-otp-and-tracking.png) |
| Several broken things, one Saathi trip, one PayPal payment split across karigars. | A son or daughter opens the link and approves the PayPal payment, which is held until delivery. | Pickup time, OTP for every handover, and live tracking. |

| Rate and tip | Verified review |
|---|---|
| ![Rating and a PayPal tip after delivery](screenshots/09-rate-and-tip.png) | ![Karigar profile showing a verified review](screenshots/10-verified-review.png) |
| After delivery: rate the karigar, tip through PayPal (all of it goes to the karigar), or book again. | Real reviews are marked *Verified repair*; ratings and job counts update from delivered orders. |

## Partner apps

| Saathi app | Karigar app |
|---|---|
| ![Saathi app with a Ghar Safai trip](screenshots/08-saathi-app.png) | ![Karigar app earnings including a tip](screenshots/11-karigar-app-earnings.png) |
| The Saathi's own trips with the pickup time and stops. OTPs come from the customer, never the app. | Earnings from real PayPal payouts, including thank-you tips. |

![Admin console on AG Grid](screenshots/12-admin-console.png)

**Admin console** (AG Grid): orders, customers, karigars, Saathis, payouts and PayPal webhooks, with queues for refunds, photo checks and applications.

## For everyone

| In Tamil | Become a Repair Saathi |
|---|---|
| ![Home page in Tamil](screenshots/13-tamil.png) | ![Saathi sign-up form](screenshots/14-become-a-saathi.png) |
| The whole app in 8 languages: English, Hindi, Bengali, Marathi, Telugu, Tamil, Odia and Kannada. | Students and local volunteers apply to become Saathis; karigars apply the same way. |
