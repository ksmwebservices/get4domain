import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StepContext } from '../src/provisioning/runner/job-runner.service';
import { DEFAULT_PROVISIONING_SETTINGS } from '../src/provisioning/settings/provisioning-settings';
import { StepError } from '../src/provisioning/provisioning.errors';
import { normaliseEmail, normalisePhone, parseBusinessInput, phoneKey, slugifySubdomain } from '../src/provisioning/steps/business-input';
import { BusinessVendors, NewBusinessVendor, UniqueViolation } from '../src/provisioning/vendors/business-vendors';
import { CreateVendorStep } from '../src/provisioning/steps/create-vendor.step';
import { AssignFreePlanStep } from '../src/provisioning/steps/assign-free-plan.step';
import { CreateFreeSiteDraftStep } from '../src/provisioning/steps/create-free-site-draft.step';
import { CmsDraftSiteProvisioner } from '../src/provisioning/site/cms-draft-site-provisioner';
import { SiteProvisioner } from '../src/provisioning/site/site-provisioner';
import { JobRow } from '../src/provisioning/provisioning.repository';

const INPUT = { businessName: 'Sri Ganesh Plumbing', track: 'handyman', category: 'plumber', ownerName: 'Ganesh Kumar', phone: '+91 98765 43210', email: 'Ganesh@Example.com', city: 'Chennai', language: 'en' };
const job = (over: Partial<JobRow> = {}): JobRow => ({
  id: 'job1', kind: 'BUSINESS_FREE_SITE', status: 'RUNNING', idempotencyKey: 'k', vendorId: null, input: INPUT, currentStep: null, attempt: 0, maxAttempts: 5, nextRunAt: new Date(), lockedBy: 'r', lockedUntil: null,
  lastErrorCode: null, lastErrorMessage: null, createdByType: 'STAFF', createdById: 'staff-1', finishedAt: null, createdAt: new Date(), updatedAt: new Date(), ...over,
});
const ctx = (over: Partial<StepContext> = {}, jobOver: Partial<JobRow> = {}): StepContext => {
  const j = job(jobOver);
  return { job: j, input: j.input, vendorId: j.vendorId, actor: { type: 'STAFF', id: 'staff-1', ip: null }, settings: { ...DEFAULT_PROVISIONING_SETTINGS }, now: new Date('2026-11-04T10:00:00Z'), ...over };
};

describe('business input', () => {
  it('normalises phone numbers: 10-digit Indian mobiles get +91, formatting is ignored', () => {
    for (const raw of ['+91 98765 43210', '098765 43210', '9876543210', '+91-9876543210', '0091 9876543210', '91 9876543210']) expect(normalisePhone(raw)).toBe('+919876543210');
    expect(normalisePhone('12345')).toBeNull();
    expect(normalisePhone('abc')).toBeNull();
    expect(normalisePhone('+44 20 7946 0958')).toBe('+442079460958');
  });
  it('phoneKey is the last 10 digits, so different spellings of one number match', () => {
    expect(phoneKey('+919876543210')).toBe('9876543210');
    expect(phoneKey(normalisePhone('098765 43210')!)).toBe(phoneKey(normalisePhone('+91 98765-43210')!));
  });
  it('lower-cases and trims email, refuses a malformed one', () => {
    expect(normaliseEmail('  Ganesh@Example.COM ')).toBe('ganesh@example.com');
    expect(normaliseEmail('not an email')).toBeNull();
    expect(normaliseEmail('a@b')).toBeNull();
  });
  it('slugifies a business name into a valid subdomain base', () => {
    expect(slugifySubdomain('Sri Ganesh Plumbing & Co.')).toBe('sri-ganesh-plumbing-co');
    expect(slugifySubdomain('  --  ')).toBe('site');
    expect(slugifySubdomain('A')).toBe('a-site');
    expect(slugifySubdomain('x'.repeat(80)).length).toBeLessThanOrEqual(40);
    expect(slugifySubdomain('Admin')).toBe('admin-site');
  });
  it('parseBusinessInput returns the cleaned business or throws a permanent INVALID_INPUT', () => {
    const ok = parseBusinessInput(INPUT);
    expect(ok).toMatchObject({ businessName: 'Sri Ganesh Plumbing', track: 'handyman', email: 'ganesh@example.com', phone: '+919876543210', phoneKey: '9876543210', language: 'en' });
    for (const bad of [null, {}, { ...INPUT, businessName: ' ' }, { ...INPUT, track: 'nope' }, { ...INPUT, email: 'x' }, { ...INPUT, phone: '12' }, { ...INPUT, ownerName: '' }, { ...INPUT, language: 'xx-yy-zz-long' }]) {
      let err: unknown; try { parseBusinessInput(bad); } catch (e) { err = e; }
      expect(err).toBeInstanceOf(StepError); expect(err).toMatchObject({ code: 'INVALID_INPUT', retryable: false });
    }
  });
});

