# Step N Rock — handover kit

For: **KSM** (go / no-go) and **Suresh** (owner of Step N Rock). Written 2026-10-08. Plain language on purpose. Evidence commands and test names are in section 6.

Step N Rock is on the **Workspace** plan. Orders are **order requests** — the customer sends their name, phone and address, the shop calls them and collects payment itself. There is **no online payment yet**.

---

## 1. What Suresh can do himself

Everything below is in his dashboard (`get4domain.com` → sign in). The website updates by itself — **a change shows on stepnrock within 30 seconds**, no rebuild.

### Add or change a product (My Products)
1. **My Products → Add Product**. Fill name, price (just the number, e.g. `1299`), description and category.
2. Photos: **Upload photo** for the main picture; **+** under *Gallery* for extra photos. Use the arrows to put them in order and the star to choose the main photo. png, jpg, webp or gif, up to 5 MB each. If a photo fails you now see why (too big, wrong type, server problem) — it is never silently ignored.
3. Shoes/clothes: type **sizes** (`7, 8, 9, 10`) and **colours** (`Black, White, Navy`) separated by commas. Customers pick them on the product page.
4. **Availability**: *Available*, *Out of stock* (shown on the site with an "Out of stock" label, cannot be ordered) or *Hidden* (not shown at all). The old **Hide / Show** button still works.
5. **Save**. Open the website — it is there.

### Categories
**My Products → Categories**: add, rename, show/hide, reorder (arrows) and delete. Deleting a category that has products makes you choose where they move — nothing is lost. The menu and filters on the website follow this list and its order (the first three show in the top menu).

### Stock
1. Open a product → tick **Track stock for this product** → enter how many you have now → optionally a **low-stock alert** number → Save.
2. From then on: **a website order takes stock off by itself**, a cancelled order puts it back, and customers can never order more than you have. They see only "In stock", "Few left" or "Out of stock" — never your numbers.
3. **A sale at the counter**: **My Products → Adjust stock** (or **Stock** in the menu) → *Remove stock* → reason **Shop sale** → quantity → done. (Until counter billing exists, this is how shop sales are recorded.)
4. Other reasons: **Damage or loss** (remove), **Return** (add), **Recount** (type the number you counted), **Opening stock**. You can never go below 0. Every change is kept in the product's **Stock history** (who, when, why, running total).
5. **Stock** in the menu lists everything tracked, with *Needs restocking* and *Out of stock* views.

### Orders
**Orders** in the menu. A new order arrives with the customer's **name, phone (tap to call) and delivery address**, the items and the total.
1. Call the customer and agree delivery/payment.
2. When they have paid you: **Mark as paid**.
3. If it will not happen: **Cancel order** — the stock goes back automatically.
You also get a bell notification for every new order.

### Leads and customers
Enquiries from the website's contact form land in **Leads & CRM** (and the **TeleCRM** call list) with a notification. Every website order also creates a lead with the customer's phone.

### AI Studio
**AI Studio** writes posts, captions, festival posters and more, paid from your **Wallet** (the plan includes a starting credit; top up under *Wallet*). If it cannot generate, the message now says why in plain words and **nothing is charged**. Your wallet is checked **before** anything is generated.

### Plan & Billing, Team, Settings
- **Plan & Billing**: your plan and invoices. **Team**: invite staff (staff with the products permission can use products, stock and orders). **Settings**: your details; to change name/e-mail/phone/password, ask Support.

---

## 2. What we do for him (not in the dashboard)

New pages, home-page banners and photos, wording/copy changes, the shop's About/Contact text, adding a custom domain (we do the DNS/server steps), turning on online payment when he has Razorpay keys, SEO set-up, anything that needs a developer. Send it on WhatsApp and we do it.

---

## 3. Known limits — stated plainly

