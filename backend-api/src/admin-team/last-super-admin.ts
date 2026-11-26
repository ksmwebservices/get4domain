import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { advisoryXactLock } from '../common/db-lock';
import { KeyedQueue } from '../common/keyed-queue';

/**
 * E11c: there is always at least one account that can sign in as Super admin. Two kinds count: an ACTIVE staff member with the role SUPER_ADMIN (an invited one
 * cannot sign in yet), and the platform's own administrator account (a vendor row with the role ADMIN or SUPER_ADMIN that is not suspended; sign-in gives it
 * Super admin). Every change that could take that power away goes through here, under one lock, so two Super admins removing each other cannot both succeed.
 */
export const ADMIN_TEAM_ERROR_CODES = ['LAST_SUPER_ADMIN'] as const;

const LOCK = 'super-admins';
const queue = new KeyedQueue();

export const isActiveSuperMember = (m: { role: string; status: string }): boolean => m.role === 'SUPER_ADMIN' && m.status === 'active';
export const isPlatformAdminAccount = (v: { role: string; status: string }): boolean => (v.role === 'ADMIN' || v.role === 'SUPER_ADMIN') && v.status !== 'SUSPENDED';

export const lastSuperAdmin = (): ConflictException =>
  new ConflictException({ code: 'LAST_SUPER_ADMIN', message: 'This is the only Super admin who can sign in. Make another Super admin first.' });

export const lockSuperAdmins = (tx: Prisma.TransactionClient): Promise<void> => advisoryXactLock(tx, LOCK);

/** Throws LAST_SUPER_ADMIN unless someone other than `losing` can still sign in as Super admin. Call it inside a transaction that holds the lock. */
export async function assertAnotherSuperAdmin(tx: Prisma.TransactionClient, losing: { memberId?: string; vendorId?: string }): Promise<void> {
  const members = await tx.adminTeamMember.count({ where: { role: 'SUPER_ADMIN', status: 'active', ...(losing.memberId ? { id: { not: losing.memberId } } : {}) } });
  if (members > 0) return;
  const accounts = await tx.vendor.count({ where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, status: { not: 'SUSPENDED' }, ...(losing.vendorId ? { id: { not: losing.vendorId } } : {}) } });
  if (accounts === 0) throw lastSuperAdmin();
}

/** One transaction holding the lock. Waiting for a turn happens in memory, before the transaction opens (see keyed-queue.ts). */
export function underSuperAdminLock<T>(prisma: { $transaction: (fn: (tx: Prisma.TransactionClient) => Promise<T>, o?: { maxWait?: number }) => Promise<T> }, work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return queue.run(LOCK, () => prisma.$transaction(async (tx) => { await lockSuperAdmins(tx); return work(tx); }, { maxWait: 15_000 }));
}
