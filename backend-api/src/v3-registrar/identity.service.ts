import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { ActivityBus } from '../common/activity-bus';
import { OtpPepper } from '../directory/pepper';
import { Actor } from '../plans/admin/audit.service';
import { aadhaarProblem, DOC_KINDS } from './core/registrar-core';
import { DocCrypto, DocCryptoError } from './doc-crypto';
import { RegistrantFields, RegistrantRow, RegistrantStatus, RegistrarStore } from './registrar.store';
import { RegistrarSettingsService } from './settings/registrar-settings';

export const IDENTITY_ERROR_CODES = [
  'IDENTITY_NOT_FOUND', 'IDENTITY_INVALID', 'IDENTITY_AADHAAR_REFUSED', 'IDENTITY_STATE_INVALID', 'OTP_NOT_AVAILABLE', 'OTP_TOO_SOON', 'OTP_INVALID', 'OTP_DELIVERY_FAILED',
  'IDENTITY_STORAGE_NOT_CONFIGURED', 'IDENTITY_DOCUMENT_UNREADABLE', 'IDENTITY_DOCUMENT_TOO_LARGE', 'IDENTITY_DOCUMENT_NOT_SET', 'IDENTITY_REVIEW_REASON_REQUIRED',
] as const;
type IdentityCode = (typeof IDENTITY_ERROR_CODES)[number];
const err = (code: IdentityCode, message: string): { message: string; code: IdentityCode } => ({ message, code });

/** Sends the one-time code. Production binds the unavailable sender until the message providers are connected (no live email or SMS in this run); tests record what would be sent. */
export abstract class IdentityOtpSender { abstract send(channel: 'EMAIL' | 'PHONE', to: string, code: string, vendorId: string): Promise<void> }
export class UnavailableOtpSender extends IdentityOtpSender { async send(): Promise<void> { throw new Error('OTP_DELIVERY_NOT_CONNECTED'); } }

const MIMES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
const text = (v: unknown, min: number, max: number): string | null => { const s = typeof v === 'string' ? v.trim() : ''; return s.length >= min && s.length <= max ? s : null; };

export interface RegistrantInput { legalName: string; company: string; email: string; phoneCc: string; phone: string; addressLine1: string; city: string; state: string; country?: string; zipcode: string }
export interface DocumentInput { kind: string; last4?: string; mime: string; dataBase64: string }
export interface StaffRef { id: string; role: string }

/**
 * Identity validation before the first purchase (Amendment 10 Part D3): email OTP, phone OTP, postal address, one government document (Aadhaar only as a masked copy with its last four digits, never a full
 * number, no e-KYC), staff review. Documents are encrypted at rest, every staff opening is written to the access log BEFORE the content is returned, and retention is a setting with no default.
 */