1. **No online payment yet.** Orders are requests; Suresh collects payment himself. When he gets Razorpay keys we switch the mode (Payments page); nothing else changes.
2. **No automatic refund.** If a customer *pays online* and the item sold out in the meantime, the order is not created and the shop gets an urgent notification with the payment id — the **refund is done by hand in Razorpay**. (Not relevant while there is no online payment.)
3. **Shop sales are not billed on the screen yet.** Until Counter billing exists (design: [COUNTER_BILLING_DESIGN.md](COUNTER_BILLING_DESIGN.md)), a counter sale is recorded with **Adjust stock → Shop sale**; GST bills are made in **Invoices**.
4. **No "add a page" tool.** New website pages are done by us.
5. **Only the My Products stock is connected.** The older Retail/POS and Catalog screens keep their own separate stock and do **not** write stock history; Suresh's menu hides them so there is one catalogue.
6. **Low-stock alert fires when stock *drops to* the alert level.** A product created with a quantity already at or below its level shows in the **Low stock** list and the restock banner, but does not send a bell notification until it drops again.
7. **Counter-held items.** Stock counts one shop. Several locations, purchasing and valuation are BOS (the *What BOS adds* card on Home).
8. **Settings are read-only**; changes go through Support.
9. **Details still to confirm with Suresh** (they came from the original design, not from him): the e-mail in the footer (`support@stepnrock.com`), phone number, address and opening hours on Contact/About/footer, and the product reviews/ratings (none are collected, so the site shows none).
10. **AI providers are only proven with simulated providers.** Whether the live OpenAI/Anthropic keys have credit is checked on the server with `node scripts/ai-health.js` (see the VM sequence).

---

## 4. Welcome message (WhatsApp-ready)

> Hi Suresh 👋 Your Step N Rock dashboard is ready.
>
> ✅ Add or change products, photos, sizes and colours in **My Products** — the website updates within 30 seconds.
> ✅ Turn on **Track stock** for a product and the website shows In stock / Few left / Out of stock by itself.
> ✅ Customers send an **order request** with their name, phone and address. You'll see it in **Orders** (and get a notification). Call them, collect payment, tap **Mark as paid**.
> ✅ Sold something at the shop? **Adjust stock → Shop sale**.
> ✅ Enquiries land in **Leads & CRM**.
>
> Online payment isn't switched on yet — orders are requests for now. Need a new page, banner or any change on the site? Just message us here and we'll do it.

---

## 5. GO / NO-GO

