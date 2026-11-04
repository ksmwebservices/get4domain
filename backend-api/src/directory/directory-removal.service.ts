import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Actor } from '../plans/admin/audit.service';
import { generateToken, hashToken } from '../provisioning/claims/token';
import { canTransitionRemoval, RemovalStatus } from './core/removal';
import { maskPhone } from './core/masking';
import { DirectoryAudit } from './directory-audit';
import { DirectoryReadService } from './directory-read.service';
import { directoryError, REMOVAL_INVALID_MESSAGE } from './directory.errors';
import { DirectoryRepository } from './directory.repository';
import { DirectorySettingsService } from './settings/directory-settings.service';
import { SmsAdapter } from './sms/sms-adapter';

const invalid = (): NotFoundException => new NotFoundException(directoryError('REMOVAL_INVALID', REMOVAL_INVALID_MESSAGE));
const RECENT_LIMIT = 3;
const RECENT_WINDOW_MS = 24 * 3_600_000;

/**
 * Removal of a public profile (slice 5.7). Anyone may ASK (uniform answer, rate limited, no oracle); the request is confirmed by a link sent to the phone number on file, handled
 * like a claim token (random, only its hash is stored, one uniform 404 for every bad link); staff then approve or reject; execution HIDES the profile (REMOVED, noindex, the public
 * API answers 410) and keeps the row and an audit entry. Nothing is hard-deleted.
 */
@Injectable()
export class DirectoryRemovalService {
  clock: () => Date = () => new Date();
  constructor(
    private readonly repo: DirectoryRepository, private readonly audit: DirectoryAudit, @Inject(DirectorySettingsService) private readonly settings: Pick<DirectorySettingsService, 'get' | 'readPublicAppUrl'>,
    private readonly sms: SmsAdapter, @Inject(DirectoryReadService) private readonly read: Pick<DirectoryReadService, 'invalidate'>,
  ) {}

  /** Always resolves; the caller returns the same body whatever happened. */
  async request(input: { businessSlug: string; reason?: string }, ip: string | null): Promise<void> {
    const slug = String(input?.businessSlug ?? '').trim().toLowerCase().slice(0, 80);
    const b = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) ? await this.repo.getBusinessBySlug(slug) : null;
    if (!b || b.status === 'REMOVED' || !b.phoneE164) return;
    const now = this.clock();
    if ((await this.repo.countRecentRemovals(b.id, new Date(now.getTime() - RECENT_WINDOW_MS))) >= RECENT_LIMIT) return;
    const s = await this.settings.get();
    const token = generateToken();
    const reason = typeof input.reason === 'string' ? input.reason.trim().slice(0, 300) || null : null;
    const row = await this.repo.createRemoval({ businessId: b.id, tokenHash: hashToken(token), reason, requesterContactMasked: maskPhone(b.phoneE164) || null, expiresAt: new Date(now.getTime() + s.removalLinkExpiryDays * 86_400_000) });
    const base = await this.settings.readPublicAppUrl();
    try { await this.sms.send(b.phoneE164, `Get4Domain: someone asked to remove ${b.name} from the directory. If it was you, confirm here: ${base}/directory/removal/${token}`); } catch { /* the request stays; staff can see it is unconfirmed */ }
    await this.audit.record({ type: 'SYSTEM', id: null, ip }, 'directory.removal.requested', 'directory_removal', row.id, null, { businessId: b.id, contact: row.requesterContactMasked });
  }

  private async usable(rawToken: string) {
    const row = await this.repo.findRemovalByHash(hashToken(String(rawToken ?? '').slice(0, 200)));
    if (!row || row.status !== 'REQUESTED' || row.expiresAt.getTime() <= this.clock().getTime()) return null;
    return row;
  }

  async linkStatus(rawToken: string): Promise<{ valid: true; businessName: string; confirmed: boolean }> {
    const row = await this.usable(rawToken); if (!row) throw invalid();
    const b = await this.repo.getBusiness(row.businessId); if (!b) throw invalid();
    return { valid: true, businessName: b.name, confirmed: !!row.confirmedAt };
  }

  async confirm(rawToken: string): Promise<{ confirmed: true }> {
    const row = await this.usable(rawToken); if (!row) throw invalid();
    if (!row.confirmedAt) await this.repo.confirmRemoval(row.id, this.clock());
    await this.audit.record({ type: 'SYSTEM', id: null, ip: null }, 'directory.removal.confirmed', 'directory_removal', row.id, null, { businessId: row.businessId });
    return { confirmed: true };
  }

  // staff
  list(q: { status?: RemovalStatus; skip: number; take: number }) { return this.repo.listRemovals(q); }

  private async load(id: string) { const r = await this.repo.getRemoval(id); if (!r) throw new NotFoundException(directoryError('DIRECTORY_NOT_FOUND', 'That removal request does not exist.')); return r; }
  private stateError(): ConflictException { return new ConflictException(directoryError('DIRECTORY_STATE_INVALID', 'That request cannot be moved to that state now.')); }

  async approve(id: string, actor: Actor): Promise<{ status: RemovalStatus }> {
    const r = await this.load(id);
    if (!canTransitionRemoval(r.status, 'APPROVED')) throw this.stateError();
    if (!r.confirmedAt) throw new ConflictException(directoryError('REMOVAL_NOT_CONFIRMED', 'The business contact has not confirmed this request yet.'));
    if (!(await this.repo.moveRemoval(id, 'REQUESTED', 'APPROVED', { handledByStaffId: actor.id, handledAt: this.clock() }))) throw this.stateError();
    await this.audit.record(actor, 'directory.removal.approved', 'directory_removal', id, { status: r.status }, { status: 'APPROVED' });
    return { status: 'APPROVED' };
  }

  async reject(id: string, reason: string, actor: Actor): Promise<{ status: RemovalStatus }> {
    const r = await this.load(id);
    if (!canTransitionRemoval(r.status, 'REJECTED')) throw this.stateError();
    if (!(await this.repo.moveRemoval(id, 'REQUESTED', 'REJECTED', { handledByStaffId: actor.id, handledAt: this.clock(), reason: String(reason ?? '').slice(0, 300) || null }))) throw this.stateError();
    await this.audit.record(actor, 'directory.removal.rejected', 'directory_removal', id, { status: r.status }, { status: 'REJECTED' });
    return { status: 'REJECTED' };
  }

  /** Hides the profile. Idempotent for the profile (a second call on a different request for an already removed business just records the request as executed). */
  async execute(id: string, actor: Actor): Promise<{ status: RemovalStatus }> {
    const r = await this.load(id);
    if (!canTransitionRemoval(r.status, 'EXECUTED')) throw this.stateError();
    const now = this.clock();
    if (!(await this.repo.moveRemoval(id, 'APPROVED', 'EXECUTED', { executedAt: now }))) throw this.stateError();
    const b = await this.repo.getBusiness(r.businessId);
    if (b && b.status !== 'REMOVED') await this.repo.updateBusiness(b.id, { status: 'REMOVED', indexable: false, removedAt: now });
    this.read.invalidate();
    await this.audit.record(actor, 'directory.removal.executed', 'directory_removal', id, { businessStatus: b?.status ?? null }, { businessId: r.businessId, businessStatus: 'REMOVED' });
    return { status: 'EXECUTED' };
  }
}
