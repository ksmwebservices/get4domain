-- Get4Domain V2 -> V3: read-only queries for the owner (STAGE 02, INV-8)
--
-- HOW TO RUN: open the Supabase SQL editor on the PRODUCTION project, signed in as the read-only role (audit_readonly) and run ONE query at a time.
-- CLAUDE DID NOT RUN THESE. They are written, not executed. Nothing here has been tested against production.
--
-- RULES THIS FILE FOLLOWS
--   * SELECT statements and comments only: nothing that changes data or structure, no COPY, no transaction control. (Query 11 asks the database about privileges; the words in its quotes are arguments, not commands.)
--   * No password, token, key, secret, hash or webhook column is selected, anywhere.
--   * Column and table names come from backend-api/prisma/schema.prisma at commit 3f9b169. Tables with no @@map keep their model name and must be quoted ("Vendor", "VendorCMS", "Subscription", "Invoice", "VendorProduct"); the rest are g4d_* names.
--   * Money columns named ...Paise are in paise (divide by 100 for rupees). Invoice.amount, gstAmount, totalAmount are in the unit the old app stored (paise for Commercial Engine invoices).
--   * Queries 1 to 8 show business names, subdomains, domains and money figures of your vendors. They select no email, phone, address or customer data. Keep the output private anyway.
--
-- WHAT YOU GET
--   1 the vendor list and the five candidate clients      5 site, add-ons, themes, media, versions
--   2 the current plan record (BillingTerm)               6 domains
--   3 the old subscription rows                           7 how much data each client has
--   4 payment records                                     8 wallet balance and movements
--   9 row counts for every module table (settles which modules are used live)
--   10 duplicate customers (decides the contact-table adapter)
--   11 a safety check that this role cannot write


-- ===== 1. Vendors: everyone, newest first (non-sandbox) =====
SELECT v.id, v."businessName", v.industry, v.subdomain, v."customDomain", v.status, v."isSandbox", v."expiresAt", v.source, v."createdAt"
FROM public."Vendor" v
WHERE v."isSandbox" = false AND v.role = 'VENDOR'
ORDER BY v."createdAt" DESC;

-- ===== 1b. The five candidate clients (the repo names these sites; confirm against query 1) =====
-- stepnrock, deebiphotography, allwintours, indianambulance, and the MR Travels client. ksm-quantum is the parent company site, not a client.
SELECT v.id, v."businessName", v.industry, v.subdomain, v."customDomain", v.status, v."expiresAt", v."createdAt"
FROM public."Vendor" v
WHERE v."isSandbox" = false
  AND (v.subdomain ILIKE ANY (ARRAY['stepnrock%', 'deebi%', 'allwin%', 'indianambulance%', 'mrtravels%', 'mr-travels%', 'mr_travels%'])
       OR v."businessName" ILIKE ANY (ARRAY['%step n rock%', '%stepnrock%', '%deebi%', '%allwin%', '%indian ambulance%', '%mr travels%', '%mr. travels%']))
ORDER BY v."createdAt";

-- ===== 1c. Vendors with a paid plan: any vendor with an ACTIVE or ACTIVE_PAYMENT_DUE current term =====
SELECT v.id, v."businessName", v.subdomain, v."customDomain", t."planKey", t."billingCycle", t.status AS term_status, t."periodEnd"
FROM public."Vendor" v
JOIN public.g4d_billing_terms t ON t."vendorId" = v.id AND t."isCurrent" = true
WHERE v."isSandbox" = false AND t.status IN ('ACTIVE', 'ACTIVE_PAYMENT_DUE')
ORDER BY t."periodEnd" NULLS LAST;


