# Claims vs Reality — every public promise against the truth table (2026-10-08)

> Companion to [VENDOR_DASHBOARD_AUDIT.md](VENDOR_DASHBOARD_AUDIT.md) (§4 holds the evidence behind each status). Docs-only; no copy was changed. **Rule applied:** a claim is SAFE only when a paying vendor can use it today; REWORD when the thing exists but the wording over-promises; REMOVE-UNTIL-BUILT when there is no software (or a mock) behind it. "No *coming soon* wording on customer-facing surfaces" still holds — REMOVE means *take the line out*, not label it.
>
> Sources scanned: `lib/pricing.ts` (plan lists), `data/platform-features.ts` (capabilities + comparison matrix + "why us"), `(marketing)/page.tsx` and `(marketing)/pricing/page.tsx` (FAQs), `public/llms.txt`, the chat-bot prompts in `backend-api/src/ai/ai.service.ts` (marketing + dashboard), and in-product copy.
>
> Verdict counts: **13 SAFE · 23 REWORD · 9 REMOVE-UNTIL-BUILT** (of 45 claims).

## 1. Claim table

Truth refs point to the row numbers of VENDOR_DASHBOARD_AUDIT.md §4.1 (T#).

| # | Claim (where) | Truth | Verdict | Suggested wording / action |
|---|---|---|---|---|
| C01 | "Lead capture, CRM & TeleCRM" (`pricing.ts:43`) | T5, T6 WORKING | **SAFE** | — |
| C02 | "Website lead-capture forms" (`platform-features.ts:27`) | T5 WORKING (stepnrock/deebi forms post to `engine.enquiry`) | **SAFE** | — |
| C03 | "Website auto-bot reply" (`pricing.ts:44`, matrix `:87`) | T7 PARTIAL: widget needs a working AI key; stepnrock uses its own scripted bot | **REWORD** | "Chat widget that answers visitors from your business details — added to your site for you." Hold until V-004/V-040 confirm a live reply |
| C04 | "Communication Hub — WhatsApp, SMS & email" (`pricing.ts:45`) | T9 PARTIAL: SMS + email keys exist, WhatsApp is a mock without a BSP | **REWORD** | "SMS and email from one inbox; WhatsApp once your WhatsApp Business number is connected" |
| C05 | "WhatsApp Business API (no monthly platform fee)" (`platform-features.ts:30`) | T9: no BSP credentials configured for any vendor | **REWORD** | Same as C04; drop the fee line until a BSP is contracted |
| C06 | "Transactional & promotional SMS" (`:30`) | Fast2SMS key present | **SAFE** | — |
| C07 | "Email campaigns & newsletters" (`:30`) | single send path verified; bulk campaign tooling not verified | **REWORD** | "Email messages to your customers" |
| C08 | "GST invoicing & expense tracking" (`pricing.ts:46`) | T10 PARTIAL (records + PDF fine; payment link on platform Razorpay), T11 WORKING | **SAFE** | Do not advertise "collect payment on invoices" until V-017 |
| C09 | "Staff dashboard & team access with roles" (`pricing.ts:47`) | T16 WORKING | **SAFE** | — |
| C10 | "AI Studio — content, images & blog writing" (`pricing.ts:48`, `platform-features.ts:40`) | T17 PARTIAL/unverified: provider failures masked; zero production generations | **REWORD** | "AI Studio — captions, posts and blog drafts" until a live generation passes; add images when V-041 lands |
| C11 | "Images, posters & reels" (`platform-features.ts:41`) | images = temporary links; reels cannot render in the container; video is a mock clip | **REMOVE-UNTIL-BUILT** (reels / video) | Keep "posters" only |
| C12 | "₹499 / ₹1,299 one-time AI Studio credit" (`pricing.ts:54,78`, FAQs, `llms.txt`) | annual list amount, prorated for shorter admin terms; expires after 90 days | **SAFE** | Consider adding "valid 90 days" (the FAQ already says credits are valid 90 days) |
| C13 | "3 / 6 SEO keywords, meta optimization" (`pricing.ts:49,76`) | T19 PARTIAL: you type title/description/keywords; applies to platform-rendered sites only | **REWORD** | "Search-friendly title, description and 3 / 6 keywords set up for you" and wire standalone sites (V-031) |
| C14 | "GEO / AEO" (`pricing.ts:49,76`, `platform-features.ts:43-45`, matrix `:114`, `llms.txt`, chat-bot) | T20 MISSING | **REMOVE-UNTIL-BUILT** | Remove "GEO/AEO" and "Local (GEO) visibility / Answer-engine (AEO) optimization" |
| C15 | "20 backlinks" (`pricing.ts:49,76`) | T23: staff delivery, nothing tracked | **REMOVE-UNTIL-BUILT** | Offer as a done-for-you service only once a delivery checklist exists |
| C16 | "Backlink building / Directory & listing submissions / Off-page SEO / Ongoing authority growth" (`platform-features.ts:49-51`) | T23 SERVICE, no software | **REMOVE-UNTIL-BUILT** | Same |
| C17 | "Google Business Profile, Analytics & Search Console" (`pricing.ts:50`, `:46-48`) | T21–T22: staff setup; GA ID box never injected | **REWORD** | "We set up your Google Business Profile, Analytics and Search Console for you" and inject GA (V-032) |
| C18 | "Social media management & posting" (`pricing.ts:51`, matrix `:108`, chat-bot) | T18 BROKEN: mock publish says "published" | **REMOVE-UNTIL-BUILT** | "AI-written social posts you can copy or download" |
| C19 | "Scheduling & publishing / Social profile management" (`platform-features.ts:53`) | no OAuth, no scheduler job | **REMOVE-UNTIL-BUILT** | Remove |
| C20 | "Post & festival-poster creation / Campaign landing pages" (`:53`) | content generation + landing-page generator exist | **SAFE** | — |
| C21 | "PWA — installable on any phone" (`pricing.ts:52`) | T3 WORKING | **SAFE** | — |
| C22 | "Vendor app on your phone / Works from any phone" (`:56`) | PWA | **SAFE** | — |
| C23 | "Client app for booking, ordering & paying" (`:56`) | T27 PARTIAL: portal exists; depth varies by industry | **REWORD** | "A customer portal for bookings and orders" |
| C24 | "Push notifications" (`:56`) | vendor push only (FEATURE_MATRIX F27: customer push missing) | **REWORD** | "Push notifications for you" |
| C25 | "2 / 4 theme & website customizations per year" (`pricing.ts:53,77`) | T2 PARTIAL: enforced, but only 2 themes exist and standalone sites ignore them | **REWORD** | "2 / 4 website template changes a year (platform-hosted sites)"; grow the catalogue |
| C26 | "Ready-made industry templates" (`platform-features.ts:61`) | 2 themes in production | **REWORD** | "Industry-specific website designs, customised for you" |
| C27 | "Content & product management (CMS)" (`:61`) | works for platform-rendered; partly decorative for standalone | **REWORD** | Until V-031: "Manage your products and photos; we update your site text for you" |
| C28 | "Free subdomain, hosting & SSL / industry website live in 24 hours" | T4, T25 | **SAFE** | — |
| C29 | "WhatsApp bot reply" (BOS, `pricing.ts:71`) | T8 PARTIAL: no BSP | **REWORD** | "WhatsApp bot reply (connect your WhatsApp Business number)" |
| C30 | "Accounting & GST — P&L and GSTR filing" (`pricing.ts:72`, `:96-97`) | T12 PARTIAL: P&L works, GSTR is a tracker | **REWORD** | "P&L statement and GST return tracking" |
| C31 | "GSTR filing & due-date tracking" (`platform-features.ts:33`) | T12 | **REWORD** | "GST return due-date tracking" |
| C32 | "HRM — staff, attendance & payroll / Staff records & roles / Attendance tracking / Payroll" (`pricing.ts:73`, `platform-features.ts:34-36`, `llms.txt`) | T13 MISSING (placeholder) | **REMOVE-UNTIL-BUILT** | Remove from BOS list and matrix; keep "Team access with roles" |
| C33 | "Inventory management" (BOS, `pricing.ts:74`) | T14 PARTIAL: Retail POS inventory only; website sales never move stock | **REWORD** | "Inventory for stores: stock levels, reorder level and in-store POS" |
| C34 | "Stock levels & reorder alerts" (`platform-features.ts:39`) | no alert is sent (count only) | **REWORD** | "Stock levels and low-stock counts" |
| C35 | "POS and online-order stock updates" (`:39`, "stock moves with every sale and order" `:38`) | online orders never move `VendorProduct` stock; sales can oversell | **REMOVE-UNTIL-BUILT** | Remove "online-order" until V-010/011 |
| C36 | "Task management & assigning" (BOS, `pricing.ts:75`) | T15 MISSING outside Technology | **REMOVE-UNTIL-BUILT** | Remove until V-061 |
| C37 | "Analytics & reporting" (`platform-features.ts:118`) | T24 PARTIAL: platform data only | **REWORD** | "Business reports from your leads, invoices and wallet" |
| C38 | "Each industry gets tailored pages, records and workflows — clinic appointments & patients, restaurant menu & orders, real estate properties & site visits" (`llms.txt`) | 20 industry configs + views; stubs on gym/attendance, realestate/documents | **SAFE** | Replace the two stub tabs with real views or hide them |
| C39 | "Offers a customer portal so a business's own customers can book, order, and pay" (`llms.txt`) | T27 PARTIAL | **REWORD** | "…can book and order; online payment where the business has connected Razorpay" |
| C40 | "Serves 20 industries" (`llms.txt`, bot) | 20 configs exist; live vendors in 3 | **SAFE** | — |
| C41 | "A wallet covers usage-based extras such as AI, WhatsApp/SMS/email" (bot, FAQs) | wallet works; WhatsApp mock | **SAFE** | — |
| C42 | Dashboard bot: "Pay invoices: go to **Billing & Payments**", "Campaign status: **My Campaign**", "Upgrade plan: **My Plans & Services**" (`ai.service.ts:130-135`) | menu labels are *Invoices / Wallet & Billing / Growth Hub / Subscription*; Billing page is not in the menu | **REWORD** | Generate the bot's navigation text from the feature registry (design §6) |
| C43 | Marketing bot repeats C03, C04, C10, C13–C19, C29–C36 (`ai.service.ts:64-79`) | see those rows | **REWORD** | Same registry-generated list |
| C44 | "Online ordering / Order Now / Shop Now" primary CTAs for restaurant, retail, agriculture (`industry-experience.ts`) | checkout needs vendor Razorpay keys (0/5); no stock/address | **REWORD** | Show the Buy button only when the storefront is payment-ready; otherwise an "Enquire" CTA |
| C45 | "Complete ... WhatsApp and an AI content studio" (`llms.txt` summary) | see C04, C10 | **REWORD** | Match C04/C10 |

(Counts are computed from this table by the script in `evidence/dashboard-audit/count-claims.py`.)

## 2. Existing vendors affected

| Vendor | App | What they were promised vs what they have | Missing / broken for them |
|---|---|---|---|
| **stepnrock** (retail, Workspace half-yearly, term `ACTIVE_PAYMENT_DUE`, due 2026-10-10) | Standalone Next app `stepnrock/` | Website ✔ (products, categories flow). CRM/TeleCRM ✔ (enquiry form posts to CRM). AI credit ₹250 ✔ granted once | **Online payments off** (no Razorpay keys). **Stock not tracked** (checkout ignores it; storefront shows 10 by default). No shipping address. Dashboard Website-Manager text/SEO/contact edits have **no effect** (phone hard-coded). Inventory/Products/POS tabs empty (separate table). Billing page not in menu. Prices look like showcase values (₹89.99). AI Studio unverified (provider error masked). |
| **deebiphotography** (photography) | Standalone app | Portfolio via `cms.portfolio` ✔, 7 services, 5 leads ✔ | No billing term; SEO/GA edits ignored; bookings tab fine; gallery delivery fine |
| **mrtravels** (travel) | Platform dashboard + site | 7 products, 1 platform invoice | No billing term; fleet/drivers/contracts are addon-gated and need the flags; invoices are vendor→platform only |
| **allwintours** (travel) | Standalone app (`allwin-tours/`) | 1 campaign, 1 landing page | 0 products, no CMS row — website content is not managed from the dashboard at all |
| **ksm-webtech-services** (retail, internal) | — | wallet ₹100 | Nothing configured; useful as the **QA tenant** for V-010 |
| **40 demo sandboxes** (39 expired) | demo tour | seeded `CatalogItem`s (3/vendor), contacts, records | never cleaned up (V-070) |

## 3. How to keep this table honest
The registry in [FEATURE_REGISTRY_DESIGN.md](FEATURE_REGISTRY_DESIGN.md) generates the pricing lists, the comparison matrix, `llms.txt` and the bot prompts from one list, and a CI guard fails when a feature marked `WORKING` has no passing test. Until then, apply the REWORD/REMOVE edits above by hand (V-003).