@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);
  clock: () => Date = () => new Date();
  constructor(
    private readonly store: RegistrarStore, private readonly sender: IdentityOtpSender, private readonly settings: RegistrarSettingsService, private readonly pepper: OtpPepper, private readonly crypto: DocCrypto,
    @Optional() private readonly bus?: ActivityBus,
  ) {}

  private emit(type: string, vendorId: string, actor: { type: 'VENDOR' | 'STAFF' | 'SYSTEM'; id: string | null }, data: Record<string, unknown> = {}): void { void this.bus?.emit({ type, vendorId, at: this.clock(), actor, data }); }
  private hash(label: string, value: string): string { return createHmac('sha256', this.pepper.value()).update(`${label}:${value}`).digest('hex'); }

  /** What the vendor sees of their own check: never the document, and no staff identity. */
  view(r: RegistrantRow | null) {
    if (!r) return { status: 'INCOMPLETE' as RegistrantStatus, details: null, emailVerified: false, phoneVerified: false, document: null, consentGiven: false, reviewNote: null };
    return {
      status: r.status, emailVerified: !!r.emailVerifiedAt, phoneVerified: !!r.phoneVerifiedAt, consentGiven: !!r.consentAt, reviewNote: r.status === 'REJECTED' ? r.reviewNote : null,
      details: { legalName: r.legalName, company: r.company, email: r.email, phoneCc: r.phoneCc, phone: r.phone, addressLine1: r.addressLine1, city: r.city, state: r.state, country: r.country, zipcode: r.zipcode },
      document: r.docKind ? { kind: r.docKind, last4: r.docLast4, uploadedAt: r.docUploadedAt, purged: !!r.docPurgedAt } : null,
    };
  }
  async mine(vendorId: string) { return this.view(await this.store.registrant(vendorId)); }

  // ───────────────────────────────────────────────────────────────────────────── details
  /** Saves the registrant's details. A changed email or phone must be verified again; any change after a decision sends the check back to the start. */
  async saveDetails(vendorId: string, input: RegistrantInput, actor: Actor) {
    const country = (input.country ?? 'IN').toUpperCase();
    const f: RegistrantFields | null = (() => {
      const legalName = text(input.legalName, 2, 120); const company = text(input.company, 2, 160); const email = text(input.email, 5, 254)?.toLowerCase() ?? null; const phoneCc = text(input.phoneCc, 1, 4); const phone = text(input.phone, 6, 15);
      const addressLine1 = text(input.addressLine1, 5, 200); const city = text(input.city, 2, 80); const state = text(input.state, 2, 80); const zipcode = text(input.zipcode, 3, 12);
      if (!legalName || !company || !email || !EMAIL.test(email) || !phoneCc || !/^\d{1,4}$/.test(phoneCc) || !phone || !/^\d{6,15}$/.test(phone) || !addressLine1 || !city || !state || !zipcode || !/^[A-Z]{2}$/.test(country)) return null;
      if (country === 'IN' && !/^\d{6}$/.test(zipcode)) return null;
      return { legalName, company, email, phoneCc, phone, addressLine1, city, state, country, zipcode };
    })();
    if (!f) throw new BadRequestException(err('IDENTITY_INVALID', 'Please check your name, business name, email, phone and full postal address.'));
    if (Object.values(f).some((v) => aadhaarProblem(v))) throw new BadRequestException(err('IDENTITY_AADHAAR_REFUSED', 'Please do not enter an Aadhaar number anywhere. Only a masked copy with the last four digits is accepted as a document.'));
    const prior = await this.store.registrant(vendorId);
    const resetEmail = !prior || prior.email !== f.email; const resetPhone = !prior || prior.phoneCc !== f.phoneCc || prior.phone !== f.phone;
    const changed = !prior || (Object.keys(f) as Array<keyof RegistrantFields>).some((k) => prior[k] !== f[k]);
    const saved = await this.store.saveRegistrant(vendorId, f, resetEmail, resetPhone);
    if (prior && changed && prior.status !== 'INCOMPLETE') await this.store.patchRegistrant(vendorId, null, { status: 'INCOMPLETE', consentAt: null, reviewedBy: null, reviewedAt: null });
    this.emit('domain.identity_details_saved', vendorId, { type: actor.type, id: actor.id }, { changed });
    return this.view((await this.store.registrant(vendorId)) ?? saved);
  }

  // ───────────────────────────────────────────────────────────────────────────── one-time codes
  async sendOtp(vendorId: string, channel: 'EMAIL' | 'PHONE', actor: Actor): Promise<{ sent: true; expiresAt: Date }> {
    const r = await this.store.registrant(vendorId);
    if (!r) throw new ConflictException(err('IDENTITY_STATE_INVALID', 'Please save your details first.'));
    const s = await this.settings.get(); const now = this.clock();
    if (s.identityOtpTtlSeconds === null || s.identityOtpMaxAttempts === null) throw new ConflictException(err('OTP_NOT_AVAILABLE', 'Verification codes are not available yet.'));
    const last = await this.store.latestOtp(vendorId, channel);
    if (s.identityOtpMinIntervalSeconds !== null && last && now.getTime() - last.createdAt.getTime() < s.identityOtpMinIntervalSeconds * 1000) throw new ConflictException(err('OTP_TOO_SOON', 'Please wait a little before asking for another code.'));
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const to = channel === 'EMAIL' ? r.email : `${r.phoneCc}${r.phone}`;
    const row = await this.store.insertOtp({ vendorId, channel, toHash: this.hash(`to:${channel}`, to), codeHash: this.hash(`otp:${vendorId}:${channel}`, code), expiresAt: new Date(now.getTime() + s.identityOtpTtlSeconds * 1000), createdAt: now });
    try { await this.sender.send(channel, to, code, vendorId); } catch (e) {
      this.logger.warn(`identity code not delivered (${channel}): ${e instanceof Error ? e.message : 'error'}`);
      await this.store.updateOtp(vendorId, row.id, { consumedAt: now });   // a code that was never delivered cannot be used
      throw new ConflictException(err('OTP_DELIVERY_FAILED', 'We could not send the code. Please try again later.'));
    }
    this.emit('domain.identity_code_sent', vendorId, { type: actor.type, id: actor.id }, { channel });
    return { sent: true, expiresAt: row.expiresAt };
  }

  async verifyOtp(vendorId: string, channel: 'EMAIL' | 'PHONE', code: string, actor: Actor) {
    const s = await this.settings.get(); const now = this.clock();
    if (s.identityOtpMaxAttempts === null) throw new ConflictException(err('OTP_NOT_AVAILABLE', 'Verification codes are not available yet.'));
    const o = await this.store.latestOtp(vendorId, channel);
    const bad = (): never => { throw new BadRequestException(err('OTP_INVALID', 'That code is not right, or it has expired. Ask for a new one.')); };
    if (!o || o.consumedAt || o.expiresAt.getTime() <= now.getTime() || o.attempts >= s.identityOtpMaxAttempts || typeof code !== 'string' || !/^\d{6}$/.test(code)) return bad();
    const want = Buffer.from(o.codeHash); const got = Buffer.from(this.hash(`otp:${vendorId}:${channel}`, code));
    if (want.length !== got.length || !timingSafeEqual(want, got)) { await this.store.updateOtp(vendorId, o.id, { attempts: o.attempts + 1 }); return bad(); }
    await this.store.updateOtp(vendorId, o.id, { consumedAt: now });
    await this.store.patchRegistrant(vendorId, null, channel === 'EMAIL' ? { emailVerifiedAt: now } : { phoneVerifiedAt: now });
    this.emit('domain.identity_contact_verified', vendorId, { type: actor.type, id: actor.id }, { channel });
    return this.mine(vendorId);
  }

  // ───────────────────────────────────────────────────────────────────────────── the document
  async uploadDocument(vendorId: string, input: DocumentInput, actor: Actor) {
    const r = await this.store.registrant(vendorId);
    if (!r) throw new ConflictException(err('IDENTITY_STATE_INVALID', 'Please save your details first.'));
    if (!(DOC_KINDS as readonly string[]).includes(input.kind)) throw new BadRequestException(err('IDENTITY_INVALID', 'Choose one of the accepted documents.'));
    const last4 = input.kind === 'AADHAAR_MASKED' ? String(input.last4 ?? '') : null;
    if (input.kind === 'AADHAAR_MASKED' ? !/^\d{4}$/.test(last4!) : input.last4 !== undefined) throw new BadRequestException(err('IDENTITY_INVALID', input.kind === 'AADHAAR_MASKED' ? 'Give the last four digits shown on the masked copy.' : 'Only a masked Aadhaar copy carries last four digits.'));
    if (!(MIMES as readonly string[]).includes(input.mime)) throw new BadRequestException(err('IDENTITY_INVALID', 'The document must be a PDF, a JPEG or a PNG.'));
    const s = await this.settings.get();
    if (s.identityDocMaxBytes === null) throw new ConflictException(err('IDENTITY_STORAGE_NOT_CONFIGURED', 'Document upload is not available yet.'));
    if (typeof input.dataBase64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(input.dataBase64) || input.dataBase64.length % 4 !== 0) throw new BadRequestException(err('IDENTITY_INVALID', 'The document could not be read.'));
    const bytes = Buffer.from(input.dataBase64, 'base64');
    if (bytes.length === 0) throw new BadRequestException(err('IDENTITY_INVALID', 'The document could not be read.'));
    if (bytes.length > s.identityDocMaxBytes) throw new BadRequestException(err('IDENTITY_DOCUMENT_TOO_LARGE', 'That document is too large.'));
    let blob; try { blob = this.crypto.encrypt(bytes); } catch (e) { throw this.cryptoHttp(e); }
    const now = this.clock();
    await this.store.storeDocument(vendorId, blob, { kind: input.kind, last4, mime: input.mime, bytes: bytes.length, at: now });
    await this.store.patchRegistrant(vendorId, null, { status: 'INCOMPLETE', consentAt: null, reviewedBy: null, reviewedAt: null, reviewNote: null });
    await this.store.logAccess(vendorId, null, 'DOCUMENT_UPLOADED', null, now);
    this.emit('domain.identity_document_uploaded', vendorId, { type: actor.type, id: actor.id }, { kind: input.kind });
    return this.mine(vendorId);
  }

  /** The vendor sends the check for review: both contacts verified, a document on file, and the vendor's confirmation that the details are theirs (the wording is supplied by counsel). */
  async submit(vendorId: string, consent: boolean, actor: Actor) {
    const r = await this.store.registrant(vendorId);
    if (!r) throw new ConflictException(err('IDENTITY_STATE_INVALID', 'Please save your details first.'));
    if (consent !== true) throw new BadRequestException(err('IDENTITY_INVALID', 'Please confirm that these details are yours.'));
    if (!r.emailVerifiedAt || !r.phoneVerifiedAt || !r.docKind || r.docPurgedAt) throw new ConflictException(err('IDENTITY_STATE_INVALID', 'Verify your email and phone and add a document first.'));
    if (r.status === 'IN_REVIEW' || r.status === 'APPROVED') return this.mine(vendorId);
    await this.store.patchRegistrant(vendorId, ['INCOMPLETE', 'REJECTED'], { status: 'IN_REVIEW', consentAt: this.clock() });
    this.emit('domain.identity_submitted', vendorId, { type: actor.type, id: actor.id });
    return this.mine(vendorId);
  }

  // ───────────────────────────────────────────────────────────────────────────── staff
  async queue(status: RegistrantStatus | undefined, page: number, pageSize: number) {
    const { items, total } = await this.store.reviewQueue(status, (page - 1) * pageSize, pageSize);
    return { items: items.map((r) => ({ vendorId: r.vendorId, status: r.status, legalName: r.legalName, company: r.company, docKind: r.docKind, emailVerified: !!r.emailVerifiedAt, phoneVerified: !!r.phoneVerifiedAt, updatedAt: r.updatedAt })), page, pageSize, total };
  }
  async forStaff(vendorId: string) {
    const r = await this.store.registrant(vendorId);
    if (!r) throw new NotFoundException(err('IDENTITY_NOT_FOUND', 'There is no identity check for that vendor.'));
    return { ...this.view(r), reviewedAt: r.reviewedAt, accessLog: (await this.store.accessLog(vendorId, 0, 50)).items };
  }
  /** Opens the document for a reviewer. The access row is written FIRST: if it cannot be written, the content is not returned. */
  async openDocument(vendorId: string, staff: StaffRef, reason: string) {
    const why = text(reason, 5, 300);
    if (!why) throw new BadRequestException(err('IDENTITY_REVIEW_REASON_REQUIRED', 'A reason of 5 to 300 characters is required to open a document.'));
    const r = await this.store.registrant(vendorId);
    if (!r) throw new NotFoundException(err('IDENTITY_NOT_FOUND', 'There is no identity check for that vendor.'));
    const d = await this.store.readDocument(vendorId);
    if (!d) throw new NotFoundException(err('IDENTITY_DOCUMENT_NOT_SET', 'There is no document on file.'));
    await this.store.logAccess(vendorId, staff.id, 'DOCUMENT_VIEWED', why, this.clock());
    let plain: Buffer; try { plain = this.crypto.decrypt(d); } catch (e) { throw this.cryptoHttp(e); }
    return { kind: d.kind, mime: d.mime, last4: r.docLast4, dataBase64: plain.toString('base64') };
  }
  async decide(vendorId: string, staff: StaffRef, to: 'APPROVED' | 'REJECTED', noteIn: string) {
    const note = text(noteIn, to === 'REJECTED' ? 5 : 0, 300);
    if (note === null) throw new BadRequestException(err('IDENTITY_REVIEW_REASON_REQUIRED', 'A reason of 5 to 300 characters is required to reject.'));
    const r = await this.store.registrant(vendorId);
    if (!r) throw new NotFoundException(err('IDENTITY_NOT_FOUND', 'There is no identity check for that vendor.'));
    if (r.status !== 'IN_REVIEW') throw new ConflictException(err('IDENTITY_STATE_INVALID', 'Only a check that is waiting for review can be decided.'));
    const now = this.clock();
    const done = await this.store.patchRegistrant(vendorId, ['IN_REVIEW'], { status: to, reviewedBy: staff.id, reviewedAt: now, reviewNote: note || null });
    if (!done) throw new ConflictException(err('IDENTITY_STATE_INVALID', 'Another reviewer decided this check first.'));
    await this.store.logAccess(vendorId, staff.id, to, note || null, now);
    this.emit(to === 'APPROVED' ? 'domain.identity_approved' : 'domain.identity_rejected', vendorId, { type: 'STAFF', id: staff.id });
    return this.view(done);
  }

  /** Deletes the stored document of decided checks older than the retention. Does nothing until counsel's retention is set. Safe to run again. */
  async purgeDue(): Promise<{ purged: number }> {
    const s = await this.settings.get();
    if (s.identityDocRetentionDays === null) return { purged: 0 };
    const cutoff = new Date(this.clock().getTime() - s.identityDocRetentionDays * 86_400_000); let purged = 0;
    for (const vendorId of await this.store.documentsDueForPurge(cutoff, 200)) {
      if (await this.store.purgeDocument(vendorId, this.clock())) { await this.store.logAccess(vendorId, null, 'DOCUMENT_PURGED', 'retention', this.clock()); purged++; }
    }
    return { purged };
  }

  private cryptoHttp(e: unknown): Error {
    if (e instanceof DocCryptoError) return e.code === 'IDENTITY_STORAGE_NOT_CONFIGURED' ? new ConflictException(err('IDENTITY_STORAGE_NOT_CONFIGURED', 'Document storage is not available yet.')) : new ForbiddenException(err('IDENTITY_DOCUMENT_UNREADABLE', 'That document cannot be read.'));
    return e instanceof Error ? e : new Error('error');
  }
}
