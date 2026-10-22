# PayPal AI Hackathon: compliance checklist

Tracks every rule in the official rules (paypalaihackathon.devpost.com/rules) and how Sudhaar meets it. Update the status column as we go.

## Project requirements
| Rule | How we meet it | Status |
|---|---|---|
| Integrates the PayPal developer platform (free sandbox), and PayPal is **central** | Orders v2 (AUTHORIZE), capture/void, Payouts, Invoicing, Refunds, Webhooks, JS SDK v6, Agent Toolkit. Every payment step runs through PayPal | ✅ built, ⏳ verify with real sandbox keys |
| Uses an AI tool/model | Google Gemini: vision quote, completion check, complaint review, Repair Agent | ✅ built, ⏳ verify with API key |
| Installs and runs consistently, functions as shown in video/text | `npm install && npm run dev`; auto-seeded data; production build passes | ✅ |
| New, or significantly updated during the submission period | Repo created and all code written after 1 Oct 2026 | ✅ |
| Third-party SDKs used within their licences | Next.js (MIT), AG Grid Community (MIT), PayPal JS SDK loader (Apache-2.0), PayPal Agent Toolkit (ISC), Google Gen AI SDK (Apache-2.0), Leaflet (BSD-2-Clause), Noto fonts via Fontsource (OFL-1.1). Map tiles © OpenStreetMap contributors (ODbL), credited on every map. react-leaflet was dropped because its Hippocratic licence is not an open-source licence | ✅ |

## Submission requirements
| Requirement | Status |
|---|---|
| Text description of features and functionality (Devpost form) | ✅ drafted (DEVPOST.md, sent separately) · ⏳ paste into Devpost |
| Functional demo: hosted URL **or** complete setup/run instructions | ✅ README instructions · ⏳ Render URL |
| Public GitHub repo with all source, assets, instructions | ✅ (keep repo public) |
| Open-source licence file, **visible in the repo's About section** | ✅ MIT `LICENSE` · ⏳ check GitHub shows "MIT license" in About |
| Demo video **under 3 minutes**, public on **YouTube**, shows the project working | ⏳ |
| No third-party trademarks or copyrighted music in the video without permission | ⏳ use royalty-free or no music |
| Test access: sandbox login / credentials / instructions in README | ✅ demo logins for every role in README · ⏳ sandbox buyer login in the Devpost testing field |
| Free, unrestricted access for judges until judging ends (Dec 2026) | ⏳ keep Render service + keys alive |
| English materials | ✅ |
| Entrant meets eligibility (age of majority, not in an excluded country) | ⏳ confirm (solo participant) |

## Judging criteria (equal weight) and our evidence
| Criterion | Evidence in Sudhaar |
|---|---|
| **Technological implementation** (PayPal + AI, non-trivial) | Authorize→capture escrow pattern, payouts split, invoices, refunds, webhooks, JS SDK v6, Agent Toolkit; Gemini vision + structured outputs + tool-use agent with a refund limit enforced in code |
| **Design** (complete product, not a PoC) | Phone + PIN accounts with server-side roles: customer app, Karigar app, Saathi app and admin console each see only their own data; 8 Indian languages; prices in ₹; real OpenStreetMap map with live customer location; installable with offline screens; OTP handovers; fair price-change flow; karigar and Saathi onboarding; AG Grid admin console |
| **Potential impact** (real problem, real audience) | Founder story; informal karigars; sourced e-waste and Right to Repair facts; honest launch plan (UPI at home, PayPal for cross-border Family Pay); impact numbers on the dashboard |
| **Innovation** | Ghar Safai (one capture split into payouts to several karigars); Family Pay; price increases approved by the customer and held as a second PayPal authorization; payment released only on OTP + photo check with a human fallback; AI-reviewed warranty claims with the PayPal invoice as evidence; an agent that books and pays |
| **Presentation** | ⏳ video under 3 minutes following VIDEO-SCRIPT.md (sent separately) |

## Prize targets
A project can win **one Grand or Honorable Mention prize plus one Sponsor prize**.
- Grand prize, or Honorable Mention: **Best Use of Agentic Commerce**, **Best Use of PayPal + AI**, **Most Impactful**
- Sponsor: **Best Use of AG Grid** (admin dashboard); Render (hosting)

## Before submitting (final checks)
- [ ] Sandbox keys set on Render; full flow tested on the hosted URL
- [ ] `npm run smoke:paypal` passes
- [ ] README: live URL, video link, sandbox buyer login filled in
- [ ] GitHub About: description, website, topics, MIT licence visible
- [ ] Video < 3:00, public on YouTube, link on Devpost
- [ ] Devpost: description, "built with", repo URL, demo URL, video URL