class MemVendors extends BusinessVendors {
  rows: Array<NewBusinessVendor & { id: string; jobId: string }> = [];
  taken = new Set<string>();
  failNextCreateWith?: UniqueViolation;
  existing: Array<{ id: string; email: string; phone: string | null }> = [];
  async findDuplicate(email: string, key: string) {
    for (const r of [...this.existing, ...this.rows]) {
      if (r.email === email) return { id: r.id, matched: 'email' as const };
      if (r.phone && r.phone.replace(/\D/g, '').slice(-10) === key) return { id: r.id, matched: 'phone' as const };
    }
    return null;
  }
  async subdomainTaken(s: string) { return this.taken.has(s) || this.rows.some((r) => r.subdomain === s); }
  async exists(id: string) { return this.rows.some((r) => r.id === id); }
  async createForJob(jobId: string, d: NewBusinessVendor) {
    if (this.failNextCreateWith) { const e = this.failNextCreateWith; this.failNextCreateWith = undefined; throw e; }
    const id = `v${this.rows.length + 1}`;
    this.rows.push({ ...d, id, jobId });
    return { id };
  }
}

describe('CREATE_VENDOR', () => {
  const mk = () => { const v = new MemVendors(); const hash = jest.fn(async () => '$2a$10$random-unusable-hash'); return { v, hash, step: new CreateVendorStep(v, hash) }; };

  it('creates a PENDING vendor from a staff job: source STAFF, registeredByStaffId, normalised email and phone, a slug subdomain, an unusable random password', async () => {
    const { v, step, hash } = mk();
    const r = await step.run(ctx());
    expect(r.vendorId).toBe('v1'); expect(r.outputRef).toEqual({ vendorId: 'v1' });
    expect(v.rows[0]).toMatchObject({
      name: 'Ganesh Kumar', email: 'ganesh@example.com', businessName: 'Sri Ganesh Plumbing', phone: '+919876543210', industry: 'plumber', subdomain: 'sri-ganesh-plumbing',
      status: 'PENDING', source: 'STAFF', registeredByStaffId: 'staff-1', password: '$2a$10$random-unusable-hash', jobId: 'job1',
    });
    expect(hash).toHaveBeenCalledTimes(1);
  });

  it('a system job records source SYSTEM and no staff id', async () => {
    const { v, step } = mk();
    await step.run(ctx({ actor: { type: 'SYSTEM', id: null, ip: null } }, { createdByType: 'SYSTEM', createdById: null }));
    expect(v.rows[0]).toMatchObject({ source: 'SYSTEM', registeredByStaffId: null });
  });

  it('is idempotent: when the job already has its vendor it creates nothing', async () => {
    const { v, step } = mk();
    await step.run(ctx());
    const r = await step.run(ctx({ vendorId: 'v1' }, { vendorId: 'v1' }));
    expect(r.outputRef).toEqual({ vendorId: 'v1' }); expect(v.rows).toHaveLength(1);
  });

  it('a job that points at a vendor that no longer exists fails permanently', async () => {
    const { step } = mk();
    await expect(step.run(ctx({ vendorId: 'gone' }, { vendorId: 'gone' }))).rejects.toMatchObject({ code: 'UNKNOWN_VENDOR', retryable: false });
  });

  it('DUPLICATE by email: permanent DUPLICATE_BUSINESS naming the existing vendor, nothing created', async () => {
    const { v, step } = mk();
    v.existing.push({ id: 'old-1', email: 'ganesh@example.com', phone: null });
    const err = await step.run(ctx()).catch((e) => e);
    expect(err).toBeInstanceOf(StepError); expect(err).toMatchObject({ code: 'DUPLICATE_BUSINESS', retryable: false, extra: { existingVendorId: 'old-1', matchedOn: 'email' } });
    expect(v.rows).toHaveLength(0);
  });

  it('DUPLICATE by phone, however the number was typed', async () => {
    const { v, step } = mk();
    v.existing.push({ id: 'old-2', email: 'someone@else.com', phone: '098765 43210' });
    await expect(step.run(ctx())).rejects.toMatchObject({ code: 'DUPLICATE_BUSINESS', extra: { existingVendorId: 'old-2', matchedOn: 'phone' } });
  });

  it('a taken subdomain gets -2, -3 ...; a subdomain lost in a race moves on to the next one', async () => {
    const { v, step } = mk();
    v.taken.add('sri-ganesh-plumbing'); v.taken.add('sri-ganesh-plumbing-2');
    await step.run(ctx());
    expect(v.rows[0].subdomain).toBe('sri-ganesh-plumbing-3');
    const b = mk();
    b.v.failNextCreateWith = new UniqueViolation('subdomain');
    await b.step.run(ctx());
    expect(b.v.rows[0].subdomain).toBe('sri-ganesh-plumbing-2');
  });

  it('losing a race on the email is a DUPLICATE_BUSINESS, not a retry', async () => {
    const { v, step } = mk();
    v.failNextCreateWith = new UniqueViolation('email');
    await expect(step.run(ctx())).rejects.toMatchObject({ code: 'DUPLICATE_BUSINESS', retryable: false });
  });

  it('invalid input is a permanent INVALID_INPUT and nothing is created', async () => {
    const { v, step } = mk();
    await expect(step.run(ctx({ input: { ...INPUT, email: 'bad' } }))).rejects.toMatchObject({ code: 'INVALID_INPUT', retryable: false });
    expect(v.rows).toHaveLength(0);
  });
});