-- ===== 2. Current plan record per vendor (BillingTerm: Workspace or BOS, cycle, status, price, period) =====
SELECT v."businessName", v.subdomain, t."planKey", t."billingCycle", t."cycleMonths", t.status, t.source,
       t."listAmountPaise", t."discountPaise", t."netAmountPaise", t."gstMode", t."periodStart", t."periodEnd", t."graceDays",
       t."scheduledNextPlan", t."scheduledNextCycle", t."scheduledNextNetPaise", t."activatedAt", t."lapsedAt"
FROM public.g4d_billing_terms t
JOIN public."Vendor" v ON v.id = t."vendorId"
WHERE t."isCurrent" = true AND v."isSandbox" = false
ORDER BY v."businessName";

-- ===== 2b. Every term ever, with its status, to see history and lapses =====
SELECT v."businessName", t."planKey", t."billingCycle", t.status, t."isCurrent", t."netAmountPaise", t."periodStart", t."periodEnd", t."createdAt"
FROM public.g4d_billing_terms t
JOIN public."Vendor" v ON v.id = t."vendorId"
WHERE v."isSandbox" = false
ORDER BY v."businessName", t."createdAt";

-- ===== 2c. Special arrangements, discounts and pending plan changes =====
SELECT count(*) AS special_arrangements FROM public.g4d_special_arrangements;
SELECT count(*) AS billing_deals FROM public.g4d_billing_deals;
SELECT count(*) AS plan_change_requests FROM public.g4d_plan_change_requests;


-- ===== 3. Old subscriptions (Product x Plan, kept for history and the theme-change counters) =====
SELECT v."businessName", s.product, s.plan, s.status, s."startDate", s."endDate", s.amount, s."themeChangesUsed", s."themeChangesLimit"
FROM public."Subscription" s
JOIN public."Vendor" v ON v.id = s."vendorId"
WHERE v."isSandbox" = false
ORDER BY v."businessName", s."createdAt";


-- ===== 4. Payment records: platform invoices to the vendor =====
SELECT v."businessName", i."invoiceNumber", i.kind, i.status, i."planKey", i."billingCycle", i.amount, i."gstAmount", i."totalAmount",
       i."paidPaise", i."paidVia", i."paidAt", i."periodStart", i."periodEnd", i."createdAt"
FROM public."Invoice" i
JOIN public."Vendor" v ON v.id = i."vendorId"
WHERE v."isSandbox" = false
ORDER BY v."businessName", i."createdAt";

-- ===== 4b. Totals per vendor (count of invoices, paid count, paid total) =====
SELECT v."businessName", count(*) AS invoices, count(*) FILTER (WHERE i.status = 'PAID') AS paid_invoices,
       sum(i."totalAmount") FILTER (WHERE i.status = 'PAID') AS paid_total, max(i."paidAt") AS last_paid_at
FROM public."Invoice" i
JOIN public."Vendor" v ON v.id = i."vendorId"
WHERE v."isSandbox" = false
GROUP BY v."businessName"
ORDER BY v."businessName";

-- ===== 4c. Manual payments (UPI/QR proof) waiting or confirmed =====
SELECT count(*) AS manual_payment_submissions FROM public.g4d_manual_payment_submissions;


-- ===== 5. Site: status, version, pack, theme, add-ons =====
SELECT v."businessName", v.subdomain, c."siteStatus", c."siteVersion", c."publishedAt", c."packKey", c."designKey", c."themeId",
       (c.pages IS NOT NULL) AS has_pages, (c.draft IS NOT NULL) AS has_draft, c."updatedAt"
FROM public."VendorCMS" c
JOIN public."Vendor" v ON v.id = c."vendorId"
WHERE v."isSandbox" = false
ORDER BY v."businessName";

-- ===== 5b. Add-ons switched on per vendor (look for site_doc_v2, site_connected, leadspace, nav_v2, bos_custom) =====
SELECT v."businessName", a."addonKey", a.enabled, a."enabledAt"
FROM public.g4d_vendor_addons a
JOIN public."Vendor" v ON v.id = a."vendorId"
WHERE v."isSandbox" = false
ORDER BY v."businessName", a."addonKey";

