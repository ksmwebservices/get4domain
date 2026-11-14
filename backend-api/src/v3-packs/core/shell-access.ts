import { TeamArea, memberHasArea } from '../../team/team-access';
import { NavTab } from './nav-core';

/**
 * What the vendor app needs to draw its menu, and who may be told what (Amendment 13 B12). PURE, and the rules are DATA: change a row, not a branch.
 *
 * The owner sees every section. A team member sees the sections their row allows and a tab list cut down by TEAM_TAB_AREA: the tabs that belong to money (billing, plan, domain, migration) are never in a
 * team member's list at all (not locked, absent), the rest need the area the member was given. Nothing here carries a price, an order, an invoice, a term date or a setting: those stay on the owner-only routes.
 */
export type ShellSection = 'navigation' | 'plan' | 'packs' | 'inbox';
export interface ShellRule { owner: boolean; team: 'ANY' | readonly TeamArea[] | 'NONE' }

export const SHELL_MATRIX: Readonly<Record<ShellSection, ShellRule>> = {
  navigation: { owner: true, team: 'ANY' },
  /** state words only: the plan state, the tier, paused or not. Never the term, the price or the orders. */
  plan: { owner: true, team: 'ANY' },
  /** which pack and add-ons are on, never a price */
  packs: { owner: true, team: 'ANY' },
  /** a count only (waiting and unread), never a sender, a subject or a text */
  inbox: { owner: true, team: ['communication', 'telecrm'] },
};

export type TabAudience = 'ANY' | 'OWNER_ONLY' | TeamArea;
/** The COMMON tabs a team member may see, by the area the member needs. A common tab not listed here is owner only (fail closed). */
export const TEAM_TAB_AREA: Readonly<Record<string, TabAudience>> = {
  website: 'website', industry: 'website', promotion: 'campaigns', crm: 'telecrm', telecrm: 'telecrm', accounting: 'accounts', social: 'campaigns', ai_studio: 'ai_studio', support: 'ANY',
  billing: 'OWNER_ONLY', plan: 'OWNER_ONLY', domain: 'OWNER_ONLY', migration: 'OWNER_ONLY',
};
/** Pack, capability and add-on tabs are the business's own work screens; their routes keep their own area checks. */
export const TEAM_SCOPE_DEFAULT: Readonly<Record<'PACK' | 'CAPABILITY' | 'ADDON', TabAudience>> = { PACK: 'ANY', CAPABILITY: 'ANY', ADDON: 'ANY' };

export interface ShellPrincipal { kind?: string; modules?: string[] }
export const isTeamMember = (p: ShellPrincipal): boolean => p.kind === 'team_member';

export function shellSections(p: ShellPrincipal): ShellSection[] {
  const out: ShellSection[] = [];
  for (const [section, rule] of Object.entries(SHELL_MATRIX) as Array<[ShellSection, ShellRule]>) {
    if (!isTeamMember(p)) { if (rule.owner) out.push(section); continue; }
    if (rule.team === 'ANY' || (Array.isArray(rule.team) && rule.team.some((a) => memberHasArea(p.modules, a)))) out.push(section);
  }
  return out;
}

/** The tab list as a team member may see it. The owner's list is returned unchanged. */
export function tabsFor(p: ShellPrincipal, tabs: readonly NavTab[]): NavTab[] {
  if (!isTeamMember(p)) return [...tabs];
  return tabs.filter((t) => {
    const aud: TabAudience = t.scope === 'COMMON' ? TEAM_TAB_AREA[t.key] ?? 'OWNER_ONLY' : TEAM_SCOPE_DEFAULT[t.scope];
    return aud === 'ANY' || (aud !== 'OWNER_ONLY' && memberHasArea(p.modules, aud));
  });
}
