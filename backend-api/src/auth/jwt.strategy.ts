import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { normalizeModules } from '../team/team-access';

/**
 * S13: a password change or reset stamps `passwordChangedAt`; any access token issued before that moment is refused, so a stolen token
 * does not outlive the password it was issued under. A token's `iat` has whole-second resolution, so a token from the SAME second as the change
 * cannot be told apart from one issued a moment before it: it is refused too (strict `<=`). Password change and reset therefore return only
 * after the clock has passed that second (PasswordService), so every session issued after them is accepted.
 * Accounts that never changed their password (null) are unaffected.
 */
function assertIssuedAfterPasswordChange(issuedAt: number | undefined, changedAt: Date | null | undefined): void {
  if (!changedAt) return;
  if (typeof issuedAt !== 'number' || issuedAt <= Math.floor(changedAt.getTime() / 1000)) {
    throw new UnauthorizedException('Your session has ended. Please sign in again.');
  }
}

interface JwtPayload {
  iat?: number;
  sub: string;
  email: string;
  role: string;
  adminRole?: string;
  kind?: string;
  memberId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET as string,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    // Standalone internal-staff principal (invited Marketing/Operations members).
    if (payload.kind === 'admin_member') {
      const member = await this.prisma.adminTeamMember.findUnique({ where: { id: payload.sub } });
      if (!member || member.status !== 'active') {
        throw new UnauthorizedException('Account not found or removed');
      }
      assertIssuedAfterPasswordChange(payload.iat, member.passwordChangedAt);
      return { sub: member.id, email: member.email, role: 'ADMIN', adminRole: member.role, kind: 'admin_member' };
    }

    // A vendor's team member. `sub` is the PARENT vendorId (data scoping); the member
    // is re-loaded each request so removal instantly ends the session and permission
    // (modules/department) changes take effect without re-login.
    if (payload.kind === 'team_member') {
      if (!payload.memberId) throw new UnauthorizedException('Invalid team session');
      const member = await this.prisma.teamMember.findUnique({ where: { id: payload.memberId } });
      if (!member || member.status !== 'active' || member.vendorId !== payload.sub) {
        throw new UnauthorizedException('Account not found or removed');
      }
      const parent = await this.prisma.vendor.findUnique({ where: { id: payload.sub } });
      if (!parent || parent.status === 'SUSPENDED') {
        throw new UnauthorizedException('Account not found or suspended');
      }
      assertIssuedAfterPasswordChange(payload.iat, member.passwordChangedAt);
      return {
        sub: parent.id, email: member.email ?? payload.email, role: 'VENDOR',
        kind: 'team_member', memberId: member.id,
        modules: normalizeModules(member.modules),
        department: member.department ?? undefined,
      };
    }

    const vendor = await this.prisma.vendor.findUnique({ where: { id: payload.sub } });

    if (!vendor || vendor.status === 'SUSPENDED') {
      throw new UnauthorizedException('Account not found or suspended');
    }

    assertIssuedAfterPasswordChange(payload.iat, vendor.passwordChangedAt);

    // Expired demo sandboxes can't be used even with an unexpired token.
    if (vendor.isSandbox && vendor.expiresAt && vendor.expiresAt < new Date()) {
      throw new UnauthorizedException('This demo session has expired');
    }

    // The bootstrap admin Vendor is treated as SUPER_ADMIN internal staff.
    const isAdmin = vendor.role === 'ADMIN' || vendor.role === 'SUPER_ADMIN';
    return {
      sub: vendor.id,
      email: vendor.email,
      role: vendor.role,
      adminRole: isAdmin ? 'SUPER_ADMIN' : undefined,
    };
  }
}
