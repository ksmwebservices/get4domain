import { TeamArea, memberHasArea } from '../../team/team-access';
import { isTeamMember, ShellPrincipal } from './shell-access';

/**
 * Who may be told what on the vendor Home screen (GET /v3/me/overview). PURE; the rules are DATA: change a row, not a branch.
 * The owner sees every part. A team member sees only the parts a row allows: the business and the site state are plain facts, the order count needs the
 * website area (like GET /v3/me/orders), and the customer count is OWNER only (like GET /v3/me/customers, which holds personal details).
 */
export type OverviewPart = 'business' | 'site' | 'orders' | 'customers';
export interface OverviewRule { owner: boolean; team: 'ANY' | readonly TeamArea[] | 'NONE'; /** the plan feature the matching list route needs; a Free plan gets locked:true and no number */ feature: string | null }

export const OVERVIEW_MATRIX: Readonly<Record<OverviewPart, OverviewRule>> = {
  business: { owner: true, team: 'ANY', feature: null },
  site: { owner: true, team: ['website'], feature: null },
  orders: { owner: true, team: ['website'], feature: 'requests.inbox' },
  customers: { owner: true, team: 'NONE', feature: 'crm.customers' },
};

export function overviewParts(p: ShellPrincipal): OverviewPart[] {
  const out: OverviewPart[] = [];
  for (const [part, rule] of Object.entries(OVERVIEW_MATRIX) as Array<[OverviewPart, OverviewRule]>) {
    if (!isTeamMember(p)) { if (rule.owner) out.push(part); continue; }
    if (rule.team === 'ANY' || (Array.isArray(rule.team) && rule.team.some((a) => memberHasArea(p.modules, a)))) out.push(part);
  }
  return out;
}
