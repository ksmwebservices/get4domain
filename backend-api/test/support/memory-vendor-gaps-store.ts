import { PromoKind } from '../../src/v3-vendor-gaps/core/gaps-core';
import { MigrationRequestRow, PromoDraftRow, TeamRow, VendorGapsStore, Who } from '../../src/v3-vendor-gaps/vendor-gaps.store';

/** An in-memory twin of the Prisma vendor gaps store: every method takes the vendor and keeps one vendor's rows apart from another's. */
export class MemoryVendorGapsStore extends VendorGapsStore {
  migrations: Array<MigrationRequestRow & { open: boolean }> = []; drafts: PromoDraftRow[] = []; team: Array<TeamRow & { email: string | null; phone: string | null; password: string | null }> = [];
  private n = 0; private id = (p: string): string => `${p}_${String((this.n += 1)).padStart(8, '0')}`; private at = (): Date => new Date(1_700_000_000_000 + this.n * 1000);

  async listMigrationRequests(vendorId: string): Promise<MigrationRequestRow[]> { return this.migrations.filter((m) => m.vendorId === vendorId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); }
  async openMigrationRequest(vendorId: string, siteUrl: string, _by: Who): Promise<MigrationRequestRow | null> {
    if (this.migrations.some((m) => m.vendorId === vendorId && m.open)) return null;
    const row = { id: this.id('mig'), vendorId, siteUrl, status: 'RECEIVED', createdAt: this.at(), updatedAt: this.at(), open: true }; this.migrations.push(row); return row;
  }

  async listPromoDrafts(vendorId: string, kind: PromoKind, includeArchived: boolean, skip: number, take: number): Promise<{ items: PromoDraftRow[]; total: number }> {
    const all = this.drafts.filter((d) => d.vendorId === vendorId && d.kind === kind && (includeArchived || d.status === 'DRAFT')).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return { items: all.slice(skip, skip + take), total: all.length };
  }
  async createPromoDraft(vendorId: string, kind: PromoKind, row: { channel: string; title: string; body: string }, _by: Who): Promise<PromoDraftRow> {
    const d: PromoDraftRow = { id: this.id('dr'), vendorId, kind, ...row, status: 'DRAFT', createdAt: this.at(), updatedAt: this.at(), archivedAt: null }; this.drafts.push(d); return d;
  }
  async archivePromoDraft(vendorId: string, kind: PromoKind, id: string): Promise<PromoDraftRow | null> {
    const d = this.drafts.find((x) => x.id === id && x.vendorId === vendorId && x.kind === kind); if (!d) return null; d.status = 'ARCHIVED'; d.archivedAt = this.at(); return d;
  }

  private shown = (m: TeamRow): boolean => ['invited', 'active', 'deactivated'].includes(m.status);
  async listTeam(vendorId: string): Promise<TeamRow[]> { return this.team.filter((m) => m.vendorId === vendorId && this.shown(m)); }
  async getTeamMember(vendorId: string, id: string): Promise<TeamRow | null> { return this.team.find((m) => m.id === id && m.vendorId === vendorId && this.shown(m)) ?? null; }
  async createTeamInvite(vendorId: string, row: { name: string; email: string | null; phone: string | null; role: string; department: string | null; areas: string[] }): Promise<TeamRow | null> {
    if (row.email && this.team.some((m) => m.vendorId === vendorId && m.email === row.email && this.shown(m))) return null;
    const m = { id: this.id('tm'), vendorId, name: row.name, role: row.role, department: row.department, status: 'invited', areas: row.areas, createdAt: this.at(), lastLogin: null, email: row.email, phone: row.phone, password: null };
    this.team.push(m); return m;
  }
  async updateTeamMember(vendorId: string, id: string, patch: { role?: string; department?: string | null; areas?: string[] }): Promise<TeamRow | null> {
    const m = await this.getTeamMember(vendorId, id) as (TeamRow | null); if (!m) return null;
    if (patch.role !== undefined) m.role = patch.role; if (patch.department !== undefined) m.department = patch.department; if (patch.areas !== undefined) m.areas = patch.areas; return m;
  }
  async setTeamStatus(vendorId: string, id: string, status: 'deactivated' | 'active'): Promise<TeamRow | null> {
    const m = this.team.find((x) => x.id === id && x.vendorId === vendorId && this.shown(x)); if (!m) return null;
    m.status = status === 'active' && !m.password ? 'invited' : status; return m;
  }
}
