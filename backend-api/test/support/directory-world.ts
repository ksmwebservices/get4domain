import { DirectoryAdminService } from '../../src/directory/directory-admin.service';
import { DirectoryReadService } from '../../src/directory/directory-read.service';
import { DirectoryVisitService } from '../../src/directory/directory-visit.service';
import { DEFAULT_B3_SETTINGS } from '../../src/b3-settings/b3-settings';
import { DirectoryRemovalService } from '../../src/directory/directory-removal.service';
import { AccountSetupGrantService } from '../../src/directory/grants/account-setup-grant.service';
import { MeDirectoryService } from '../../src/directory/me-directory.service';
import { OtpPepper } from '../../src/directory/pepper';
import { DEFAULT_DIRECTORY_SETTINGS, DirectorySettings } from '../../src/directory/settings/directory-settings';
import { SmsAdapter } from '../../src/directory/sms/sms-adapter';
import { ClaimOtpService } from '../../src/provisioning/claims/claim-otp.service';
import { BusinessRow } from '../../src/directory/directory.repository';
import { MemoryDirectoryAudit, MemoryDirectoryRepo } from './memory-directory-repo';

export const T0 = new Date('2026-11-05T10:00:00.000Z');
export const STAFF = { type: 'STAFF' as const, id: 'staff-1', ip: null };
export const PHONE = '+919876543210';

export class FakeSms extends SmsAdapter {
  sandbox = true; sent: Array<{ to: string; body: string }> = []; failNext = false;
  async isSandbox() { return this.sandbox; }
  async send(to: string, body: string) { if (this.failNext) { this.failNext = false; throw new Error('provider down'); } this.sent.push({ to, body }); }
}

/** A fake of the slice 5.3 ClaimsService: peek/redeem over an in-memory token table. redeemClaim is atomic (the second caller throws), like the real one. */
export class FakeClaims {
  tokens = new Map<string, { tokenId: string; vendorId: string; businessName: string; used: boolean }>(); redeemed = 0;
  add(raw: string, vendorId: string, businessName = 'Acme') { this.tokens.set(raw, { tokenId: `ct-${raw}`, vendorId, businessName, used: false }); }
  async peek(raw: string) { const t = this.tokens.get(raw); return t && !t.used ? { tokenId: t.tokenId, vendorId: t.vendorId, businessName: t.businessName } : null; }
  async redeemClaim(raw: string) { const t = this.tokens.get(raw); if (!t || t.used) throw new Error('CLAIM_INVALID'); t.used = true; this.redeemed++; return { vendorId: t.vendorId }; }
}

export interface DirectoryWorld {
  repo: MemoryDirectoryRepo; audit: MemoryDirectoryAudit; sms: FakeSms; claims: FakeClaims; now: { t: Date }; settings: { over: Partial<DirectorySettings> };
  visits: DirectoryVisitService; read: DirectoryReadService; admin: DirectoryAdminService; removal: DirectoryRemovalService; me: MeDirectoryService; grants: AccountSetupGrantService; otp: ClaimOtpService; pepper: OtpPepper;
  ids: { tn: string; chennaiDistrict: string; chennaiCity: string; madurai: string; family: string; plumber: string; electrician: string; dentist: string };
  biz(o?: Partial<BusinessRow> & { name?: string }): Promise<BusinessRow>;
}