-- ===== 5c. Purchased or assigned themes =====
SELECT v."businessName", e."themeKey", e.status, e."startsAt", e."endsAt", e."amountPaise", e."gstPaise"
FROM public.g4d_theme_entitlements e
JOIN public."Vendor" v ON v.id = e."vendorId"
WHERE v."isSandbox" = false
ORDER BY v."businessName", e."endsAt";

-- ===== 5d. Published versions and media per vendor =====
SELECT v."businessName",
       (SELECT count(*) FROM public.g4d_site_versions s WHERE s."vendorId" = v.id) AS site_versions,
       (SELECT count(*) FROM public.g4d_media_assets m WHERE m."vendorId" = v.id) AS media_files,
       (SELECT coalesce(sum(m.bytes), 0) FROM public.g4d_media_assets m WHERE m."vendorId" = v.id) AS media_bytes
FROM public."Vendor" v
WHERE v."isSandbox" = false
ORDER BY v."businessName";


-- ===== 6. Domains: the subdomain, the connected or registered domain, registrar status =====
SELECT v."businessName", v.subdomain, v."customDomain", d."domainName", d.source, d.registrar, d.status, d."mappingType", d."mappingVerifiedAt", d."expiresAt", d."pricePaise"
FROM public."Vendor" v
LEFT JOIN public.g4d_domain_registrations d ON d."vendorId" = v.id
WHERE v."isSandbox" = false AND (v."customDomain" IS NOT NULL OR d.id IS NOT NULL)
ORDER BY v."businessName";


-- ===== 7. How much data each vendor has (counts only) =====
SELECT v."businessName", v.subdomain,
       (SELECT count(*) FROM public."VendorProduct" p WHERE p."vendorId" = v.id) AS products,
       (SELECT count(*) FROM public.g4d_contacts x WHERE x."vendorId" = v.id) AS contacts,
       (SELECT count(*) FROM public.g4d_campaign_leads x WHERE x."vendorId" = v.id) AS leads,
       (SELECT count(*) FROM public.g4d_call_logs x WHERE x."vendorId" = v.id) AS call_logs,
       (SELECT count(*) FROM public.g4d_generic_invoices x WHERE x."vendorId" = v.id) AS domainapp_invoices,
       (SELECT count(*) FROM public.g4d_bos_documents x WHERE x."vendorId" = v.id) AS bos_documents,
       (SELECT count(*) FROM public.g4d_bos_payments x WHERE x."vendorId" = v.id) AS bos_payments,
       (SELECT count(*) FROM public.g4d_pos_sales x WHERE x."vendorId" = v.id) AS website_orders,
       (SELECT count(*) FROM public.g4d_team_members x WHERE x."vendorId" = v.id) AS team_members,
       (SELECT count(*) FROM public.g4d_messages x WHERE x."vendorId" = v.id) AS messages
FROM public."Vendor" v
WHERE v."isSandbox" = false
ORDER BY v."businessName";


-- ===== 8. Wallet: balance and movements per vendor (legacy wallet) =====
SELECT v."businessName", w.balance, w."totalCredited", w."totalDebited",
       (SELECT count(*) FROM public.g4d_wallet_transactions t WHERE t."vendorId" = v.id) AS movements,
       (SELECT max(t."createdAt") FROM public.g4d_wallet_transactions t WHERE t."vendorId" = v.id) AS last_movement
FROM public.g4d_wallets w
JOIN public."Vendor" v ON v.id = w."vendorId"
WHERE v."isSandbox" = false
ORDER BY w.balance DESC;


-- ===== 9. Row counts for every module table (one statement per group) =====

