import { IndustryConfig, IndustrySkin, QuickAction, CustomerPortalConfig, CustomerTab } from './types';
import { generalConfig } from './general';
import { travelConfig } from './travel';
import { restaurantConfig } from './restaurant';
import { clinicConfig } from './clinic';
import { hotelConfig } from './hotel';
import { salonConfig } from './salon';
import { gymConfig } from './gym';
import { realestateConfig } from './realestate';
import { educationConfig } from './education';
import { retailConfig } from './retail';
import { constructionConfig } from './construction';
import { eventsConfig } from './events';
import { financeConfig } from './finance';
import { automobileConfig } from './automobile';
import { logisticsConfig } from './logistics';
import { diagnosticsConfig } from './diagnostics';
import { photographyConfig } from './photography';
import { professionalConfig } from './professional';
import { agricultureConfig } from './agriculture';
import { coachingConfig } from './coaching';
import { technologyConfig } from './technology';

export * from './types';

export const INDUSTRY_CONFIGS: Record<string, IndustryConfig> = {
  general: generalConfig,
  travel: travelConfig,
  restaurant: restaurantConfig,
  clinic: clinicConfig,
  hotel: hotelConfig,
  salon: salonConfig,
  gym: gymConfig,
  realestate: realestateConfig,
  education: educationConfig,
  retail: retailConfig,
  construction: constructionConfig,
  events: eventsConfig,
  finance: financeConfig,
  automobile: automobileConfig,
  logistics: logisticsConfig,
  diagnostics: diagnosticsConfig,
  photography: photographyConfig,
  professional: professionalConfig,
  agriculture: agricultureConfig,
  coaching: coachingConfig,
  technology: technologyConfig,
};

// Canonical slug aliases: the marketing site (/industries, sitemap) uses these
// SEO slugs, while the DomainApp configs historically used different keys. Map
// them so /demo/[industry], seedVendor(), and the industries API all resolve the
// same canonical id to one config. Keeping both keys avoids a risky rename.
export const INDUSTRY_ALIASES: Record<string, string> = {
  healthcare: 'clinic',
  beauty: 'salon',
  fitness: 'gym',
};

/** Resolve a canonical/alias slug to its config key. */
export function resolveIndustryKey(key?: string | null): string | null {
  if (!key) return null;
  if (INDUSTRY_CONFIGS[key]) return key;
  const alias = INDUSTRY_ALIASES[key];
  return alias && INDUSTRY_CONFIGS[alias] ? alias : null;
}

/** Returns the config for `key` (accepts canonical aliases), falling back to `general`. */
export function getIndustryConfig(key?: string | null): IndustryConfig {
  const resolved = resolveIndustryKey(key);
  return resolved ? INDUSTRY_CONFIGS[resolved] : INDUSTRY_CONFIGS.general;
}

// ── Industry skin layer (2.1) ────────────────────────────────────────────────
// Per-industry accent [primary, dark] — drives the dashboard banner + accents.
const SKIN_ACCENTS: Record<string, [string, string]> = {
  travel: ['#0284c7', '#0369a1'], restaurant: ['#ea580c', '#c2410c'], clinic: ['#e11d48', '#be123c'],
  hotel: ['#7c3aed', '#6d28d9'], salon: ['#db2777', '#be185d'], gym: ['#16a34a', '#15803d'],
  realestate: ['#059669', '#047857'], education: ['#4f46e5', '#4338ca'], retail: ['#d97706', '#b45309'],
  construction: ['#78716c', '#57534e'], events: ['#c026d3', '#a21caf'], finance: ['#0891b2', '#0e7490'],
  automobile: ['#dc2626', '#b91c1c'], logistics: ['#2563eb', '#1d4ed8'], diagnostics: ['#0d9488', '#0f766e'],
  photography: ['#9333ea', '#7e22ce'], professional: ['#475569', '#334155'], agriculture: ['#65a30d', '#4d7c0f'],
  coaching: ['#ca8a04', '#a16207'], technology: ['#4338ca', '#3730a3'], general: ['#2563eb', '#1d4ed8'],
};

/** Derive a skin from a config — accent, greeting, and quick actions from the
 *  industry's own labels/tabs. Explicit `config.skin` (if ever authored) wins. */
export function deriveSkin(cfg: IndustryConfig): IndustrySkin {
  const [accentColor, accentColorDark] = SKIN_ACCENTS[cfg.key] ?? SKIN_ACCENTS.general;
  const quickActions: QuickAction[] = cfg.dashboardTabs.slice(0, 3).map((t) => ({
    key: t.key, label: t.label, icon: t.icon, href: `/dashboard/domain-app/${t.key}`,
  }));
  return {
    accentColor,
    accentColorDark,
    welcomeText: `Your ${cfg.label} workspace — manage ${cfg.entities.record.labelPlural.toLowerCase()}, ${cfg.entities.contact.labelPlural.toLowerCase()} and ${cfg.entities.catalogItem.labelPlural.toLowerCase()} in one place.`,
    quickActions,
  };
}

