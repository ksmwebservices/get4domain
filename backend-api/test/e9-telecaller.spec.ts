import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { AdminTeamService } from '../src/admin-team/admin-team.service';
import { effectiveRolesFor } from '../src/auth/guards/admin-role-matrix';
import { validateExtraSetting } from '../src/plans/admin/extra-settings';
import { AdminVendorSiteService } from '../src/v3-admin-vendor-site/admin-vendor-site.service';
import { PartnersService } from '../src/v3-partners/partners.service';
import { ReferralsService } from '../src/v3-referrals/referrals.service';
import { checkPay, monitorView, startOfIndiaDay } from '../src/v3-telecaller/core/telecaller-core';
import { DEFAULT_TELECALLER_SETTINGS, resolveTelecallerSettings, TelecallerSettings, TelecallerSettingsService } from '../src/v3-telecaller/settings/telecaller-settings';
import { TelecallerCapService } from '../src/v3-telecaller/telecaller-cap.service';
import { TelecallerService } from '../src/v3-telecaller/telecaller.service';

/** E9c: pay type per telecaller, the daily cap (20), unconfirmed cash overdue after 60 days, ADMIN creating telecaller accounts, and the additive migration. */
const DAY = 86_400_000;
const NOW = new Date('2026-11-26T10:00:00+05:30');

describe('the two settings', () => {
  it('start at a cap of 20 and 60 days, as decided by the owner; a stored value wins; a bad stored value falls back (the cap cannot be switched off by accident)', async () => {
    expect(DEFAULT_TELECALLER_SETTINGS).toEqual({ telecallerDailyCap: 20, telecallerCashOverdueDays: 60 });
    expect(resolveTelecallerSettings(new Map<string, unknown>([['telecallerDailyCap', 5]]))).toEqual({ telecallerDailyCap: 5, telecallerCashOverdueDays: 60 });
    for (const bad of [0, -1, 1.5, '30', null]) expect(resolveTelecallerSettings(new Map([['telecallerDailyCap', bad]])).telecallerDailyCap).toBe(20);
    const read = new TelecallerSettingsService({ v3PlanSetting: { findMany: async () => [{ key: 'telecallerCashOverdueDays', valueJson: 45 }] } } as never);
    expect(await read.get()).toEqual({ telecallerDailyCap: 20, telecallerCashOverdueDays: 45 });
  });
  it('are changed through the one plan-settings API, which refuses anything that is not a whole number above zero', () => {
    for (const key of ['telecallerDailyCap', 'telecallerCashOverdueDays']) {
      expect(() => validateExtraSetting(key, 30)).not.toThrow();
      for (const bad of [0, -5, 2.5, 'ten', null]) expect(() => validateExtraSetting(key, bad)).toThrow(BadRequestException);
    }
    expect(effectiveRolesFor('PUT /v3/admin/plan-settings/:key')).toEqual(['SUPER_ADMIN']);
  });
});

describe('the pay type', () => {
  it('accepts a salaried telecaller with or without the amount yet, and a freelancer without a salary', () => {
    expect(checkPay({ payType: 'SALARY_PLUS_COMMISSION', monthlySalaryMinor: 1 })).toEqual({ ok: true, value: { payType: 'SALARY_PLUS_COMMISSION', monthlySalaryMinor: 1 } });
    expect(checkPay({ payType: 'SALARY_PLUS_COMMISSION' })).toEqual({ ok: true, value: { payType: 'SALARY_PLUS_COMMISSION', monthlySalaryMinor: null } });
    expect(checkPay({ payType: 'FREELANCE_SLAB', monthlySalaryMinor: null })).toEqual({ ok: true, value: { payType: 'FREELANCE_SLAB', monthlySalaryMinor: null } });
  });
  it('refuses an unknown type, a freelancer salary, and an amount that is not a whole number of paise above zero', () => {
    expect(checkPay({ payType: 'HOURLY' })).toMatchObject({ ok: false, problems: { payType: expect.any(String) } });
    expect(checkPay({})).toMatchObject({ ok: false });
    expect(checkPay({ payType: 'FREELANCE_SLAB', monthlySalaryMinor: 100 })).toMatchObject({ ok: false, problems: { monthlySalaryMinor: expect.any(String) } });
    for (const bad of [0, -1, 1.5, '1000', 2_147_483_648]) expect(checkPay({ payType: 'SALARY_PLUS_COMMISSION', monthlySalaryMinor: bad })).toMatchObject({ ok: false });
  });
});

