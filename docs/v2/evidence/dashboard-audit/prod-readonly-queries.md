# Production queries run for the 2026-10-08 dashboard audit (SELECT-only)

Every query went through [q.js](q.js), which refuses anything that is not a single `SELECT`/`WITH` statement (no `;`, no DML/DDL keywords). Only **counts, flags and table/column shapes** were read; no passwords, tokens, API keys, secrets or customer personal data. Business figures that are not personal (a vendor's wallet balance, product prices/stock) are included where the finding needs them.

| # | Question | Query shape | Result |
|---|---|---|---|
| 1 | Vendor population | `count(*)`, `filter isSandbox`, `role='VENDOR' and not isSandbox` on `"Vendor"` | 46 total · 40 sandbox · 5 live (+1 admin) |
| 2 | Live vendors by industry | `group by industry` | retail 2 · travel 2 · photography 1 |
| 3 | Is the universal catalogue schema live? | `information_schema.columns` for `VendorProduct` | `stockQty`, `sku`, `status`, `reorderLevel`, `priceAmount`, `unit`, `industryType`, `sourceModel`… all present |
| 4 | Product tables | `count(*)` of `VendorProduct`, `g4d_catalog_items`, `g4d_retail_products`, `g4d_pos_sales` (+ `type='web'`) | 28 · 120 · 0 · 0 (web 0) |
| 5 | Per-live-vendor footprint | counts per vendor for products, billing terms, subscriptions, invoices | stepnrock 14 products, 1 term, 1 subscription, 2 invoices · mrtravels 7 · deebiphotography 7 · allwintours 0 · ksm-webtech-services 0 |
| 6 | Shape of stepnrock's 14 products | `count(column)` per column; `jsonb_object_keys(customFields)` counts | all have description/price/image/category/categoryId; 13 customFields; 12 `stockQty` (12–50); 0 sku/unit/reorderLevel; statuses "active" |
| 7 | Stock usage on CatalogItem | `count(*)`, `count(stock)` | 120 items, 0 with stock |
| 8 | Online-payment readiness | `g4d_vendor_payment_config` left-joined to live vendors: `enabled`, key present, secret present (booleans only) | 0 of 5 configured |
| 9 | Modules and add-ons | `g4d_vendor_modules`, `g4d_vendor_addons` for live vendors / stepnrock | 4 of 5 have module rows (all 6 optional modules ON); stepnrock addon `inventory_management` ON |
| 10 | Provider settings present | `g4d_platform_settings` `category, key, has_value` (value never selected) | ai: `anthropic_api_key`, `openai_api_key` (2026-08-11) · fast2sms: `api_key` · payment: razorpay id+secret · domain: `resellerclub_api_key`, `resellerclub_reseller_id` · company: name/address/gstin/pan/phone/email · no video, storage or WhatsApp rows |
| 11 | Sandbox hygiene | `count(*) filter (expiresAt < now())`; sandboxes with a wallet; FK delete rule on `g4d_wallets` | 39 expired, oldest expiry 2026-08-13; 39 of 40 have a wallet; `g4d_wallets_vendorId_fkey` is `RESTRICT` |
| 12 | Live feature usage | per live vendor: leads, expenses, contacts, customer invoices, records, team, campaigns, landing pages, CMS rows, domains, AI generations (`wallet_transactions` service like `ai_content%`) | leads: deebiphotography 5 · campaigns 1 + landing page 1: allwintours · CMS rows 3 · everything else 0 |
| 13 | Wallet balances (live vendors) | `balance` per live vendor | stepnrock ₹250 (one `ai_studio_bonus` ₹250) · deebiphotography ₹100 · ksm-webtech-services ₹100 · others ₹0 |
| 14 | Stepnrock billing term | `g4d_billing_terms` current row | `ACTIVE_PAYMENT_DUE`, WORKSPACE half-yearly, `aiCreditPaise` 25000, due 2026-10-10 |
| 15 | Themes | `g4d_website_themes` counts | 2 themes · 1 premium · 0 default · 0 with raw multi-page HTML |
| 16 | WhatsApp usage | `g4d_wa_conversations` count; `g4d_vendor_comms_settings` exists | 0 conversations |
| 17 | Migration state | `_prisma_migrations` rows for the commercial migrations | applied (finished) |

Nothing was inserted, updated or deleted in production. The write tests of this audit ran only against an isolated in-memory PostgreSQL ([commerce-trace.js](commerce-trace.js), [journeys-trace.js](journeys-trace.js), [ai-trace.js](ai-trace.js)).
