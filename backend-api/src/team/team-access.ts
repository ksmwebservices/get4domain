/**
 * Canonical vocabulary for vendor team-member access areas + a normaliser.
 *
 * The team-invite UI historically stored loose display labels ('CRM', 'TeleCRM',
 * 'Campaigns', 'Accounts', 'Reports', 'My Page', 'Wallet'), and department presets
 * used the same. Server-side enforcement needs a single canonical vocabulary, so we
 * map every known label/key onto a `TeamArea`. Unknown values are dropped (a member
 * simply doesn't get that area).
 *
 * Note: there is one CRM backend (/crm = TeleCRM leads/calls), so both 'CRM' and
 * 'TeleCRM' map to the same 'telecrm' area.
 */
export type TeamArea =
  | 'telecrm'
  | 'campaigns'
  | 'communication'
  | 'accounts'
  | 'wallet'
  | 'website'
  | 'reports'
  | 'ai_studio';

const ALIASES: Record<string, TeamArea> = {
  crm: 'telecrm', telecrm: 'telecrm', 'tele crm': 'telecrm',
  campaigns: 'campaigns', campaign: 'campaigns', growth: 'campaigns', growth_hub: 'campaigns', 'growth hub': 'campaigns',
  communication: 'communication', communication_hub: 'communication', 'communication hub': 'communication', comms: 'communication',
  accounts: 'accounts', accounting: 'accounts', account: 'accounts',
  wallet: 'wallet', wallet_billing: 'wallet', 'wallet & billing': 'wallet', billing: 'wallet',
  website: 'website', website_manager: 'website', 'website manager': 'website', 'my page': 'website', mypage: 'website', cms: 'website',
  reports: 'reports', report: 'reports', analytics: 'reports', analytics_hub: 'reports', 'analytics hub': 'reports',
  ai: 'ai_studio', 'ai studio': 'ai_studio', ai_studio: 'ai_studio',
};

/** Map a stored `modules` value (array of loose labels/keys) → canonical areas. */
export function normalizeModules(raw: unknown): TeamArea[] {
  if (!Array.isArray(raw)) return [];
  const out = new Set<TeamArea>();
  for (const v of raw) {
    if (typeof v !== 'string') continue;
    const area = ALIASES[v.trim().toLowerCase()];
    if (area) out.add(area);
  }
  return [...out];
}

export function memberHasArea(modules: string[] | undefined, area: TeamArea): boolean {
  return Array.isArray(modules) && (modules as string[]).includes(area);
}
