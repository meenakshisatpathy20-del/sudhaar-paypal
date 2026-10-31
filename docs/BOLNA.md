# Sudhaar phone line on Bolna

A Hindi voice agent on [Bolna](https://www.bolna.ai) lets people **without a smartphone** use Sudhaar by phone. It is a **voice layer on the whole repair**, not just a chatbot: one booking can involve the caller, the family member who pays, the Saathi and the karigar, and the agent keeps all of them in step.

**When someone calls** (inbound), the agent can:

- get a repair price;
- book a doorstep pickup and text the PayPal link to whoever pays;
- book **Ghar Safai** by phone: several broken things (chappal, bag, kurta…) quoted one by one, then picked up together for one lower fee and one PayPal payment;
- say where a repair is, and read out the team's question on an open claim;
- cancel before pickup;
- file a warranty claim, or add to an open one;
- text a forgotten OTP to the registered number, or the PayPal link again if the payer didn't get it;
- hand the caller to a person (a callback request, or a live transfer).

**When Sudhaar calls** (outbound, placed by the conductor or the admin):

- the family payer, if they haven't paid after 2 hours ("your mother booked a repair, the link is in your SMS");
- the phone customer, an hour before the pickup ("the Saathi comes at 10, your OTP is in your SMS");
- any customer, from **Admin → Phone line → Call customer**, or when they press "Call me" on the website.

The agent works through Sudhaar's own APIs, and the caller's number identifies them.

Money still moves only through PayPal. A phone booking creates a PayPal order and a **Family Pay link**, so the caller's son or daughter (or the caller, on any browser) can approve the payment. The money is held until the repaired item is back home. The phone agent can never take money itself, and it never reads out OTPs.

```
Caller ──phone──► Bolna agent (Hindi speech-to-text → LLM → Hindi text-to-speech)
                    │  1. inbound lookup     GET  /api/voice/caller?contact_number=+91…
                    │  2. custom functions   POST /api/voice/quote | book | status | cancel | complaint | otp | handoff
                    │  3. post-call webhook  POST /api/voice/webhook
                    ▼
                 Sudhaar (Next.js) ──► Gemini quote · PayPal Orders v2 (AUTHORIZE) · Resolve Hub
Conductor (every minute) ─┬─► SMS (Twilio): pay link, reminders, OTPs, expiry, price change, claims, partner jobs
Admin "Call" / "Call me" ─┴─► POST https://api.bolna.ai/call  (outbound: payment nudge, pickup reminder, callback)
```

## 1. Sudhaar side (Render → Environment)

| Variable | What it is |
|---|---|
| `VOICE_API_TOKEN` | A long random secret you make up. Bolna sends it on every call to Sudhaar. Without it, all `/api/voice/*` endpoints answer 503. |
| `APP_URL` | Your site, e.g. `https://sudhaar-mm59.onrender.com`. Used to build the PayPal pay link the agent reports. |
| `VOICE_PHONE_NUMBER` | Optional. The number customers dial, shown on the home page and in Talk (e.g. `+91 80 1234 5678`). |
| `BOLNA_API_KEY`, `BOLNA_AGENT_ID` | Optional. These turn on **"Ask Sudhaar to call me"** on the website (Bolna's outbound call API). |
| `BOLNA_FROM_NUMBER` | Optional. The Bolna number used for outbound calls, if you have more than one. |
| `SMS_PROVIDER`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | Optional. `SMS_PROVIDER=twilio` plus your Twilio keys and sending number turn on real SMS (pay links, OTPs, price changes, claim updates). Without them every text is still written to **Admin console → Phone line → SMS log**, marked *simulated*. |

Never put these values in the code or in chat. Set them only in Render (and in your local `.env`).

## 2. Bolna side (dashboard)

1. **Create an agent** (Agent setup → New agent), e.g. "Sudhaar Saathi".
2. **Prompt**: paste [`bolna/agent-prompt.md`](../bolna/agent-prompt.md), from "You are Sudhaar Saathi" to the end.
3. **Language and voice**:
   - Language: **Hindi**.
   - Speech-to-text: a provider with Hindi support. Deepgram (multilingual or Hindi) or Sarvam are good for Hinglish.
   - Text-to-speech: a natural Hindi voice (ElevenLabs, Sarvam or Azure `hi-IN`).
   - Keep the LLM response short (max tokens about 150).
4. **Tools → Add custom function**: add each of the seven functions in [`bolna/tools.json`](../bolna/tools.json):
   - `get_repair_quote`
   - `book_repair` (asks for the payer's mobile number; the PayPal link is texted to it)
   - `get_repair_status` (also reads open claims and the team's question)
   - `cancel_booking`
   - `raise_warranty_claim` (adds to an open claim if there is one)
   - `send_otp_sms` (texts a forgotten OTP to the registered number)
   - `request_callback` (the caller wants a person: the team gets it in the admin console and the bell)

   Optional: add Bolna's built-in **Transfer Call** tool with a Sudhaar team number, so an upset caller can be transferred live.

   In each one, replace `https://YOUR-SUDHAAR-SITE` with your Render URL and `YOUR_VOICE_API_TOKEN` with your `VOICE_API_TOKEN`.
   - If Bolna's API token field doesn't add the `Bearer ` prefix for you, keep it in the value as shown.
   - If calls come back with a 401, add `?token=YOUR_VOICE_API_TOKEN` to the end of each URL instead. Sudhaar accepts either.
5. **Inbound calls (Calling → Inbound)**:
   - Attach a phone number to the agent.
   - Under caller matching, choose **API** and set it to `https://YOUR-SUDHAAR-SITE/api/voice/caller?token=YOUR_VOICE_API_TOKEN`.
   - Bolna adds `contact_number`. Sudhaar returns `known_customer`, `caller_name`, `care_member`, `active_repairs` and `summary`, which the prompt uses.
6. **Post-call webhook (Analytics / Webhook)**: set it to `https://YOUR-SUDHAAR-SITE/api/voice/webhook?token=YOUR_VOICE_API_TOKEN`. Calls then appear in **Admin console → Phone line** with their status, duration, summary and transcript.
7. **Test** with Bolna's "Talk to agent" in the browser, then call the number.

## Keep the server awake during calls (important on Render's free plan)

Render's free plan puts the server to sleep after about 15 minutes without traffic, and waking it can take 30–60 seconds: long enough for a Bolna tool call to time out mid-conversation. Before demos and judging, use a free uptime service (e.g. cron-job.org or UptimeRobot) to open `https://YOUR-SUDHAAR-SITE/api/config` every 10 minutes. The paid Render plan doesn't sleep.

The tools also accept what Bolna sends when the agent skips an optional field (`None`, an empty value or an unfilled `%(name)s`), and take the caller's number from `from_number` / `contact_number` if the tool's `phone` is empty.

## Outbound calls: one prompt, both directions

Outbound calls use the same agent. Sudhaar sends Bolna `user_data` with the same variables an incoming call gets, plus `call_reason` (`payment_reminder`, `pickup_reminder`, `status_update` or `callback_from_website`), `order_id`, `item`, `customer_name`, `payer_name`, `total_inr` and `pickup_time`. For an incoming call, `call_reason` is `incoming`. The prompt tells the agent what to say first for each reason. OTPs are never in `user_data`.

On Bolna's trial plan, outbound calls only reach **verified numbers**: verify your own number in Bolna and use it as the customer or payer in a demo.

## 3. Try the APIs without Bolna

```bash
SITE=https://sudhaar-mm59.onrender.com
TOKEN=...   # your VOICE_API_TOKEN

curl -s "$SITE/api/voice/caller?token=$TOKEN&contact_number=%2B919999999999"
curl -s -X POST "$SITE/api/voice/quote" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"description":"mixer jar ka blade dheela hai","phone":"+919812345678"}'
# then book with the quote_id and karigar_id from the answer:
curl -s -X POST "$SITE/api/voice/book" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"phone":"+919812345678","name":"Kamla Devi","address":"House 4, near Shiv Mandir","quote_id":"Q…","karigar_id":"k-…","slot_index":0,"payer_name":"Rahul","payer_relation":"son"}'
curl -s -X POST "$SITE/api/voice/status" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"phone":"+919812345678"}'
```

## How a phone booking is paid

1. The agent asks who pays. If a family member pays (e.g. *बेटा राहुल*), it asks for **their mobile number** and repeats it back.
2. `book_repair` creates the order and a PayPal order (intent AUTHORIZE), and **texts the Family Pay link to the payer** (or to the caller, if they pay themselves). The caller gets a confirmation SMS. The team can also copy the link again from **Admin console → Phone line**.
3. The payer opens the link and approves in PayPal. The money is **held**.
4. The caller then gets the **pickup OTP by SMS** on their registered number. No login is needed.
5. If the karigar changes the price after inspection, the caller and payer get an SMS with the same link, where they approve or decline (a higher price is a second PayPal hold).
6. When the item is on its way back, the **delivery OTP** is texted. After delivery PayPal captures the payment and pays out, and the customer gets a text with the warranty.
7. Forgot the OTP? Ask the agent ("OTP नहीं मिल रहा"), or the Saathi presses **"Text it to them again"**. Either way it goes only to the registered number, at most 3 times in 30 minutes.
4. A new caller also gets a Sudhaar account on their number, with a PIN the agent reads out once. They can then log in on the website with that number and PIN.

## Safety

- Every `/api/voice/*` call needs `VOICE_API_TOKEN`, and the endpoints are rate-limited.
- Caller ID can be faked, so the phone line **never reveals OTPs, addresses or payment details** on the call. OTPs are only texted to the number registered on the order, which a faker doesn't receive.
- The SMS log in the admin console masks every OTP and phone number. Demo accounts are never texted.
- SMS to Indian numbers is subject to TRAI DLT rules, and a Twilio trial account can only text numbers you verify in Twilio. For the demo, verify your own number and use it as the caller or payer.
- Cancelling only works before pickup, and it voids the PayPal hold, so nothing is charged.
- Claims go to Resolve Hub. Gemini reviews them and **a person** approves any refund.
- "Call me" works only for a logged-in customer, only to **their own** number, and at most once every 10 minutes. The shared demo account can't use it.