describe('ASSIGN_FREE_PLAN', () => {
  const sub = (fn: jest.Mock) => new AssignFreePlanStep({ provisionFreeSubscription: fn } as never);
  it('gives the vendor the Free plan of the track with source STAFF, whatever registrationProvisioning says', async () => {
    const fn = jest.fn(async () => ({ id: 'sub-1' }));
    const r = await sub(fn).run(ctx({ vendorId: 'v1' }));
    expect(fn).toHaveBeenCalledWith('v1', 'handyman', 'STAFF');
    expect(r.outputRef).toEqual({ subscriptionId: 'sub-1' });
  });
  it('needs the vendor from the earlier step', async () => {
    await expect(sub(jest.fn()).run(ctx())).rejects.toMatchObject({ code: 'UNKNOWN_VENDOR', retryable: false });
  });
  it('an unknown track or a missing Free plan is permanent; anything else is passed on to be classified', async () => {
    await expect(sub(jest.fn(async () => { throw new BadRequestException('Unknown track'); })).run(ctx({ vendorId: 'v1' }))).rejects.toMatchObject({ code: 'UNKNOWN_TRACK', retryable: false });
    await expect(sub(jest.fn(async () => { throw new NotFoundException({ code: 'UNKNOWN_PLAN', message: 'x' }); })).run(ctx({ vendorId: 'v1' }))).rejects.toMatchObject({ code: 'UNKNOWN_PLAN', retryable: false });
    const boom = new Error('db down');
    await expect(sub(jest.fn(async () => { throw boom; })).run(ctx({ vendorId: 'v1' }))).rejects.toBe(boom);
  });
});