"PASS" = proven by an automated test and, where it is a screen, by driving the real screen against an isolated copy of the system on 2026-10-08. Items marked **VM** only become true for Suresh after the matching step of the VM sequence below.

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Product add / edit / hide / delete from the dashboard shows on the site ≤ 60 s without a rebuild | **PASS** | measured **28.9 s** for rename, price, hide, stock-out and a new product (`scripts/e2e/stepnrock-live.js`, 27 checks) |
| 2 | Public site shows availability only — no raw stock, SKU or internal fields; the fake "10 in stock" is gone | **PASS** | `verify-stock.js` (whitelist), e2e payload check, `verify-storefront.mjs` |
| 3 | Out-of-stock badge, Add-to-cart disabled, quantity capped, cart re-checks live stock | **PASS** | storefront screens (browser), `verify-storefront.mjs` |
| 4 | Stock cannot be oversold: two orders of 2 against stock 3 → one succeeds, stock 1; never negative; all-or-nothing across lines | **PASS** | `verify-stock-pg.js` on real Postgres (PGlite, 12 simultaneous orders vs 5 units → exactly 5), `verify-stock.js` (random sequence of 160 operations) |
| 5 | Order request: customer, phone, address, idempotent double-tap, vendor sees it, Mark paid / Cancel restores stock | **PASS** | real UI end-to-end (order sent, shown in Orders, cancelled, stock back to 6), `verify-stock.js`, e2e |
| 6 | Every stock change writes a movement in the same transaction, with correct running balance | **PASS** | ledger check after every random step; source scan in `verify-categories-stock-ui.js` shows only StockService writes VendorProduct stock |
| 7 | Adjust stock (add/remove/set, reasons, note, never below 0, history), Low stock list | **PASS** | real UI + `verify-categories-stock-ui.js` (screen rules equal the server's) |
| 8 | Notifications: new order, low stock (when it drops to the level), new lead; only the vendor's own; real unread count | **PASS** | real UI, `verify-workspace.js` (isolation, cross-vendor mark-read blocked) |
| 9 | Categories: create, rename, reorder, hide, delete-with-move (blocked without a destination); site filters, header and footer follow them | **PASS** | `verify-categories-stock-ui.js`, real UI + storefront |
| 10 | Image upload: formats, content check, 5 MB limit, SVG scripts refused, served URL reachable, clear errors | **PASS** (tests) · **VM**: upload one photo from the dashboard after deploy | `verify-uploads.js` (29 checks) |
| 11 | Custom domain: no hard-coded host (`SITE_URL`), sitemap/robots, CORS accepts the domain, runbook | **PASS** (code/tests) · DNS/nginx steps are KSM's | `verify-cors.js`, `CUSTOM_DOMAIN_RUNBOOK.md` |
| 12 | AI Studio: wallet checked before the call, debit only on success, OpenAI⇄Claude fallback, specific errors, images saved to our storage | **PASS** with simulated providers · **VM**: `node scripts/ai-health.js` must PASS | `verify-ai.js` (41 checks) |
| 13 | Stepnrock billing term: current term corrected to 7 days + 7 grace; exactly one open activation invoice | **PASS** (dry run on production data, nothing written) · **VM**: `fix-stepnrock-term.js --apply` | dry run output: INV-0005 void, INV-0006 open, term grace 2 → 7 |
| 14 | Deal builder refuses a second activation; vendor Audit trail now shows invoice/term actions | **PASS** | `verify-term-guard.js` (45 checks) |
| 15 | Workspace menu: only the Workspace tabs, no BOS items or duplicate catalogue tabs; Plan & Billing present; one "What BOS adds" card; Settings no longer fake | **PASS** (real UI: 15 menu items listed) · **VM**: `set-vendor-access.js --apply` | `verify-workspace-menu.mjs` (38 checks) |
| 16 | Other vendors unchanged: payments, wallet, theme unlock, checkout tamper tests, invoices, admin nav | **PASS** | security suites + `verify:commercial` all green |
| 17 | Invented content removed from the storefront (fake reviews, stats, chat bot answers, coupon, shipping fee, returns/warranty claims) | **PASS** | `verify-storefront.mjs` |
| 18 | New database migration applies cleanly with existing data | **PASS** | PGlite rehearsal in `verify-stock-pg.js`; `verify:migrations` |
| 19 | **Online payment for Step N Rock** | **FAIL — not available** (needs Suresh's Razorpay keys) | orders are requests until then |
| 20 | **Counter billing on screen** | **FAIL — not built** (designed) | `COUNTER_BILLING_DESIGN.md` |
| 21 | **Automatic refund when a paid item sells out** | **FAIL — not built** | known limit 2 |
| 22 | **Retail/POS and Catalog stock history** | **FAIL — not covered** (screens hidden for Step N Rock) | known limit 5 |
| 23 | **Live AI keys proven** | **NOT PROVEN until the VM check** | run `ai-health.js` |
| 24 | **Footer/contact details confirmed by Suresh** | **NOT CONFIRMED** | known limit 9 |

**Recommendation:** GO for handover as **order-request shop** once VM steps 1–9 below are done and the smoke list passes. Do not promise online payment, counter billing or automatic refunds.

---

## 6. How the evidence is produced

```bash
cd backend-api && npx nest build && npm run verify:commercial   # all suites; PGlite one needs G4D_PGLITE_DIR
node scripts/security-verify/run-all.js
node scripts/e2e/stepnrock-live.js                              # full-stack: live-edit timing, orders (needs the stepnrock build + PGlite)
cd ../get4domain_mvp && npx tsc --noEmit && npm run audit:vendor-dark && npm run build
cd ../stepnrock && npm run verify && npm run build
```

---

## 7. VM sequence (for KSM) — all commands in the **VM terminal** unless marked HOST

The VM repo path is `/srv/get4domain-site` (see `DEPLOYMENT.md`). Only **one** new migration is pending in production: `20261008120000_stepnrock_handover` (additive).

```bash
# 1. VM terminal — get the code
cd /srv/get4domain-site && git pull origin get4domain-site

# 2. VM terminal — apply the one pending migration (additive: new columns + the stock-history table)
cd backend-api && npx prisma migrate deploy

# 3. VM terminal — rebuild + restart the API
docker compose build --no-cache && docker compose up -d --force-recreate
docker compose logs --tail=50 backend            # expect "Nest application successfully started"

# 4. VM terminal — rebuild the dashboard
cd ../get4domain_mvp && docker compose build --no-cache && docker compose up -d --force-recreate

# 5. VM terminal — rebuild the Step N Rock site (SITE_URL = the address customers use; use the custom domain once it is live)
cd ../stepnrock && export SITE_URL=https://stepnrock.get4domain.com
docker compose build --no-cache && docker compose up -d --force-recreate

# 6. VM terminal (HOST, not inside a container) — tools that talk to the database
cd ../backend-api && npm ci && npx prisma generate && npx nest build
set -a; . ./.env; set +a

# 7. HOST — are the AI keys alive? (prints PASS/FAIL per provider; add --image to also test pictures, costs a few rupees)
node scripts/ai-health.js

# 8. HOST — put Step N Rock on the Workspace menu + order requests. Read the dry run first.
node scripts/set-vendor-access.js
SET_VENDOR_ACCESS_CONFIRM=I_HAVE_READ_THE_DRY_RUN node scripts/set-vendor-access.js --apply

# 9. HOST — correct the billing term (payment due in 7 days, grace 7). Read the dry run first.
node scripts/fix-stepnrock-term.js
STEPNROCK_TERM_FIX_CONFIRM=I_HAVE_READ_THE_DRY_RUN node scripts/fix-stepnrock-term.js --apply
```

**Custom domain** (when Suresh has one) — follow [CUSTOM_DOMAIN_RUNBOOK.md](CUSTOM_DOMAIN_RUNBOOK.md): DNS records (Cloudflare or registrar), nginx `server_name`, SSL (Cloudflare Flexible: no certbot), then step 5 again with `SITE_URL=https://<domain>`. `CORS_EXTRA_ORIGINS` is only needed if the API is ever switched to `CORS_MODE=strict`.

### Smoke list for Suresh's flows (after step 9)
1. Sign in as Suresh → the menu shows exactly: Home, My Products, Stock, Orders, Leads & CRM, TeleCRM, Website Manager, Domain, AI Studio, Invoices, Expenses, Wallet, Team, Plan & Billing, Settings. No HRM, Growth Hub, WhatsApp Bot, Catalog or Retail tabs. Home shows the *What BOS adds* card.
2. My Products → open a product → Track stock, quantity 5, low-stock alert 2 → Save. The product card shows "5 in stock".
3. Change its price → open stepnrock.get4domain.com → the new price shows within 30 seconds.
4. Upload a photo (main + one gallery photo) → both show on the product page. (Confirms the uploads volume on the VM.)
5. On the website add it to the cart, send an order request with name, phone, address → "Order request sent". In the dashboard: **Orders** shows it with phone and address, bell shows a notification, stock is now 3.
6. **Cancel order** → stock back to 5. Send another and **Mark as paid** → status Paid.
7. Adjust stock → Remove 1, reason Shop sale → history shows it; try removing 99 → refused ("you only have …").
8. Set the product to *Out of stock* → the website shows the label and the Add button is disabled; set *Available* again.
9. Categories → add "Kids", reorder, hide it → site filter/menu follow within 30 s.
10. AI Studio → generate a social post → text appears, wallet drops once. (If it fails, the message says why and the wallet is unchanged; run step 7 again.)
11. Admin → Customers → Step N Rock → Billing: one open invoice, due date 7 days out, Audit trail lists the invoice and term actions.
12. Another vendor's dashboard (not Step N Rock) looks exactly as before.
