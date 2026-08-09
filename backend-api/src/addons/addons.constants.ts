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

export const AVAILABLE_ADDONS: AddonDefinition[] = [
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