describe('CREATE_FREE_SITE_DRAFT', () => {
  it('calls the SiteProvisioner port with the business and records the site id', async () => {
    const port: SiteProvisioner = { createDraftSite: jest.fn(async () => ({ siteId: 'site-1' })) };
    const r = await new CreateFreeSiteDraftStep(port).run(ctx({ vendorId: 'v1' }));
    expect(port.createDraftSite).toHaveBeenCalledWith({ vendorId: 'v1', track: 'handyman', category: 'plumber', businessName: 'Sri Ganesh Plumbing', language: 'en', city: 'Chennai', phone: '+919876543210' });
    expect(r.outputRef).toEqual({ siteId: 'site-1' });
  });
  it('needs the vendor from the earlier step', async () => {
    const port: SiteProvisioner = { createDraftSite: jest.fn() };
    await expect(new CreateFreeSiteDraftStep(port).run(ctx())).rejects.toMatchObject({ code: 'UNKNOWN_VENDOR', retryable: false });
    expect(port.createDraftSite).not.toHaveBeenCalled();
  });
});

describe('CmsDraftSiteProvisioner (the real adapter over the existing site code)', () => {
  function fakes(pack: { key: string; enabled: boolean; config: unknown } | null) {
    const cms = new Map<string, { id: string; vendorId: string; siteStatus: string; packKey: string | null; businessName?: string }>();
    const prisma = {
      categoryPack: { findUnique: jest.fn(async () => pack) },
      vendorCMS: {
        upsert: jest.fn(async ({ where, create, update }: { where: { vendorId: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
          const cur = cms.get(where.vendorId);
          if (cur) { Object.assign(cur, update); return cur; }
          const row = { id: `cms-${cms.size + 1}`, vendorId: where.vendorId, siteStatus: 'LIVE', packKey: null, ...create } as never as { id: string; vendorId: string; siteStatus: string; packKey: string | null };
          cms.set(where.vendorId, row); return row;
        }),
      },
    };
    const starter = { seed: jest.fn(async () => ({ filled: [], kept: [], itemsCreated: 3, designKey: 'd1' })) };
    return { cms, prisma, starter, adapter: new CmsDraftSiteProvisioner(prisma as never, starter as never) };
  }
  const input = { vendorId: 'v1', track: 'handyman', category: 'plumber', businessName: 'Sri Ganesh Plumbing', language: 'en', city: 'Chennai', phone: '+919876543210' };
  const seeded = { key: 'plumber', enabled: true, config: { seed: { tagline: 'x' } } };

  it('creates the site row as DRAFT (never published) and seeds it from the category pack as a draft', async () => {
    const f = fakes(seeded);
    const r = await f.adapter.createDraftSite(input);
    expect(r).toEqual({ siteId: 'cms-1' });
    expect(f.cms.get('v1')).toMatchObject({ siteStatus: 'DRAFT', packKey: 'plumber' });
    expect(f.starter.seed).toHaveBeenCalledWith('v1', 'plumber', { businessName: 'Sri Ganesh Plumbing', city: 'Chennai', phone: '+919876543210' }, 'draft');
  });

  it('runs twice without a second site: same id, status stays DRAFT', async () => {
    const f = fakes(seeded);
    const a = await f.adapter.createDraftSite(input); const b = await f.adapter.createDraftSite(input);
    expect(b).toEqual(a); expect(f.cms.size).toBe(1); expect(f.cms.get('v1')!.siteStatus).toBe('DRAFT');
  });

  it('a category with no pack, a disabled pack or a pack without starter content gets the neutral default: an empty DRAFT site', async () => {
    for (const pack of [null, { key: 'plumber', enabled: false, config: { seed: {} } }, { key: 'plumber', enabled: true, config: {} }]) {
      const f = fakes(pack);
      const r = await f.adapter.createDraftSite(input);
      expect(r.siteId).toBe('cms-1'); expect(f.cms.get('v1')!.siteStatus).toBe('DRAFT'); expect(f.starter.seed).not.toHaveBeenCalled();
    }
  });

  it('does not touch the legacy add-on table (the fake client has no vendorAddon, so any use would throw)', async () => {
    const f = fakes(seeded);
    await expect(f.adapter.createDraftSite(input)).resolves.toBeDefined();
    expect(Object.keys(f.prisma)).toEqual(['categoryPack', 'vendorCMS']);
  });
});
