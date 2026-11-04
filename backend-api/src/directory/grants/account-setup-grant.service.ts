import { Injectable, NotFoundException } from '@nestjs/common';
import { generateToken, hashToken } from '../../provisioning/claims/token';
import { DirectoryAudit } from '../directory-audit';
import { GRANT_INVALID_MESSAGE, directoryError } from '../directory.errors';
import { DirectoryRepository } from '../directory.repository';

const invalid = (): NotFoundException => new NotFoundException(directoryError('GRANT_INVALID', GRANT_INVALID_MESSAGE));

/**
 * The short-lived, single-use grant that follows a successful claim. The claim sets NO password; it hands back this grant, and the later set-password endpoint (not built in this
 * slice) calls `consume` exactly once. Only the hash of the token is stored; every bad token (unknown, used, expired, revoked) is the same 404.
 */
@Injectable()
export class AccountSetupGrantService {
  clock: () => Date = () => new Date();
  constructor(private readonly repo: DirectoryRepository, private readonly audit: DirectoryAudit) {}

  async issue(vendorId: string, minutes: number): Promise<{ token: string; expiresAt: Date }> {
    const token = generateToken();
    const expiresAt = new Date(this.clock().getTime() + minutes * 60_000);
    const g = await this.repo.createGrant({ vendorId, tokenHash: hashToken(token), expiresAt });
    await this.audit.record({ type: 'SYSTEM', id: null, ip: null }, 'account_setup.grant.issued', 'account_setup_grant', g.id, null, { vendorId, expiresAt: expiresAt.toISOString() });
    return { token, expiresAt };
  }

  /** Marks the grant used (race safe: exactly one caller wins) and says which vendor it was for. */
  async consume(rawToken: string): Promise<{ vendorId: string }> {
    const g = await this.repo.findGrantByHash(hashToken(String(rawToken ?? '').slice(0, 200)));
    if (!g || g.status !== 'ACTIVE' || g.expiresAt.getTime() <= this.clock().getTime()) throw invalid();
    if (!(await this.repo.consumeGrant(g.id, this.clock()))) throw invalid();
    await this.audit.record({ type: 'SYSTEM', id: null, ip: null }, 'account_setup.grant.consumed', 'account_setup_grant', g.id, null, { vendorId: g.vendorId });
    return { vendorId: g.vendorId };
  }
}