export async function directoryWorld(): Promise<DirectoryWorld> {
  const repo = new MemoryDirectoryRepo(); const audit = new MemoryDirectoryAudit(); const sms = new FakeSms(); const claims = new FakeClaims();
  const now = { t: new Date(T0) }; const settings = { over: {} as Partial<DirectorySettings> };
  repo.clock = () => new Date(now.t);
  const settingsService = { get: async (): Promise<DirectorySettings> => ({ ...DEFAULT_DIRECTORY_SETTINGS, ...settings.over }), readPublicAppUrl: async () => 'https://staging.get4domain.invalid' };
  const pepper = new OtpPepper(); pepper.env = {};
  const read = new DirectoryReadService(repo, settingsService); read.clock = () => new Date(now.t);
  const admin = new DirectoryAdminService(repo, audit, settingsService, read, pepper); admin.clock = () => new Date(now.t);
  const removal = new DirectoryRemovalService(repo, audit, settingsService, sms, read); removal.clock = () => new Date(now.t);
  const me = new MeDirectoryService(repo, admin, audit, read);
  const visits = new DirectoryVisitService(repo, { get: async () => ({ ...DEFAULT_B3_SETTINGS, directoryVisitDedupeSeconds: 0 }) } as never, pepper); visits.clock = () => new Date(now.t);
  const grants = new AccountSetupGrantService(repo, audit); grants.clock = () => new Date(now.t);
  const otp = new ClaimOtpService(claims as never, repo, settingsService, sms, grants, admin, audit, pepper); otp.clock = () => new Date(now.t);
  otp.random = () => 123456; let n = 0; otp.salt = () => `salt-${++n}`;

  const tn = await repo.createLocation({ parentId: null, kind: 'STATE', name: 'Tamil Nadu', slug: 'tamil-nadu', sortOrder: 0 });
  const chennaiDistrict = await repo.createLocation({ parentId: tn.id, kind: 'DISTRICT', name: 'Chennai', slug: 'chennai', sortOrder: 0 });
  const chennaiCity = await repo.createLocation({ parentId: chennaiDistrict.id, kind: 'CITY', name: 'Chennai', slug: 'chennai', sortOrder: 0 });
  const madDistrict = await repo.createLocation({ parentId: tn.id, kind: 'DISTRICT', name: 'Madurai', slug: 'madurai', sortOrder: 1 });
  const madurai = await repo.createLocation({ parentId: madDistrict.id, kind: 'CITY', name: 'Madurai', slug: 'madurai', sortOrder: 0 });
  const family = await repo.createCategory({ parentId: null, name: 'Home services', slug: 'home-services', themeCategoryId: null, family: 'home-services', sortOrder: 0 });
  const plumber = await repo.createCategory({ parentId: family.id, name: 'Plumber', slug: 'plumber', themeCategoryId: 'plumber', family: 'home-services', sortOrder: 0 });
  const electrician = await repo.createCategory({ parentId: family.id, name: 'Electrician', slug: 'electrician', themeCategoryId: 'electrician', family: 'home-services', sortOrder: 1 });
  const health = await repo.createCategory({ parentId: null, name: 'Healthcare', slug: 'healthcare', themeCategoryId: null, family: 'healthcare', sortOrder: 1 });
  const dentist = await repo.createCategory({ parentId: health.id, name: 'Dentist', slug: 'dentist', themeCategoryId: 'dentist', family: 'healthcare', sortOrder: 0 });

  let b = 0;
  const biz = async (o: Partial<BusinessRow> & { name?: string } = {}): Promise<BusinessRow> => {
    const name = o.name ?? `Business ${++b}`;
    const draft = { status: o.status ?? 'CLAIMED', name, categoryId: o.categoryId ?? plumber.id, locationId: o.locationId === undefined ? chennaiCity.id : o.locationId, phoneE164: o.phoneE164 === undefined ? PHONE : o.phoneE164, address: o.address ?? { line1: '12 Test Road', city: 'Chennai' }, descriptionText: o.descriptionText ?? 'Fast and tidy plumbing work across the city, with clear prices.' };
    return repo.createBusiness({
      vendorId: o.vendorId ?? null, slug: o.slug ?? name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, categoryId: draft.categoryId, locationId: draft.locationId, address: draft.address, phoneE164: draft.phoneE164,
      emailMasked: null, hours: o.hours ?? { mon: '9-5' }, geo: o.geo ?? null, descriptionText: draft.descriptionText, status: draft.status, indexable: o.indexable ?? await admin.indexableFor(draft as never), source: o.source ?? 'STAFF', claimedAt: o.claimedAt ?? null,
    });
  };
  return { repo, audit, sms, claims, now, settings, visits, read, admin, removal, me, grants, otp, pepper, ids: { tn: tn.id, chennaiDistrict: chennaiDistrict.id, chennaiCity: chennaiCity.id, madurai: madurai.id, family: family.id, plumber: plumber.id, electrician: electrician.id, dentist: dentist.id }, biz };
}
export const advance = (w: DirectoryWorld, seconds: number): void => { w.now.t = new Date(w.now.t.getTime() + seconds * 1000); };
