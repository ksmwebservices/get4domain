// GENERATED — do not edit. Source: registry/features.ts (+ types.ts, state.ts). Run `npm run registry:build` after changing the registry.
// registry-hash: 6da5f03fb4b8e1ee
// Legacy dashboard address -> Dashboard v2 address. Applied ONLY for vendors with nav_v2 on (cookie g4d_nav_v2=1).
/* eslint-disable */

export const LEGACY_MAP: Record<string, string> = {
  "/dashboard/reports": "/dashboard/home/reports",
  "/dashboard/crm": "/dashboard/sales/leads?tab=board",
  "/dashboard/telecrm": "/dashboard/sales/leads?tab=queue",
  "/dashboard/customer-hub": "/dashboard/sales/portal",
  "/dashboard/ai-studio": "/dashboard/marketing/ai-studio",
  "/dashboard/campaigns": "/dashboard/marketing/campaigns?tab=campaigns",
  "/dashboard/landing-page": "/dashboard/marketing/campaigns?tab=landing",
  "/dashboard/my-website": "/dashboard/website/content",
  "/dashboard/domain-management": "/dashboard/website/domain",
  "/dashboard/embed": "/dashboard/website/widget",
  "/dashboard/website-engine": "/dashboard/website/readiness",
  "/dashboard/my-products": "/dashboard/commerce/products",
  "/dashboard/stock": "/dashboard/commerce/stock",
  "/dashboard/orders": "/dashboard/commerce/orders",
  "/dashboard/accounts": "/dashboard/finance/expenses",
  "/dashboard/team": "/dashboard/people/team",
  "/dashboard/hrm": "/dashboard/people/hr",
  "/dashboard/communication": "/dashboard/communication/inbox",
  "/dashboard/whatsapp-bot": "/dashboard/communication/whatsapp-bot",
  "/dashboard/notifications": "/dashboard/communication/notifications",
  "/dashboard/billing": "/dashboard/account/billing",
  "/dashboard/go-live": "/dashboard/account/billing?tab=golive",
  "/dashboard/my-services": "/dashboard/account/billing?tab=services",
  "/dashboard/invoices": "/dashboard/account/billing?tab=receipts",
  "/dashboard/wallet": "/dashboard/account/wallet",
  "/dashboard/settings": "/dashboard/account/profile",
  "/dashboard/support": "/dashboard/account/help",
  "/dashboard/stationery": "/dashboard/account/stationery",
  "/dashboard/domain-app": "/dashboard"
};
export const TAB_TARGETS: Record<string, string> = {
  "products": "/dashboard/commerce/products",
  "customers": "/dashboard/sales/customers",
  "invoices": "/dashboard/finance/invoices",
  "orders": "/dashboard/commerce/orders",
  "workspace": "/dashboard/commerce/workspace"
};
export const PRODUCT_TABS = ["products","catalog","menu","services","packages","courses","tests","plans","properties","produce"];
export const CUSTOMER_TABS = ["customers","clients","patients","buyers","members","students","guests"];
export const INVOICE_TABS = ["billing","invoicing","fees","transactions"];
export const ORDER_TABS = ["orders","bookings","appointments","enquiries","reservations","visits"];
