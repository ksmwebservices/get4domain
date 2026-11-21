import { Injectable } from '@nestjs/common';
import { TeamArea } from '../team/team-access';
import {
  checkAreas, checkPromoDraft, checkTeamInvite, PromoKind, VendorDepartment, VENDOR_DEPARTMENTS,
} from './core/gaps-core';
import { gapError } from './vendor-gaps.errors';
import { PromoDraftRow, TeamRow, VendorGapsStore, Who } from './vendor-gaps.store';

/** A site address a vendor may ask us to move: http or https, a real host name with a dot, no sign-in details, no address of this machine or a private network. */
export function checkSiteUrl(v: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof v !== 'string' || v.trim().length === 0 || v.length > 300) return { ok: false, error: 'Enter the web address of the site.' };
  let u: URL;
  try { u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(v.trim()) ? v.trim() : `https://${v.trim()}`); } catch { return { ok: false, error: 'Enter the web address of the site.' }; }
  const host = u.hostname.toLowerCase();
  if ((u.protocol !== 'https:' && u.protocol !== 'http:') || u.username || u.password) return { ok: false, error: 'Enter the web address of the site.' };
  if (!host.includes('.') || host === 'localhost' || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.endsWith('.local') || host.endsWith('.internal') || host.includes(':')) return { ok: false, error: 'Enter the address of a live website.' };
  return { ok: true, value: `${u.protocol}//${host}${u.pathname === '/' ? '' : u.pathname.replace(/\/+$/, '')}` };
}

const teamView = (r: TeamRow): { id: string; name: string; role: string; department: string | null; areas: string[]; status: string } => ({ id: r.id, name: r.name, role: r.role, department: r.department, areas: r.areas, status: r.status });
const draftView = (r: PromoDraftRow) => ({ id: r.id, kind: r.kind, channel: r.channel, title: r.title, body: r.body, status: r.status, createdAt: r.createdAt.toISOString() });

/**
 * The Wave 2 Part B vendor routes that have no home in an existing module: the move request (record only), promotion and social drafts (never posted), the team on the v3 contract, and next steps.
 * The vendor always comes from the verified principal, never from the URL or body.
 */
@Injectable()
export class VendorGapsService {
  constructor(private readonly store: VendorGapsStore) {}

  // ── B3: move an existing site (a record; no cutover is done here) ──
  async migrationRequests(vendorId: string) {
    const rows = await this.store.listMigrationRequests(vendorId);
    return { items: rows.map((r) => ({ id: r.id, siteUrl: r.siteUrl, status: r.status, createdAt: r.createdAt.toISOString() })) };
  }
  async requestMigration(vendorId: string, siteUrl: unknown, by: Who) {
    const u = checkSiteUrl(siteUrl);
    if (!u.ok) throw gapError(400, 'VENDOR_GAP_INVALID', u.error, { fields: { siteUrl: u.error } });
    const row = await this.store.openMigrationRequest(vendorId, u.value, by);
    if (!row) throw gapError(409, 'MIGRATION_REQUEST_OPEN', 'You already have a request open. We will update it here.');
    return { id: row.id, siteUrl: row.siteUrl, status: row.status, createdAt: row.createdAt.toISOString() };
  }

  // ── B8: promotion and social drafts ──
  async listDrafts(vendorId: string, kind: PromoKind, o: { archived?: boolean; page?: number; pageSize?: number }) {
    const page = Math.max(1, Math.floor(Number(o.page)) || 1); const pageSize = Math.min(100, Math.max(1, Math.floor(Number(o.pageSize)) || 25));
    const r = await this.store.listPromoDrafts(vendorId, kind, o.archived === true, (page - 1) * pageSize, pageSize);
    return { items: r.items.map(draftView), total: r.total, page, pageSize };
  }
  async createDraft(vendorId: string, kind: PromoKind, input: { channel?: unknown; title?: unknown; body?: unknown }, by: Who) {
    const c = checkPromoDraft(kind, input);
    if (!c.ok) throw gapError(400, 'VENDOR_GAP_INVALID', 'Some fields need fixing.', { fields: c.errors });
    return draftView(await this.store.createPromoDraft(vendorId, kind, c.value, by));
  }
  async archiveDraft(vendorId: string, kind: PromoKind, id: string) {
    const r = await this.store.archivePromoDraft(vendorId, kind, id);
    if (!r) throw gapError(404, 'PROMO_DRAFT_NOT_FOUND', 'That draft was not found.');
    return draftView(r);
  }

  // ── B9: team ──
  async listTeam(vendorId: string) {
    return { departments: [...VENDOR_DEPARTMENTS], items: (await this.store.listTeam(vendorId)).map(teamView) };
  }
  async inviteMember(vendorId: string, input: Parameters<typeof checkTeamInvite>[0]) {
    const c = checkTeamInvite(input);
    if (!c.ok) throw gapError(400, 'VENDOR_GAP_INVALID', 'Some fields need fixing.', { fields: c.errors });
    const row = await this.store.createTeamInvite(vendorId, c.value);
    if (!row) throw gapError(409, 'TEAM_MEMBER_EXISTS', 'Someone with this email is already on your team.');
    return teamView(row);
  }
  async changeMember(vendorId: string, id: string, input: { role?: unknown; department?: unknown; areas?: unknown }) {
    const current = await this.store.getTeamMember(vendorId, id);
    if (!current) throw gapError(404, 'TEAM_MEMBER_NOT_FOUND', 'That person was not found.');
    const errors: Record<string, string> = {}; const patch: { role?: string; department?: string | null; areas?: TeamArea[] } = {};
    if (input.role !== undefined) { if (typeof input.role === 'string' && input.role.trim().length > 0 && input.role.trim().length <= 60 && !/[<>]/.test(input.role)) patch.role = input.role.trim().replace(/\s+/g, ' '); else errors.role = 'Enter the role.'; }
    if (input.department !== undefined) {
      if (input.department === null || input.department === '') patch.department = null;
      else if ((VENDOR_DEPARTMENTS as readonly string[]).includes(String(input.department))) patch.department = String(input.department);
      else errors.department = 'Pick Sales, Support, Accounts or Marketing.';
    }
    if (input.areas !== undefined) { const a = checkAreas(input.areas, (patch.department ?? current.department) as VendorDepartment | null); if (a.ok) patch.areas = a.value; else errors.areas = a.error; }
    if (Object.keys(errors).length) throw gapError(400, 'VENDOR_GAP_INVALID', 'Some fields need fixing.', { fields: errors });
    const row = await this.store.updateTeamMember(vendorId, id, patch);
    if (!row) throw gapError(404, 'TEAM_MEMBER_NOT_FOUND', 'That person was not found.');
    return teamView(row);
  }
  async setMemberActive(vendorId: string, id: string, active: boolean) {
    const row = await this.store.setTeamStatus(vendorId, id, active ? 'active' : 'deactivated');
    if (!row) throw gapError(404, 'TEAM_MEMBER_NOT_FOUND', 'That person was not found.');
    return teamView(row);
  }

}
