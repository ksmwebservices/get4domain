import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

export type AccountType = 'VENDOR' | 'ADMIN_MEMBER' | 'TEAM_MEMBER';
export interface AccountRef { type: AccountType; id: string }

/** The signed-in account behind a password or a refresh token, in the shape the JWT claims are built from. */
export interface Account extends AccountRef {
  email: string;
  name: string;
  /** The vendor that owns the data (the account's own id for a vendor owner; the parent for a team member; '' for staff). */
  vendorId: string;
  role: string;
  adminRole?: string;
}

export interface TokenClaims {
  sub: string; email: string; role: string; adminRole?: string; kind?: string; memberId?: string;
}

/**
 * The three kinds of login (vendor owner, Get4Domain staff member, vendor team member) behind one small interface.
 * Same precedence as AuthService.login: vendor first, then staff, then team member. "Usable" means it could sign in today.
 */
@Injectable()
export class AccountDirectory {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<Account | null> {
    const where = { email: { equals: email.trim(), mode: 'insensitive' as const } };
    const vendor = await this.prisma.vendor.findFirst({ where });
    if (vendor) return this.usableVendor(vendor);
    const staff = await this.prisma.adminTeamMember.findFirst({ where: { ...where, status: 'active', password: { not: null } } });
    if (staff) return this.fromStaff(staff);
    const member = await this.prisma.teamMember.findFirst({ where: { ...where, status: 'active', password: { not: null } } });
    return member ? this.usableMember(member) : null;
  }

  /** Re-loads an account by reference; null when it no longer exists or may no longer sign in. */
  async load(ref: AccountRef): Promise<Account | null> {
    if (ref.type === 'VENDOR') {
      const v = await this.prisma.vendor.findUnique({ where: { id: ref.id } });
      return v ? this.usableVendor(v) : null;
    }
    if (ref.type === 'ADMIN_MEMBER') {
      const s = await this.prisma.adminTeamMember.findUnique({ where: { id: ref.id } });
      return s && s.status === 'active' ? this.fromStaff(s) : null;
    }
    const m = await this.prisma.teamMember.findUnique({ where: { id: ref.id } });
    return m && m.status === 'active' ? this.usableMember(m) : null;
  }

  /** Who is calling, from the verified JWT principal. Null for a demo sandbox (no password of its own). */
  fromPrincipal(user: AuthenticatedUser): AccountRef | null {
    if (user.kind === 'sandbox') return null;
    if (user.kind === 'admin_member') return { type: 'ADMIN_MEMBER', id: user.sub };
    if (user.kind === 'team_member') return user.memberId ? { type: 'TEAM_MEMBER', id: user.memberId } : null;
    return { type: 'VENDOR', id: user.sub };
  }

  /** The reference an access token's claims belong to (used to attach a refresh token to a login). */
  fromClaims(c: { sub: string; kind?: string; memberId?: string }): AccountRef | null {
    return this.fromPrincipal({ sub: c.sub, kind: c.kind, memberId: c.memberId } as AuthenticatedUser);
  }

  claims(a: Account): TokenClaims {
    if (a.type === 'ADMIN_MEMBER') return { sub: a.id, email: a.email, role: 'ADMIN', adminRole: a.adminRole, kind: 'admin_member' };
    if (a.type === 'TEAM_MEMBER') return { sub: a.vendorId, email: a.email, role: 'VENDOR', kind: 'team_member', memberId: a.id };
    return { sub: a.id, email: a.email, role: a.role, adminRole: a.adminRole };
  }

  async passwordHash(ref: AccountRef): Promise<string | null> {
    if (ref.type === 'VENDOR') return (await this.prisma.vendor.findUnique({ where: { id: ref.id }, select: { password: true } }))?.password ?? null;
    if (ref.type === 'ADMIN_MEMBER') return (await this.prisma.adminTeamMember.findUnique({ where: { id: ref.id }, select: { password: true } }))?.password ?? null;
    return (await this.prisma.teamMember.findUnique({ where: { id: ref.id }, select: { password: true } }))?.password ?? null;
  }

  /** Writes the new hash and the cutoff time in the same statement: every session issued before `at` stops working. */
  async setPassword(tx: Prisma.TransactionClient, ref: AccountRef, hash: string, at: Date): Promise<void> {
    const data = { password: hash, passwordChangedAt: at };
    if (ref.type === 'VENDOR') await tx.vendor.update({ where: { id: ref.id }, data });
    else if (ref.type === 'ADMIN_MEMBER') await tx.adminTeamMember.update({ where: { id: ref.id }, data });
    else await tx.teamMember.update({ where: { id: ref.id }, data });
  }

  private usableVendor(v: { id: string; email: string; name: string; role: string; status: string; isSandbox: boolean; expiresAt: Date | null }): Account | null {
    if (v.status === 'SUSPENDED') return null;
    if (v.isSandbox) return null;                                                   // demo sandboxes have no real password
    const isAdmin = v.role === 'ADMIN' || v.role === 'SUPER_ADMIN';
    return { type: 'VENDOR', id: v.id, email: v.email, name: v.name, vendorId: v.id, role: v.role, adminRole: isAdmin ? 'SUPER_ADMIN' : undefined };
  }

  private fromStaff(s: { id: string; email: string; name: string; role: string; password: string | null }): Account | null {
    if (!s.password) return null;
    return { type: 'ADMIN_MEMBER', id: s.id, email: s.email, name: s.name, vendorId: '', role: 'ADMIN', adminRole: s.role };
  }

  private async usableMember(m: { id: string; vendorId: string; email: string | null; name: string; password: string | null }): Promise<Account | null> {
    if (!m.password || !m.email) return null;
    const parent = await this.prisma.vendor.findUnique({ where: { id: m.vendorId }, select: { status: true } });
    if (!parent || parent.status === 'SUSPENDED') return null;
    return { type: 'TEAM_MEMBER', id: m.id, email: m.email, name: m.name, vendorId: m.vendorId, role: 'VENDOR' };
  }
}
