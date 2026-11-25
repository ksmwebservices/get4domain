# 22. Shortest path to the first paying Pro vendor

Based on files 20 and 21. Labels: BE, UI, PUB as in file 20. "Switch" = a setting or environment value the owner or ops sets; "code" = a developer change. Day counts are working days for one developer plus one ops person; owner waiting time is shown separately.

**Key finding.** The money path that already works end to end in code without any external provider is the **cash/UPI path**: admin makes a cash order for the vendor (`POST /v3/admin/billing/vendors/:vendorId/cash-orders`, `BE plan-billing/api/billing-admin.controller.ts:48-52`), confirms it (`/orders/:id/mark-paid`, `:42`), and the same settlement service activates the Pro plan, issues the invoice number and opens the Pro entitlements (`BE plan-billing/settlement.service.ts` `settleWithin`; prior audit journey 5 = PASS). The gateway path (Razorpay) is built but has never been exercised. So the first paying vendor does not have to wait for Razorpay live keys: take UPI or bank transfer, enter it as a cash order, and run the gateway pilot in parallel.

## The seven steps, in order

| # | What must be live | Type | Evidence it is needed / built | Days | Waits on |
|---|---|---|---|---|---|
| 1 | **One release of the three repos on the V3 container**: push and tag BE `v3-lane-e1` (plus `v3-inv`, `v3-seo0`, `v3-themes`), UI `v3-ui-s17`, PUB `v3-pub-a1`; follow `deploy/v3live/RUNBOOK.md`: build the six images, create the live DB from the staging dump, mark migrations applied, load seeds (plans, taxonomy, packs, terms, services), bootstrap the super admin, run the startup check. | ops + DEP-1/DEP-2 | `DEPLOY_V3LIVE_PLAN.md:5` ("Nothing in this plan was run"); `V3_LIVE_ENVIRONMENT.md` sections 1 and 1a; `BE common/startup-check.ts` | 6 | owner approves each push (a push creates a Vercel preview) |
| 2 | **Hosts and switches**: Cloudflare proxied records for api, app, admin, directory; `V3_PUBLIC_ENABLED=true`, `V3_PUBLIC_USE_MOCKS=false`, `MAIN_HOST`, `API_BASE_URL`; `EMAIL_LIVE_SEND=on` with a verified Resend sender (so the welcome and invoice mails really go); decide the one vendor-site renderer (S-2). Keep the wildcard on V2 until step 3's first vendor is checked on an explicit host. | switches + SEO-A | `GO_LIVE_PUBLIC.md` switch table; `BE v3-mail/mail-enabled.ts:5`; `deploy/v3live/nginx/README.md` | 2 | owner: Resend domain DNS (SPF/DKIM), legal text sign-off (`PUBLIC_GAPS.md`) |
| 3 | **Wildcard to V3**: the `*.get4domain.com` switch, after the explicit rules for each V2 client are installed (`mrtravels`, `s2travels`, others from the owner's query). From now on a new vendor needs no nginx entry. | ops (DEP-5) | `WILDCARD_SWITCH_LATER.md:3-17` | 1 | owner window; list of V2 client hosts (INV-8) |
| 4 | **Owner data in the admin screens**: Pro plan prices for 3, 6 and 12 months (UI `apps/admin/src/pages/prices`), GST rate and TDS (Settings), firm profile with GSTIN (`/company`), terms text published (`/policies`), `paymentsMode=test` with Razorpay test keys (`/payments` credentials, `CredentialsPanel.tsx`). | owner data (PAY-1) | `BE plan-billing/settings/billing-settings.ts:23`; prior audit journey 10 = PASS | 1 | Q-2 (the price table) |
| 5 | **Create the first vendor and see the site**: admin "create vendor with site" (`/create-with-site`) makes the business, Free plan and the live subdomain site, runs the duplicate check, e-mails the welcome with login; open `<name>.get4domain.com`; send one enquiry from the site form and confirm it appears in the vendor Enquiries screen (route `POST /v3/public/sites/:host/enquire`, `BE requests-orders/api/public-requests.controller.ts:34`) and the vendor gets an e-mail alert (needs CRM-1, 2 days of code; today `SENT_SANDBOX` only, `messaging.service.ts:8-15`). | code CRM-1 + check | `BE v3-admin-vendor-site/admin-vendor-site.controller.ts:20`; prior audit journey 3 was BROKEN, the backend half (Q1) is now present, the PUB half and the UI half UNVERIFIED: re-run that journey first | 3 | step 2 |
| 6 | **Take payment, flip to Pro**: path A (works now): vendor pays UPI/bank, admin records cash order + mark-paid, plan becomes Pro, invoice appears in the vendor's Plan screen (`GET /v3/me/billing/invoices`, HTML download `me-billing.controller.ts:48-52`), receipt e-mail if step 2 done. Path B (parallel, 3 days): Razorpay test pilot (order, webhook, settle, invoice), then live keys + `PLAN_PAYMENTS_LIVE_ENABLED=true` and one real small payment. | pilot PAY-2 | `settlement.service.ts`; webhook `payments-webhook.controller.ts:19`; `payments-gate.ts:42-52` | 1 (A) + 3 (B) | owner Razorpay KYC and live keys for B |
| 7 | **The vendor logs in and sees Pro unlocked**: Pro-only tabs and fields open ("Open with a Pro plan" locks disappear), the Pro call-to-action set and cart appear on the site (entitlements invalidated at settlement: `afterPaid` in `settlement.service.ts`), site stays on the subdomain; vendor edits and publishes. Check once with a real phone (install button on the kit path, `PUB components/site-kit/SiteApp.tsx:53`). | check | `UI apps/vendor/src/pages/free-locks.test.tsx`; `BE entitlement-engine.ts:75-102` | 1 | step 6 |

Total: about 15 working days of one developer plus the owner's waits, of which the code is only CRM-1 (2 days), THM-2 for the kit path (3 of the 6 days if the install button and bottom bar on vendor sites must be there on day one) and SEO-A (2 days). The rest is deploy, switches and data.

The elapsed time is set by owner-side items, not code: Resend sender verification (days), Razorpay KYC (days to weeks, only for path B), lawyer review of policy texts (`PUBLIC_GAPS.md` G38-G44), wildcard window.

## What can be skipped for week one

Each item is built or planned but not needed to take the first payment. Reason in brackets.

1. Custom domain purchase, DNS records and Cloudflare automation (DOM-2 to DOM-4): Pro on the subdomain is complete by owner rule; custom domain is an add-on.
2. Multi-category vendors and the three-level taxonomy in registration (CAT-1 to CAT-4, THM-1): schema change, largest item, start with one category per vendor.
3. Bulk 100 a day: create 10 to 20 a day through the single create-with-site screen; the CSV import (`listing-import.controller.ts:25-35`) can load unclaimed listings; vendor accounts in bulk (SIGN-1) after the first payments.
4. SMS and WhatsApp delivery of logins (SIGN-2 provider part): send the e-mail from the platform and a WhatsApp message by hand with the site address and the claim/login link (assumption; Q-1).
5. Chatbot, saved conversations, WhatsApp hand-over (BOT-1, BOT-2): Pro feature, not needed to pay.
6. Tele-CRM on V3 (CRM-3): staff call from the enquiry list; the sample-only screen stays hidden by the Free/Pro locks.
7. Campaign add-on, social posting, AI poster and video, Meta and Google (CAMP-1, SOC-1/2, AI-1): manual first by owner decision.
8. Per-team section picker (ROLE-1): use the five existing roles (`admin-role-matrix.ts:21`); only check revenue visibility (ROLE-2, 1 day).
9. V2 vendor migration and back-dated cash invoices (MIG-*, PAY-5): move at most the five named clients after the first new vendor; a V2 vendor pays like a new one on the new system until the importer exists.
10. Vendor/admin PWA install (PWA-1): the vendor site install is what the owner wants first; dashboards work in a browser tab.
11. New packs, pack-specific screens, extra themes, theme gallery, GA4 and Search Console (PACK-2/3, THM-3, THM-6, SEO-B).
12. Invoice as PDF (PAY-3): the HTML invoice prints to PDF from the browser.
13. Directory indexing switches and claim approval screen: keep directory pages noindex (`directory-settings.ts:37`).
14. Integrations screen (DOM-1) is NOT skippable if keys are to be entered by a person other than a developer; for week one ops can set the Resend/ResellerClub values by API call with the super admin token, so it can slip a week.