function telecallers(o: { failProfile?: boolean; loginRole?: string; settings?: Partial<TelecallerSettings> } = {}) {
  const calls: Record<string, unknown[]> = { invite: [], create: [], upsert: [] };
  const rows = new Map<string, { partnerId: string; payType: string; monthlySalaryMinor: number | null; updatedAt: Date }>();
  const registry = new Map<unknown, unknown>([
    [AdminTeamService, { invite: async (d: unknown) => { calls.invite.push(d); return { id: 'login-1' }; } }],
    [PartnersService, { create: async () => ({ id: 'partner-1' }), forLogin: async () => ({ id: 'partner-1', name: 'Asha' }) }],
    [ReferralsService, { issueLink: async () => ({ code: 'ASHA-1' }) }],
  ]);
  const prisma = {
    referralPartner: { findUnique: async ({ where }: { where: { id: string } }) => (where.id === 'partner-1' ? { staffUserId: 'login-1' } : where.id === 'partner-free' ? { staffUserId: null } : null) },
    adminTeamMember: { findUnique: async () => ({ role: o.loginRole ?? 'TELECALLER' }), update: async () => ({}) },
    telecallerProfile: {
      create: async ({ data }: { data: { partnerId: string; payType: string } }) => { calls.create.push(data); if (o.failProfile) throw new Error('db'); rows.set(data.partnerId, { monthlySalaryMinor: null, updatedAt: NOW, ...data }); return data; },
      findUnique: async ({ where }: { where: { partnerId: string } }) => rows.get(where.partnerId) ?? null,
      upsert: async ({ where, create }: { where: { partnerId: string }; create: { partnerId: string; payType: string; monthlySalaryMinor: number | null } }) => { calls.upsert.push(create); const row = { ...create, updatedAt: NOW }; rows.set(where.partnerId, row); return row; },
    },
  };
  const svc = new TelecallerService({ get: (t: unknown) => registry.get(t) } as never, prisma as never, { get: async () => ({ ...DEFAULT_TELECALLER_SETTINGS, ...o.settings }) } as never);
  return { svc, calls, rows };
}
const person = { name: 'Asha K', email: 'asha@example.com' };

describe('creating an account with a pay type', () => {
  it('stores the chosen type as data; none chosen stores nothing', async () => {
    const a = telecallers(); expect(await a.svc.createEmployee({ ...person, payType: 'FREELANCE_SLAB' }, { id: 'admin-1' })).toMatchObject({ payType: 'FREELANCE_SLAB' });
    expect(a.calls.create).toEqual([{ partnerId: 'partner-1', payType: 'FREELANCE_SLAB', updatedById: 'admin-1' }]);
    const b = telecallers(); expect(await b.svc.createEmployee(person, { id: 'admin-1' })).toMatchObject({ payType: null }); expect(b.calls.create).toEqual([]);
  });
  it('an unknown type, or a salary typed at creation (ADMIN may create, only SUPER_ADMIN sets amounts), is a 400 and nobody is invited', async () => {
    for (const extra of [{ payType: 'HOURLY' }, { payType: 'SALARY_PLUS_COMMISSION', monthlySalaryMinor: 1_500_000 }]) {
      const a = telecallers(); await expect(a.svc.createEmployee({ ...person, ...extra }, { id: 'x' })).rejects.toBeInstanceOf(BadRequestException); expect(a.calls.invite).toEqual([]);
    }
  });
  it('if only the pay type cannot be saved, the account stays and the answer says no type is set', async () => {
    const a = telecallers({ failProfile: true }); expect(await a.svc.createEmployee({ ...person, payType: 'FREELANCE_SLAB' }, { id: 'x' })).toMatchObject({ partnerId: 'partner-1', payType: null, inviteSent: true });
  });
});

