# Dashboard v2 (Release 1A)

Owner: KSM. Built 2026-10-08/09 on branch `get4domain-site`. The old dashboard is untouched for every vendor until KSM switches that vendor on.

## What it is

One department-wise menu for every vendor, generated from a single registry (`registry/features.ts`). Each menu item is **Open**, **Locked**, **Coming soon** or **Hidden**, decided by one pure function that the dashboard, the API and the tests all share.

## The ten departments

| Department | Screens (plan that includes it) |
|---|---|
| Home | Today (Essentials). Reports: Coming soon (Pro) |
| Sales and CRM | Leads with Board and Call queue (Essentials), Customers (Essentials), Customer portal (Essentials). Quotes: Coming soon. Pitch scripts, assignment, sales reports: Coming soon (Pro) |
| Marketing and Growth | AI Studio (Essentials; reels and video are Coming soon). Campaigns and landing pages, Reviews and offers: Coming soon (Pro). Social posting: Hidden until it really publishes |
| Website and Domain | Content and pages, Design and themes, Domain, Search and AI visibility, Chat widget, Go-live readiness (all Essentials). Add new pages, AI answers and Google tools: Coming soon (Pro) |
| Commerce and Operations | Products, Stock (product businesses), Orders (label follows the business), Industry workspace (only where the industry has operation tabs). Full workspace, Inventory and purchases, Counter and POS, Tasks, Documents: Coming soon (Pro) |
| Finance and Accounts | Customer invoices (Essentials), Expenses and GST (Pro, built). Collect payments, Recurring billing, Accounts for the CA: Coming soon |
| People and HR | Team and roles (Essentials). Branches, departments, audit log and HR and payroll: Coming soon (Pro) |
| Communication | Inbox, Notifications (Essentials). SMS and e-mail, Reminders and feedback: Coming soon. WhatsApp bot: Coming soon until verified |
| Your Get4Domain account | Plan and billing (the only place the vendor pays us), Wallet, Business profile, Help and support (Essentials). Connections, Website disclosures: Coming soon |
| BOS Custom | Visible only to Custom clients; every item is Coming soon |

Plan names the vendor reads: **Essentials** (internal key `WORKSPACE`) and **Pro** (`BOS`). Custom is never a plan; it is a client marker (`bos_custom` add-on). Names come from one function, `planDisplayName()`.

## State rules

| State | When | What the vendor sees |
|---|---|---|
| Open | Built and tested, and the plan includes it | Normal item |
| Locked | Built, but the plan lacks it | Lock icon; opens an upgrade card to Plan and billing |
| Coming soon | Not built, or built but not yet tested, **even for a higher plan** | Grey, not clickable, small plan badge. Nothing half-built behind it |
| Hidden | Wrong business profile, not for this client type, or switched off | Not in the menu |

A feature counts as built only if its registry status is WORKING or LIMITED. WORKING needs a test id that a verification suite asserts (`[feat:<id>]`). LIMITED needs a test id or a manual check recorded in `docs/v2/evidence/dashboard-v2/WALKTHROUGH.md`, plus a plain statement of the limits.

## Rollout switch

The per-vendor switch is the `nav_v2` add-on. Vendors created on or after 2026-10-09 get it by default; everyone else keeps the old dashboard until KSM switches them. On the VM, from `backend-api`:

```
node scripts/nav-v2-dry-run.js                       # read-only; report in docs/v2/evidence/. The "would lose access" list must be empty
node scripts/set-vendor-access.js --nav-v2 on  --vendor <subdomain>            # dry run, writes nothing
SET_VENDOR_ACCESS_CONFIRM=I_HAVE_READ_THE_DRY_RUN node scripts/set-vendor-access.js --nav-v2 on --vendor <subdomain> --apply
node scripts/set-vendor-access.js --nav-v2 off --vendor <subdomain> --apply    # back to the old dashboard (same confirm variable)
```

Order: your own test client, then Step N Rock, then the rest in a batch, then default ON for all. Old addresses redirect (308, query kept) only for vendors on v2.

Per-client exceptions to the plan: Admin > Commerce > Plan access. Special terms (half-year plan, manual QR payment, GST not charged): Admin > Pricing > Special arrangements (see [BILLING.md](BILLING.md)).

## Add a feature in five steps

1. Add a record to `registry/features.ts`: id, department, label, route (`/dashboard/<dept>/<screen>`), one `purpose` (no two features may share a purpose), `minPlan`, `profiles`, `status`, and `moduleKey` if it needs a module.
2. If it has a screen, mount the existing page or tabs in `get4domain_mvp/src/dashboard-v2/screens.tsx`. Move screens, do not rewrite them.
3. Give it evidence: tag a test `[feat:<testId>]` in a suite and set `testId`, or walk it by hand on a production build and write its id in backticks in `WALKTHROUGH.md` (and set `manualCheck`). If you cannot, leave it `UNTESTED`: it shows as Coming soon.
4. Run `cd get4domain_mvp && npm run registry:build && npm run registry:check`; if the menu changed on purpose, `node registry/verify-registry.mjs --update` and review the snapshot diff.
5. `npm run build` in both packages, run `npm run verify:commercial` in `backend-api`, commit the generated files with the change.

The guard fails on: a dashboard route not in the registry, two features claiming one purpose, WORKING without a test id, a test id no suite asserts, an unbuilt feature claiming evidence, an out-of-date generated file, and the old "coming soon" stub imported by v2 code.

## How plans turn into access

`provisionModules` (backend-api/src/registry/provisioning.ts) runs when a term starts or renews, on a plan change and on admin activation. It switches on the modules the vendor's plan includes (read from the registry). It only grants: it never switches anything off and never touches vendor data, an explicit OFF from KSM is respected, and running it twice changes nothing. A downgrade changes what the menu offers, not what the vendor has already set up; KSM removes access in Plan access if wanted.

## Known limits (1A)

- The three product stores (your products, the industry catalogue tabs and the website catalogue) are still separate editors, mounted as tabs under Commerce > Products. Unifying them is a later release.
- Plan names in the Admin screens use the same display names.
- Special arrangements belong to an existing client row: a brand-new prospect cannot be given special terms until their pre-sale record exists (create the standard deal or the prospect first, then the arrangement).