-- Core and CRM
SELECT 'Vendor' AS table_name, count(*) AS row_count FROM public."Vendor"
UNION ALL
SELECT 'g4d_team_members' AS table_name, count(*) AS row_count FROM public."g4d_team_members"
UNION ALL
SELECT 'VendorCMS' AS table_name, count(*) AS row_count FROM public."VendorCMS"
UNION ALL
SELECT 'g4d_site_versions' AS table_name, count(*) AS row_count FROM public."g4d_site_versions"
UNION ALL
SELECT 'g4d_media_assets' AS table_name, count(*) AS row_count FROM public."g4d_media_assets"
UNION ALL
SELECT 'VendorProduct' AS table_name, count(*) AS row_count FROM public."VendorProduct"
UNION ALL
SELECT 'g4d_catalog_items' AS table_name, count(*) AS row_count FROM public."g4d_catalog_items"
UNION ALL
SELECT 'g4d_records' AS table_name, count(*) AS row_count FROM public."g4d_records"
UNION ALL
SELECT 'g4d_contacts' AS table_name, count(*) AS row_count FROM public."g4d_contacts"
UNION ALL
SELECT 'g4d_campaign_leads' AS table_name, count(*) AS row_count FROM public."g4d_campaign_leads"
UNION ALL
SELECT 'g4d_call_logs' AS table_name, count(*) AS row_count FROM public."g4d_call_logs"
UNION ALL
SELECT 'g4d_leads' AS table_name, count(*) AS row_count FROM public."g4d_leads"
UNION ALL
SELECT 'g4d_lead_call_logs' AS table_name, count(*) AS row_count FROM public."g4d_lead_call_logs"
UNION ALL
SELECT 'g4d_messages' AS table_name, count(*) AS row_count FROM public."g4d_messages"
UNION ALL
SELECT 'g4d_quotes' AS table_name, count(*) AS row_count FROM public."g4d_quotes"
UNION ALL
SELECT 'SupportTicket' AS table_name, count(*) AS row_count FROM public."SupportTicket"
UNION ALL
SELECT 'g4d_notifications' AS table_name, count(*) AS row_count FROM public."g4d_notifications"
ORDER BY 1;

-- Money (legacy)
SELECT 'Subscription' AS table_name, count(*) AS row_count FROM public."Subscription"
UNION ALL
SELECT 'Invoice' AS table_name, count(*) AS row_count FROM public."Invoice"
UNION ALL
SELECT 'g4d_billing_terms' AS table_name, count(*) AS row_count FROM public."g4d_billing_terms"
UNION ALL
SELECT 'g4d_billing_deals' AS table_name, count(*) AS row_count FROM public."g4d_billing_deals"
UNION ALL
SELECT 'g4d_special_arrangements' AS table_name, count(*) AS row_count FROM public."g4d_special_arrangements"
UNION ALL
SELECT 'g4d_plan_change_requests' AS table_name, count(*) AS row_count FROM public."g4d_plan_change_requests"
UNION ALL
SELECT 'g4d_promo_redemptions' AS table_name, count(*) AS row_count FROM public."g4d_promo_redemptions"
UNION ALL
SELECT 'g4d_manual_payment_submissions' AS table_name, count(*) AS row_count FROM public."g4d_manual_payment_submissions"
UNION ALL
SELECT 'g4d_wallets' AS table_name, count(*) AS row_count FROM public."g4d_wallets"
UNION ALL
SELECT 'g4d_wallet_transactions' AS table_name, count(*) AS row_count FROM public."g4d_wallet_transactions"
UNION ALL
SELECT 'g4d_generic_invoices' AS table_name, count(*) AS row_count FROM public."g4d_generic_invoices"
UNION ALL
SELECT 'g4d_payment_records' AS table_name, count(*) AS row_count FROM public."g4d_payment_records"
UNION ALL
SELECT 'g4d_expenses' AS table_name, count(*) AS row_count FROM public."g4d_expenses"
UNION ALL
SELECT 'g4d_gst_filings' AS table_name, count(*) AS row_count FROM public."g4d_gst_filings"
UNION ALL
SELECT 'g4d_vendor_payment_config' AS table_name, count(*) AS row_count FROM public."g4d_vendor_payment_config"
UNION ALL
SELECT 'g4d_domain_registrations' AS table_name, count(*) AS row_count FROM public."g4d_domain_registrations"
UNION ALL
SELECT 'g4d_theme_entitlements' AS table_name, count(*) AS row_count FROM public."g4d_theme_entitlements"
UNION ALL
SELECT 'g4d_vendor_template_unlock' AS table_name, count(*) AS row_count FROM public."g4d_vendor_template_unlock"
ORDER BY 1;

