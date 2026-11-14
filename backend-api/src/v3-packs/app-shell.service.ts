import { Injectable, Optional } from '@nestjs/common';
import { InboxService } from '../v3-mail/inbox.service';
import { NavTab } from './core/nav-core';
import { isTeamMember, ShellPrincipal, shellSections, ShellSection, tabsFor } from './core/shell-access';
import { PackEngineService } from './pack-engine.service';

export interface AppShell {
  actor: 'OWNER' | 'TEAM_MEMBER';
  /** the sections this caller was given, from the permission matrix (core/shell-access.ts) */
  sections: ShellSection[];
  navigation: { tabs: NavTab[]; pack: { key: string; name: string } | null; flags: { onlineMedicineCheckout: boolean } } | null;
  plan: { mode: string; level: string | null; tier: string | null; planState: string | null; paused: boolean } | null;
  packs: { primary: { key: string; name: string } | null; addons: Array<{ key: string; name: string; active: boolean }> } | null;
  /** a count only */
  inbox: { waiting: number; unread: number } | null;
}

/**
 * Everything the vendor app needs to draw its menu in ONE read-only answer, for the owner and for a team member (Amendment 13 B12). It composes three existing reads (the tab list, the add-on list, the inbox
 * badge) and cuts them by the permission matrix as data. It never returns a price, an order, an invoice, a term date or a setting, so it needs no owner guard: what is left is what a team member may know.
 */
@Injectable()
export class AppShellService {
  /** The inbox comes from the global mail module; where it is not loaded (a unit test of one module) the shell simply carries no count. */
  constructor(private readonly packs: PackEngineService, @Optional() private readonly inbox?: InboxService) {}

  async get(vendorId: string, who: ShellPrincipal): Promise<AppShell> {
    const sections = shellSections(who); const has = (s: ShellSection): boolean => sections.includes(s);
    const needNav = has('navigation') || has('plan') || has('packs');
    const [nav, addons, badge] = await Promise.all([
      needNav ? this.packs.navigation(vendorId) : null,
      has('packs') ? this.packs.myAddons(vendorId) : null,
      has('inbox') && this.inbox ? this.inbox.badge(vendorId) : null,
    ]);
    return {
      actor: isTeamMember(who) ? 'TEAM_MEMBER' : 'OWNER',
      sections,
      navigation: nav && has('navigation') ? { tabs: tabsFor(who, nav.tabs), pack: nav.pack ? { key: nav.pack.key, name: nav.pack.name } : null, flags: nav.flags } : null,
      plan: nav && has('plan') ? { mode: nav.mode, level: nav.level, tier: nav.tier, planState: nav.planState, paused: nav.paused } : null,
      packs: nav && addons ? { primary: nav.pack ? { key: nav.pack.key, name: nav.pack.name } : null, addons: addons.filter((a) => a.active || a.offered).map((a) => ({ key: a.key, name: a.name, active: a.active })) } : null,
      inbox: badge,
    };
  }
}