/** Config for `key` with its skin attached (used by the industries API). */
export function getIndustryConfigWithSkin(key?: string | null): IndustryConfig {
  const cfg = getIndustryConfig(key);
  return { ...cfg, skin: cfg.skin ?? deriveSkin(cfg) };
}

/** Lightweight list of all industries for dropdowns (key + label + icon). */
export function listIndustries(): { key: string; label: string; icon: string }[] {
  return Object.values(INDUSTRY_CONFIGS).map((c) => ({
    key: c.key,
    label: c.label,
    icon: c.icon,
  }));
}

// ── Customer portal layer (Customer Portal Upgrade) ──────────────────────────
// The /customer app is shaped per industry from the SAME config the vendor
// dashboard uses, so labels can never drift between the two sides.

/**
 * Industries whose customers do NOT browse a catalogue. These are bespoke,
 * quoted engagements — a construction client has a project, a finance client
 * has a case, an IT client has a sprint backlog. Their `catalogItem` label is
 * the generic "Service", which is an internal billing line, not a menu a
 * customer would shop from. Everyone else gets a real Catalog tab.
 */
const CUSTOMER_PORTAL_NO_CATALOG = new Set([
  'construction',
  'finance',
  'logistics',
  'professional',
  'technology',
]);

/** Industries that bill under a name other than "Invoices". */
const CUSTOMER_INVOICE_LABELS: Record<string, string> = {
  education: 'Fees',
  coaching: 'Fees',
  restaurant: 'Bills',
};

/** Lucide icon per record concept, keyed on the industry's own plural label. */
const CUSTOMER_RECORD_ICONS: Record<string, string> = {
  Bookings: 'CalendarCheck',
  Reservations: 'CalendarCheck',
  Orders: 'ClipboardList',
  Appointments: 'CalendarClock',
  Enrollments: 'GraduationCap',
  Enquiries: 'MessageSquare',
  Projects: 'HardHat',
  Cases: 'Briefcase',
  Engagements: 'Briefcase',
  Shipments: 'Truck',
  Jobs: 'Wrench',
  Transactions: 'FileText',
};

/** Lucide icon per catalogue concept, keyed on the industry's own plural label. */
const CUSTOMER_CATALOG_ICONS: Record<string, string> = {
  Menu: 'BookOpen',
  Products: 'Package',
  Produce: 'Sprout',
  Packages: 'Package',
  Services: 'Sparkles',
  'Room Types': 'BedDouble',
  'Membership Plans': 'Dumbbell',
  Courses: 'BookOpen',
  Properties: 'Building2',
  Tests: 'FlaskConical',
};

/**
 * Per-industry icon overrides where the label-keyed maps above would land on a
 * semantically wrong icon — two industries can share a record/catalogue label
 * ("Projects" for construction and IT, "Services" for a salon and a garage)
 * while meaning very different things to the customer looking at the tab.
 */
const CUSTOMER_RECORD_ICON_BY_KEY: Record<string, string> = {
  technology: 'Code2',   // "Projects", but a sprint board, not a building site
  gym: 'BadgeCheck',     // "Enrollments", but a membership, not a course
};
const CUSTOMER_CATALOG_ICON_BY_KEY: Record<string, string> = {
  clinic: 'Stethoscope', // "Services", but medical, not cosmetic
  automobile: 'Cog',     // "Services", but mechanical, not cosmetic
};

/**
 * Build the customer-portal tab set for an industry. Home and Support are
 * universal; Records is always present (a customer always has their own
 * history); Catalog is conditional per `CUSTOMER_PORTAL_NO_CATALOG`.
 */
export function deriveCustomerPortal(cfg: IndustryConfig): CustomerPortalConfig {
  const recordsLabel = cfg.entities.record.labelPlural;
  const catalogLabel = cfg.entities.catalogItem.labelPlural;
  const invoicesLabel = CUSTOMER_INVOICE_LABELS[cfg.key] ?? 'Invoices';
  const showCatalog = !CUSTOMER_PORTAL_NO_CATALOG.has(cfg.key);

  const tabs: CustomerTab[] = [
    { key: 'home', label: 'Home', icon: 'Home' },
    {
      key: 'records',
      label: recordsLabel,
      icon: CUSTOMER_RECORD_ICON_BY_KEY[cfg.key] ?? CUSTOMER_RECORD_ICONS[recordsLabel] ?? 'FileText',
    },
    ...(showCatalog
      ? [{
          key: 'catalog' as const,
          label: catalogLabel,
          icon: CUSTOMER_CATALOG_ICON_BY_KEY[cfg.key] ?? CUSTOMER_CATALOG_ICONS[catalogLabel] ?? 'Package',
        }]
      : []),
    { key: 'invoices', label: invoicesLabel, icon: 'Receipt' },
    { key: 'support', label: 'Support', icon: 'LifeBuoy' },
  ];

  return {
    tabs,
    recordsLabel,
    recordLabel: cfg.entities.record.label,
    catalogLabel,
    invoicesLabel,
    showCatalog,
  };
}