-- Business operating system
SELECT 'g4d_bos_documents' AS table_name, count(*) AS row_count FROM public."g4d_bos_documents"
UNION ALL
SELECT 'g4d_bos_payments' AS table_name, count(*) AS row_count FROM public."g4d_bos_payments"
UNION ALL
SELECT 'g4d_bos_expenses' AS table_name, count(*) AS row_count FROM public."g4d_bos_expenses"
UNION ALL
SELECT 'g4d_bos_journal_entries' AS table_name, count(*) AS row_count FROM public."g4d_bos_journal_entries"
UNION ALL
SELECT 'g4d_bos_recurring' AS table_name, count(*) AS row_count FROM public."g4d_bos_recurring"
UNION ALL
SELECT 'g4d_stock_movements' AS table_name, count(*) AS row_count FROM public."g4d_stock_movements"
UNION ALL
SELECT 'g4d_pos_sales' AS table_name, count(*) AS row_count FROM public."g4d_pos_sales"
ORDER BY 1;

-- LeadSpace, messaging, social
SELECT 'g4d_leadspace_profiles' AS table_name, count(*) AS row_count FROM public."g4d_leadspace_profiles"
UNION ALL
SELECT 'g4d_lead_purses' AS table_name, count(*) AS row_count FROM public."g4d_lead_purses"
UNION ALL
SELECT 'g4d_lead_purse_entries' AS table_name, count(*) AS row_count FROM public."g4d_lead_purse_entries"
UNION ALL
SELECT 'g4d_lead_events' AS table_name, count(*) AS row_count FROM public."g4d_lead_events"
UNION ALL
SELECT 'g4d_lead_disputes' AS table_name, count(*) AS row_count FROM public."g4d_lead_disputes"
UNION ALL
SELECT 'g4d_consent_records' AS table_name, count(*) AS row_count FROM public."g4d_consent_records"
UNION ALL
SELECT 'g4d_campaign_pages' AS table_name, count(*) AS row_count FROM public."g4d_campaign_pages"
UNION ALL
SELECT 'g4d_campaigns' AS table_name, count(*) AS row_count FROM public."g4d_campaigns"
UNION ALL
SELECT 'g4d_social_accounts' AS table_name, count(*) AS row_count FROM public."g4d_social_accounts"
UNION ALL
SELECT 'g4d_social_posts' AS table_name, count(*) AS row_count FROM public."g4d_social_posts"
UNION ALL
SELECT 'g4d_wa_conversations' AS table_name, count(*) AS row_count FROM public."g4d_wa_conversations"
UNION ALL
SELECT 'g4d_whatsapp_message_logs' AS table_name, count(*) AS row_count FROM public."g4d_whatsapp_message_logs"
UNION ALL
SELECT 'g4d_kb_entries' AS table_name, count(*) AS row_count FROM public."g4d_kb_entries"
ORDER BY 1;

