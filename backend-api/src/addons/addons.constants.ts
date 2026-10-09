export interface AddonDefinition {
  key: string;
  label: string;
  description: string;
  category: string;
  defaultEnabled: boolean;
}

export interface ModuleDefinition {
  key: string;
  label: string;
  description: string;
  /** Wallet-gated modules are always visible/available regardless of plan. */
  walletGated: boolean;
  defaultEnabled: boolean;
}

// The 10 platform modules. wallet_billing + account are always on; ai_studio is
// available to everyone (wallet-gated, not plan-gated). Others are plan-gated
// and toggled per vendor by admin.
export const AVAILABLE_MODULES: ModuleDefinition[] = [
  { key: 'domainapp', label: 'DomainApp', description: 'Industry business workspace', walletGated: false, defaultEnabled: true },
  { key: 'growth_hub', label: 'Growth Hub', description: 'Campaigns, landing pages, social media', walletGated: false, defaultEnabled: false },
  { key: 'telecrm', label: 'TeleCRM', description: 'Calls, leads, follow-ups', walletGated: false, defaultEnabled: false },
  { key: 'ai_studio', label: 'AI Studio', description: 'AI content generation', walletGated: true, defaultEnabled: true },
  { key: 'communication_hub', label: 'Communication Hub', description: 'WhatsApp, SMS, Email unified inbox', walletGated: false, defaultEnabled: false },
  { key: 'website_manager', label: 'Website Manager', description: 'CMS engine + industry templates', walletGated: false, defaultEnabled: false },
  { key: 'customer_hub', label: 'Customer Hub', description: 'Customer-facing portal', walletGated: false, defaultEnabled: false },
  { key: 'analytics_hub', label: 'Analytics Hub', description: 'Cross-module reporting', walletGated: false, defaultEnabled: false },
  { key: 'wallet_billing', label: 'Wallet & Billing', description: 'Payments, subscriptions, usage', walletGated: false, defaultEnabled: true },
];

/** Vendors created on/after this instant get Dashboard v2 by default (KSM, Release 1A). Everyone created earlier keeps the old dashboard until KSM switches them. */
export const NAV_V2_DEFAULT_FROM = '2026-10-09T00:00:00.000Z';

export const AVAILABLE_ADDONS: AddonDefinition[] = [
  // Dashboard v2 (docs/v2/DASHBOARD_V2.md): a per-vendor switch, not a feature. Default: ON for vendors created on/after NAV_V2_DEFAULT_FROM, OFF for everyone else.
  { key: 'nav_v2', label: 'Dashboard v2 (ten departments)', description: 'Show the new department-wise dashboard', category: 'plan', defaultEnabled: false },
  // Marks a BOS Custom client (never a subscription plan): shows the BOS Custom department.
  { key: 'bos_custom', label: 'BOS Custom client', description: 'Custom engagement client', category: 'plan', defaultEnabled: false },
  // Dashboard menu mode, not a feature: ON shows the vendor only the Workspace-plan menu (get4domain_mvp/src/lib/workspace-menu.ts). Default off = unchanged menu.
  { key: 'workspace_menu', label: 'Workspace menu (trimmed)', description: 'Show only the Workspace-plan tabs; hide BOS-only and duplicate catalogue tabs', category: 'plan', defaultEnabled: false },
  // LeadSpace (Dispatch B): `leadspace` is the feature (granted by the registry to every plan); `leadspace_only` is a dashboard MODE like nav_v2: it shows the five-tab LeadSpace app instead of the full dashboard and is switched off when the vendor buys a plan.
  { key: 'leadspace', label: 'LeadSpace', description: 'A free landing page, verified leads and a prepaid wallet', category: 'marketing', defaultEnabled: false },
  { key: 'leadspace_only', label: 'LeadSpace-only account', description: 'Show the five-tab LeadSpace app instead of the full dashboard', category: 'plan', defaultEnabled: false },
  { key: 'fleet', label: 'Fleet Management', description: 'Vehicles, maintenance, assignment', category: 'operations', defaultEnabled: false },
  { key: 'driver', label: 'Driver Management', description: 'Drivers, duty, trip sheets', category: 'operations', defaultEnabled: false },
  { key: 'driver_outsourcing', label: 'Driver Outsourcing', description: 'External driver sourcing', category: 'operations', defaultEnabled: false },
  { key: 'hr_payroll', label: 'HR & Payroll', description: 'Staff, attendance, salary', category: 'hr', defaultEnabled: false },
  { key: 'table_management', label: 'Table Management', description: 'Tables, seating, reservations', category: 'operations', defaultEnabled: false },
  { key: 'appointment_scheduling', label: 'Appointment Scheduling', description: 'Slots, calendar, reminders', category: 'operations', defaultEnabled: false },
  { key: 'inventory_management', label: 'Inventory Management', description: 'Stock, purchase, alerts', category: 'operations', defaultEnabled: false },
  { key: 'batch_management', label: 'Batch Management', description: 'Batches, timetable, attendance', category: 'operations', defaultEnabled: false },
  { key: 'room_management', label: 'Room Management', description: 'Rooms, occupancy, housekeeping', category: 'operations', defaultEnabled: false },
  { key: 'project_management', label: 'Project Management', description: 'Projects, tasks, milestones', category: 'operations', defaultEnabled: false },
  { key: 'document_management', label: 'Document Management', description: 'Files, versions, sharing', category: 'operations', defaultEnabled: false },
  { key: 'attendance_tracking', label: 'Attendance Tracking', description: 'Check-in/out, logs', category: 'operations', defaultEnabled: false },
  { key: 'property_management', label: 'Property Management', description: 'Listings, availability', category: 'operations', defaultEnabled: false },
  { key: 'vendor_coordination', label: 'Vendor Coordination', description: 'Sub-vendors, assignments', category: 'operations', defaultEnabled: false },
  { key: 'gallery_management', label: 'Gallery Management', description: 'Albums, client galleries', category: 'operations', defaultEnabled: false },
];

export const ADDON_KEYS = new Set(AVAILABLE_ADDONS.map((a) => a.key));
export const MODULE_KEYS = new Set(AVAILABLE_MODULES.map((m) => m.key));