describe('the pay screen', () => {
  it('shows nothing set, then saves each of the two types; changing to freelancer clears the salary', async () => {
    const { svc } = telecallers();
    expect(await svc.payOf('partner-1')).toEqual({ partnerId: 'partner-1', payType: null, monthlySalaryMinor: null, updatedAt: null });
    expect(await svc.setPay('partner-1', { payType: 'SALARY_PLUS_COMMISSION', monthlySalaryMinor: 1_800_000 }, { id: 's' })).toMatchObject({ payType: 'SALARY_PLUS_COMMISSION', monthlySalaryMinor: 1_800_000 });
    expect(await svc.setPay('partner-1', { payType: 'FREELANCE_SLAB' }, { id: 's' })).toMatchObject({ payType: 'FREELANCE_SLAB', monthlySalaryMinor: null });
  });
  it('a bad setting is refused and nothing is written; a partner that is not a telecaller is not found', async () => {
    const a = telecallers(); await expect(a.svc.setPay('partner-1', { payType: 'X' }, { id: 's' })).rejects.toBeInstanceOf(BadRequestException); expect(a.calls.upsert).toEqual([]);
    for (const id of ['partner-free', 'ghost']) await expect(a.svc.payOf(id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(telecallers({ loginRole: 'REFERRAL_PARTNER' }).svc.setPay('partner-1', { payType: 'FREELANCE_SLAB' }, { id: 's' })).rejects.toBeInstanceOf(NotFoundException);
  });
  it('the settings view shows the values in force and the keys to change them', async () => {
    expect(await telecallers({ settings: { telecallerDailyCap: 7 } }).svc.settingsView()).toEqual({ dailyCap: 7, cashOverdueAfterDays: 60, payTypes: ['SALARY_PLUS_COMMISSION', 'FREELANCE_SLAB'], settingKeys: { dailyCap: 'telecallerDailyCap', cashOverdueAfterDays: 'telecallerCashOverdueDays' } });
  });
});

describe('unconfirmed cash is overdue after 60 days', () => {
  const view = (ages: number[], days = 60) => monitorView({ created: ages.length, paid: 0, waiting: ages.map((ageMs) => ({ ageMs })), overdueAfterDays: days, commission: [] });
  it('counts only cash older than the limit: exactly 60 days is not yet overdue', () => {
    expect(view([59 * DAY, 60 * DAY, 60 * DAY + 1, 200 * DAY])).toMatchObject({ cashWaitingForOffice: 4, cashOverdue: 2, cashOverdueAfterDays: 60, oldestWaitingDays: 200 });
    expect(view([31 * DAY], 30).cashOverdue).toBe(1); expect(view([]).cashOverdue).toBe(0);
  });
});

describe('the day of the cap is the day in India', () => {
  it('starts at midnight IST, which is 18:30 UTC the evening before', () => {
    expect(startOfIndiaDay(new Date('2026-11-26T10:00:00+05:30')).toISOString()).toBe('2026-11-25T18:30:00.000Z');
    expect(startOfIndiaDay(new Date('2026-11-25T18:30:00.000Z')).toISOString()).toBe('2026-11-25T18:30:00.000Z');
    expect(startOfIndiaDay(new Date('2026-11-25T18:29:59.999Z')).toISOString()).toBe('2026-11-24T18:30:00.000Z');
  });
});

function creating(o: { today: number; cap?: number }) {
  let made = o.today; const sent: Array<Record<string, unknown>> = []; const asked: unknown[] = [];
  const prisma = { vendor: { count: async (a: unknown) => { asked.push(a); return made; }, update: async () => undefined }, vendorCMS: { upsert: async () => undefined } };
  const cap = new TelecallerCapService(prisma as never, { get: async () => ({ ...DEFAULT_TELECALLER_SETTINGS, ...(o.cap ? { telecallerDailyCap: o.cap } : {}) }) } as never); cap.clock = () => NOW;
  const vendors = { create: async (d: Record<string, unknown>) => { await Promise.resolve(); sent.push(d); made++; return { id: `v${made}` }; } };
  const svc = new AdminVendorSiteService(vendors as never, { createMySite: async () => ({ url: 'https://x' }) } as never, { resolveSubdomain: async (s: string) => s } as never, prisma as never, { listableCategories: async () => ({ items: [{ key: 'plumber' }] }) } as never, cap);
  return { svc, sent, asked };
}
const business = { category: 'plumber', businessName: 'B', ownerName: 'O', phone: '+919876543210', email: 'a@b.invalid', city: 'Aluva', subdomain: 'b', duplicateOverrideReason: 'looks like another one' };
const tele = { id: 't1', role: 'MARKETING', label: 'TELECALLER' };

describe('the daily cap, applied where a business is created (both routes a telecaller login can use)', () => {
  it('lets the 20th business of the day through and refuses the 21st, counting from midnight in India', async () => {
    const ok = creating({ today: 19 }); await expect(ok.svc.create(business, tele)).resolves.toMatchObject({ vendorId: 'v20' });
    expect(ok.asked[0]).toEqual({ where: { registeredByStaffId: 't1', createdAt: { gte: new Date('2026-11-25T18:30:00.000Z') } } });
    const full = creating({ today: 20 }); await expect(full.svc.create(business, tele)).rejects.toBeInstanceOf(ConflictException); expect(full.sent).toEqual([]);
    await expect(creating({ today: 20 }).svc.create(business, { id: 't1', role: 'TELECALLER' })).rejects.toBeInstanceOf(ConflictException);   // the telecaller route names the role itself
  });
  it('follows the setting', async () => { await expect(creating({ today: 2, cap: 2 }).svc.create(business, tele)).rejects.toBeInstanceOf(ConflictException); });
  it('two requests at once cannot both take the last place', async () => {
    const w = creating({ today: 19 }); const r = await Promise.allSettled([w.svc.create(business, tele), w.svc.create(business, tele)]);
    expect(r.map((x) => x.status).sort()).toEqual(['fulfilled', 'rejected']); expect(w.sent).toHaveLength(1);
  });
  it('a telecaller never overrides the duplicate check', async () => { const w = creating({ today: 0 }); await w.svc.create(business, tele); expect(w.sent[0].duplicateOverrideReason).toBeUndefined(); });
  it('nobody else is capped or changed', async () => {
    for (const actor of [{ id: 'o', role: 'OPERATIONS' }, { id: 's', role: 'MARKETING' }, { id: 'f', role: 'MARKETING', label: 'FIELD_EXECUTIVE' }]) {
      const w = creating({ today: 500 }); await w.svc.create(business, actor); expect(w.sent[0].duplicateOverrideReason).toBe('looks like another one');
    }
  });
});

describe('who may do what', () => {
  it('ADMIN and SUPER_ADMIN create telecaller accounts; OPERATIONS, SALES and SUPPORT do not', () => { expect([...effectiveRolesFor('POST /v3/admin/telecallers')].sort()).toEqual(['ADMIN', 'SUPER_ADMIN']); });
  it('the salary is read and set by SUPER_ADMIN only', () => { for (const m of ['GET', 'PUT']) expect(effectiveRolesFor(`${m} /v3/admin/telecallers/:partnerId/pay`)).toEqual(['SUPER_ADMIN']); });
});

describe('the migration', () => {
  const sql = fs.readFileSync(path.resolve(__dirname, '../prisma/migrations/20270111100000_v3_e9_telecaller_pay/migration.sql'), 'utf8').split('\n').filter((l) => !l.startsWith('--')).join('\n');
  const statements = sql.split(';').map((s) => s.trim()).filter(Boolean);
  it('is additive: it creates one table and alters only that table, with row level security on, and seeds no amount', () => {
    expect(statements.length).toBeGreaterThan(0);
    for (const s of statements) expect(s).toMatch(/^(CREATE TABLE|ALTER TABLE) "g4d_telecaller_profiles"/);
    expect(sql).not.toMatch(/\bDROP\b|\bDELETE FROM\b|\bTRUNCATE\b|\bINSERT\b|\bUPDATE "|ALTER COLUMN|RENAME/i);
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
  });
});