-- Industry modules
SELECT 'g4d_produce_orders' AS table_name, count(*) AS row_count FROM public."g4d_produce_orders"
UNION ALL
SELECT 'g4d_service_jobs' AS table_name, count(*) AS row_count FROM public."g4d_service_jobs"
UNION ALL
SELECT 'g4d_clinic_appointments' AS table_name, count(*) AS row_count FROM public."g4d_clinic_appointments"
UNION ALL
SELECT 'g4d_coaching_enrollments' AS table_name, count(*) AS row_count FROM public."g4d_coaching_enrollments"
UNION ALL
SELECT 'g4d_construction_projects' AS table_name, count(*) AS row_count FROM public."g4d_construction_projects"
UNION ALL
SELECT 'g4d_test_orders' AS table_name, count(*) AS row_count FROM public."g4d_test_orders"
UNION ALL
SELECT 'g4d_enrollments' AS table_name, count(*) AS row_count FROM public."g4d_enrollments"
UNION ALL
SELECT 'g4d_event_bookings' AS table_name, count(*) AS row_count FROM public."g4d_event_bookings"
UNION ALL
SELECT 'g4d_finance_cases' AS table_name, count(*) AS row_count FROM public."g4d_finance_cases"
UNION ALL
SELECT 'g4d_gym_classes' AS table_name, count(*) AS row_count FROM public."g4d_gym_classes"
UNION ALL
SELECT 'g4d_room_bookings' AS table_name, count(*) AS row_count FROM public."g4d_room_bookings"
UNION ALL
SELECT 'g4d_shipments' AS table_name, count(*) AS row_count FROM public."g4d_shipments"
UNION ALL
SELECT 'g4d_photo_shoots' AS table_name, count(*) AS row_count FROM public."g4d_photo_shoots"
UNION ALL
SELECT 'g4d_engagements' AS table_name, count(*) AS row_count FROM public."g4d_engagements"
UNION ALL
SELECT 'g4d_deals' AS table_name, count(*) AS row_count FROM public."g4d_deals"
UNION ALL
SELECT 'g4d_restaurant_orders' AS table_name, count(*) AS row_count FROM public."g4d_restaurant_orders"
UNION ALL
SELECT 'g4d_retail_products' AS table_name, count(*) AS row_count FROM public."g4d_retail_products"
UNION ALL
SELECT 'g4d_salon_appointments' AS table_name, count(*) AS row_count FROM public."g4d_salon_appointments"
UNION ALL
SELECT 'g4d_stationery' AS table_name, count(*) AS row_count FROM public."g4d_stationery"
UNION ALL
SELECT 'g4d_tech_projects' AS table_name, count(*) AS row_count FROM public."g4d_tech_projects"
UNION ALL
SELECT 'g4d_trips' AS table_name, count(*) AS row_count FROM public."g4d_trips"
UNION ALL
SELECT 'g4d_contracts' AS table_name, count(*) AS row_count FROM public."g4d_contracts"
ORDER BY 1;


-- ===== 10. Duplicate customers: contacts sharing a phone within one vendor (counts only) =====
SELECT v."businessName", count(*) AS duplicate_groups, sum(c.n) AS rows_in_groups
FROM (SELECT "vendorId", phone, count(*) AS n FROM public.g4d_contacts GROUP BY "vendorId", phone HAVING count(*) > 1) c
JOIN public."Vendor" v ON v.id = c."vendorId"
GROUP BY v."businessName"
ORDER BY rows_in_groups DESC;

-- ===== 10b. Same check for the call-list leads =====
SELECT v."businessName", count(*) AS duplicate_groups, sum(c.n) AS rows_in_groups
FROM (SELECT "vendorId", phone, count(*) AS n FROM public.g4d_campaign_leads GROUP BY "vendorId", phone HAVING count(*) > 1) c
JOIN public."Vendor" v ON v.id = c."vendorId"
GROUP BY v."businessName"
ORDER BY rows_in_groups DESC;


-- ===== 11. Safety check: this role must not be able to write (every answer must be false) =====
SELECT current_user AS role_name,
       has_table_privilege(current_user, 'public."Vendor"', 'INSERT') AS can_insert_vendor,
       has_table_privilege(current_user, 'public."Vendor"', 'UPDATE') AS can_update_vendor,
       has_table_privilege(current_user, 'public."Vendor"', 'DELETE') AS can_delete_vendor;
