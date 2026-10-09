# LeadSpace walkthrough (2026-10-10)

Looked at in a real browser against a local API on an in-memory Postgres (`backend-api/scripts/leadspace/walkthrough-api.js`) and a production build of the web app (never production data).

| What was checked | Result |
|---|---|
| Public page `/ls/<slug>` on desktop and a 375 px phone: hero with one button, offer, services with prices, about, trust points, map block, FAQ, sticky bottom button on the phone | Rendered correctly |
| Customer flow in the browser: fill the form, tick consent, request the code, read it in the admin test outbox, confirm | "Request received" shown; the lead appeared in the vendor's Leads tab as a Booking, the wallet dropped by the booking price |
| LeadSpace-only vendor login: five-tab shell (Home, Leads, Page, Promote, Wallet) with the bottom bar | Rendered; Home showed wallet, next step, counts; Leads showed the lead with chips; Wallet showed packs with GST text; Page showed the checklist and editor; Promote showed channels and plan |
| Console errors | None from the app after the production build (earlier errors were the dev server reloading itself and one wrong login) |

Not looked at in a browser: the admin console screens (type-checked and built, API behind them tested), the Razorpay checkout window, the embed script on a third-party page, dark-mode contrast on every state.
